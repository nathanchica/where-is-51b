import Redis from 'ioredis';
import config from './config.js';

// Cache configuration constants
const MEMORY_CACHE_CLEANUP_THRESHOLD = 100; // Trigger cleanup after this many entries

/**
 * Hybrid cache that uses Redis if available, falls back to memory
 * Perfect for development (memory) and production (Redis)
 */
class HybridCache {
    private redisClient?: Redis;
    private memoryCache = new Map<string, { value: string; expires: number }>();
    private isRedisAvailable = false;

    constructor() {
        if (config.REDIS_URL) {
            this.initRedis(config.REDIS_URL);
        } else {
            this.isRedisAvailable = false;
            console.log('📦 Using in-memory cache (Redis not configured)');
        }
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

    async get<T>(key: string): Promise<T | null> {
        if (this.isRedisAvailable && this.redisClient) {
            try {
                const value = await this.redisClient.get(key);
                return value ? JSON.parse(value) : null;
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
        return JSON.parse(item.value);
    }

    async set<T>(key: string, value: T, ttlSeconds: number = 60): Promise<void> {
        if (this.isRedisAvailable && this.redisClient) {
            try {
                await this.redisClient.setex(key, ttlSeconds, JSON.stringify(value));
                return;
            } catch (error) {
                console.error('Redis set error:', error instanceof Error ? error.message : error);
                // Fall through to memory cache
            }
        }

        // Memory cache fallback
        const expires = Date.now() + ttlSeconds * 1000;
        this.memoryCache.set(key, { value: JSON.stringify(value), expires });

        // Clean up expired entries periodically
        if (this.memoryCache.size > MEMORY_CACHE_CLEANUP_THRESHOLD) {
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

// Cache key generators
export const CACHE_KEYS = {
    VEHICLE_POSITIONS: (routeId: string = 'all') => `bus:${routeId}`,
    TRIP_UPDATES: (routeId: string = 'all', stopIds?: string[]) =>
        `trips:${routeId}:${stopIds?.sort().join(',') || 'all'}`,
    SERVICE_ALERTS: (routeId: string = 'all') => `alerts:${routeId}`,
};

// Cache TTL in seconds
export const CACHE_TTL = {
    VEHICLE_POSITIONS: 10, // 10 seconds (bus positions change frequently)
    TRIP_UPDATES: 15, // 15 seconds (predictions update regularly)
    SERVICE_ALERTS: 300, // 5 minutes (alerts rarely change)
};

/**
 * Helper to get cached value or fetch from factory
 */
export async function getCachedOrFetch<T>(key: string, fetcher: () => Promise<T>, ttl: number = 60): Promise<T> {
    const cached = await cache.get<T>(key);
    if (cached !== null && cached !== undefined) {
        return cached;
    }

    const fresh = await fetcher();
    await cache.set<T>(key, fresh, ttl);
    return fresh;
}
