import Redis from 'ioredis';

import config from './config.js';

type CacheValue =
    | { type: 'null' }
    | { type: 'undefined' }
    | { type: 'string'; value: string }
    | { type: 'number'; value: number }
    | { type: 'boolean'; value: boolean }
    | { type: 'date'; value: string }
    | { type: 'map'; value: [unknown, unknown][] }
    | { type: 'set'; value: unknown[] }
    | { type: 'buffer'; value: string }
    | { type: 'json'; value: unknown };

const UNDEFINED_SENTINEL = Symbol('CACHE_UNDEFINED');

/**
 * Hybrid cache that uses Redis if available, falls back to memory
 * Perfect for development (memory) and production (Redis)
 */
class HybridCache {
    private redisClient?: Redis;
    private memoryCache = new Map<string, { value: string; expires: number }>();
    private isRedisAvailable = false;
    private cleanupThreshold: number;

    constructor() {
        if (config.REDIS_URL && config.ENABLE_CACHE) {
            this.initRedis(config.REDIS_URL);
        } else {
            this.isRedisAvailable = false;
            console.log('📦 Using in-memory cache (Redis not configured)');
        }

        this.cleanupThreshold = config.CACHE_CLEANUP_THRESHOLD || 100;
    }

    private initRedis(url: string) {
        this.redisClient = new Redis(url, {
            maxRetriesPerRequest: 1,
            enableOfflineQueue: false,
            retryStrategy: (times: number) => {
                if (times > 3) {
                    console.log('⚠️ Redis unavailable, using memory cache');
                    return null;
                }
                return Math.min(times * 500, 2000);
            },
        });

        this.redisClient.on('connect', () => {
            console.log('✅ Connected to Redis cache');
            this.isRedisAvailable = true;
        });

        this.redisClient.on('error', (err) => {
            console.error('Redis error:', err.message);
            this.isRedisAvailable = false;
        });
    }

    private serializeValue<T>(value: T): string {
        let payload: CacheValue;

        if (value === null) {
            payload = { type: 'null' };
        } else if (value === undefined) {
            payload = { type: 'undefined' };
        } else if (typeof value === 'string') {
            payload = { type: 'string', value };
        } else if (typeof value === 'number' && Number.isFinite(value)) {
            payload = { type: 'number', value };
        } else if (typeof value === 'boolean') {
            payload = { type: 'boolean', value };
        } else if (value instanceof Date) {
            payload = { type: 'date', value: value.toISOString() };
        } else if (value instanceof Map) {
            payload = { type: 'map', value: Array.from(value.entries()) };
        } else if (value instanceof Set) {
            payload = { type: 'set', value: Array.from(value.values()) };
        } else if (Buffer.isBuffer(value)) {
            payload = { type: 'buffer', value: value.toString('base64') };
        } else {
            payload = { type: 'json', value };
        }

        return JSON.stringify(payload);
    }

    private deserializeValue<T>(raw: string): T | null | typeof UNDEFINED_SENTINEL {
        try {
            const payload = JSON.parse(raw) as CacheValue;

            switch (payload.type) {
                case 'null':
                    return null;
                case 'undefined':
                    return UNDEFINED_SENTINEL;
                case 'string':
                    return payload.value as T;
                case 'number':
                    return payload.value as T;
                case 'boolean':
                    return payload.value as T;
                case 'date':
                    return new Date(payload.value) as unknown as T;
                case 'map':
                    return new Map(payload.value) as unknown as T;
                case 'set':
                    return new Set(payload.value) as unknown as T;
                case 'buffer':
                    return Buffer.from(payload.value, 'base64') as unknown as T;
                case 'json':
                    return payload.value as T;
                default:
                    throw new Error(`Unsupported cache payload type: ${(payload as CacheValue).type}`);
            }
        } catch (error) {
            console.error('Cache deserialization error:', error instanceof Error ? error.message : error);
            return null;
        }
    }

    private unwrapDeserialized<T>(value: T | null | typeof UNDEFINED_SENTINEL): T | null {
        if (value === UNDEFINED_SENTINEL) {
            return undefined as T;
        }
        return value;
    }

    async get<T>(key: string): Promise<T | null> {
        if (this.isRedisAvailable && this.redisClient) {
            try {
                const value = await this.redisClient.get(key);
                if (value === null) {
                    return null;
                }
                const deserialized = this.deserializeValue<T>(value);
                return this.unwrapDeserialized(deserialized);
            } catch (error) {
                console.error('Redis get error:', error instanceof Error ? error.message : error);
                // Fall through to memory cache
            }
        }

        // Memory cache fallback
        const item = this.memoryCache.get(key);
        if (!item || Date.now() > item.expires) {
            this.memoryCache.delete(key);
            return null;
        }

        const deserialized = this.deserializeValue<T>(item.value);
        return this.unwrapDeserialized(deserialized);
    }

    async set<T>(key: string, value: T, ttlSeconds: number = 60): Promise<void> {
        const valueToStoreStr = this.serializeValue(value);

        if (this.isRedisAvailable && this.redisClient) {
            try {
                await this.redisClient.setex(key, ttlSeconds, valueToStoreStr);
                return;
            } catch (error) {
                console.error('Redis set error:', error instanceof Error ? error.message : error);
                // Fall through to memory cache
            }
        }

        // Memory cache fallback
        const expires = Date.now() + ttlSeconds * 1000;
        this.memoryCache.set(key, { value: valueToStoreStr, expires });

        // Clean up expired entries periodically
        if (this.memoryCache.size > this.cleanupThreshold) {
            this.cleanupMemoryCache();
        }
    }

    private cleanupMemoryCache() {
        const now = Date.now();
        for (const [key, item] of this.memoryCache.entries()) {
            if (now > item.expires) {
                this.memoryCache.delete(key);
            }
        }
    }
}

// Export singleton instance
export const cache = new HybridCache();

/**
 * Helper to get cached value or fetch from factory
 */
export async function getCachedOrFetch<T>(key: string, fetcher: () => Promise<T>, ttl: number = 60): Promise<T> {
    if (config.ENABLE_CACHE) {
        const cached = await cache.get<T>(key);
        if (cached !== null) {
            return cached;
        }
    }

    const fresh = await fetcher();
    if (config.ENABLE_CACHE) {
        await cache.set<T>(key, fresh, ttl);
    }
    return fresh;
}
