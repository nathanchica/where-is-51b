import fetch from 'node-fetch';

import { getCachedOrFetch } from '../utils/cache.js';
import config from '../utils/config.js';

export type BusStopProfileRaw = {
    stpid: string; // stop code (5-digit)
    stpnm: string; // stop name
    geoid: string; // GTFS stop_id
    lat: number;
    lon: number;
};

/**
 * Response type for GET actrealtime/stop?rt={rt}&dir={dir}&stpid={stpid}&callback={callback}
 */
type BusStopApiResponse = {
    'bustime-response': {
        stops: Array<BusStopProfileRaw>;
    };
};

export type BusStopPredictionRaw = {
    tmstmp: string; // "20250918 05:55"
    typ: string; // "A" for arrival, "D" for departure
    stpnm: string; // Stop name
    stpid: string; // Stop ID (5-digit stop code, not GTFS stop_id)
    vid: string; // Vehicle ID
    dstp: number; // Distance to stop (in feet)
    rt: string; // Route (e.g., "51B")
    rtdd: string; // Route display
    rtdir: string; // Route direction description
    des: string; // Destination
    prdtm: string; // Predicted time "20250918 05:54"
    tatripid: string; // Trip ID
    prdctdn: string; // Countdown - "Due" or number of minutes
    schdtm: string; // Scheduled time
    seq: number; // Stop sequence
};

/**
 * Response type for GET actrealtime/prediction?stpid={stpid}&rt={rt}&vid={vid}&top={top}&tmres={tmres}&callback={callback}&showocprd={showocprd}
 */
type BusStopPredictionsResponse = {
    'bustime-response': {
        prd: Array<BusStopPredictionRaw>; // Raw prediction objects from ACT API
    };
};

type SystemTimeResponse = {
    'bustime-response'?: {
        tm?: string;
    };
};

export type BusPositionRaw = {
    vid: string; // Vehicle ID
    rt: string; // Route (e.g., "51B")
    des: string; // Destination headsign
    tmstmp: string; // Timestamp "YYYYMMDD HH:MM"
    lat: string; // Latitude as a string
    lon: string; // Longitude as a string
    hdg?: string; // Heading in degrees
    pid?: number; // Pattern ID
    pdist?: number; // Distance travelled along pattern (feet)
    dly?: boolean; // Delay flag
    spd?: number; // Speed in mph
    tablockid?: string; // Block identifier
    tatripid?: string; // Trip ID (string form)
    zone?: string; // Fare zone identifier
    mode?: number; // Mode indicator (0 = bus)
    psgld?: string; // Passenger load indicator
    oid?: string; // Operator ID
    or?: boolean; // Out of route flag
    blk?: number; // Block number
    tripid?: number; // Trip identifier (numeric)
    tripdyn?: number; // Trip dynamics flag
    rtpidatafeed?: string; // Data feed identifier
};

/**
 * Response type for GET actrealtime/vehicle?vid={vid}&rt={rt}&tmres={tmres}&callback={callback}&lat={lat}&lng={lng}&searchRadius={searchRadius}
 */
type VehiclePositionsResponse = {
    'bustime-response'?: {
        vehicle?: Array<BusPositionRaw>;
    };
};

/**
 * ACT Realtime Service
 * Handles fetching data from AC Transit's proprietary REST API
 * This includes stop profiles, predictions, and other real-time data
 */
class ACTRealtimeService {
    private readonly baseUrl: string;
    private readonly token: string;
    private readonly busStopProfilePath = '/stop';
    private readonly busStopPredictionsPath = '/prediction';
    private readonly vehiclePositionsPath = '/vehicle';
    private readonly systemTimePath = '/time';

    constructor() {
        this.baseUrl = config.ACT_REALTIME_API_BASE_URL;
        this.token = config.AC_TRANSIT_TOKEN;
    }

    /**
     * Build URL with token and optional additional parameters
     * @param baseUrl The base URL to build from
     * @param params Optional additional query parameters
     */
    private buildUrl(baseUrl: string, params?: Record<string, string>): string {
        const url = new URL(baseUrl);

        // Add token if available
        if (this.token) {
            url.searchParams.set('token', this.token);
        }

        // Add any additional parameters
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                url.searchParams.set(key, value);
            });
        }

        return url.toString();
    }

    /**
     * Fetch bus stop profiles from stop codes using AC Transit REST API batch endpoint (raw, no caching)
     * @param stopCodes Array of 5-digit stop codes (max 10 per request)
     * @returns Map of stop_code to BusStopProfileRaw
     */
    private async fetchBusStopProfilesRaw(stopCodes: string[]): Promise<Map<string, BusStopProfileRaw>> {
        const profileMap = new Map<string, BusStopProfileRaw>();

        if (stopCodes.length === 0) {
            return profileMap;
        }

        // AC Transit API supports up to 10 stop codes per request
        if (stopCodes.length > 10) {
            throw new Error('AC Transit API supports maximum 10 stop codes per request');
        }

        try {
            // Join stop codes with comma for batch request
            const url = `${this.baseUrl}${this.busStopProfilePath}`;
            const params = { stpid: stopCodes.join(',') };
            const finalUrl = this.buildUrl(url, params);

            const response = await fetch(finalUrl, {
                headers: {
                    Accept: 'application/json',
                },
            });

            if (!response.ok) {
                if (response.status === 404) {
                    console.warn(`Stop codes not found: ${stopCodes.join(', ')}`);
                    return profileMap;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data: BusStopApiResponse = (await response.json()) as BusStopApiResponse;

            // Navigate through the nested response structure
            const stops = data?.['bustime-response']?.stops;
            if (!stops || stops.length === 0) {
                console.warn(`No stops found for codes: ${stopCodes.join(', ')}`);
                return profileMap;
            }

            stopCodes.forEach((stopCode) => {
                const profile = stops.find((stop) => stop.stpid === stopCode);
                if (profile) {
                    profileMap.set(stopCode, profile);
                }
            });

            // Log any stop codes that weren't found
            const missingCodes = stopCodes.filter((code) => !profileMap.has(code));
            if (missingCodes.length > 0) {
                console.warn(`Stop codes not found in response: ${missingCodes.join(', ')}`);
            }

            return profileMap;
        } catch (error) {
            console.error(`Error fetching bus stop profiles for stop codes ${stopCodes.join(', ')}:`, error);
            throw error;
        }
    }

    /**
     * Fetch bus stop profiles for multiple stop codes with caching and batching
     * @param stopCodes Array of 5-digit stop codes
     * @returns Map of stop_code to BusStopProfile
     */
    async fetchBusStopProfiles(stopCodes: string[]): Promise<Map<string, BusStopProfileRaw>> {
        const profileMap = new Map<string, BusStopProfileRaw>();

        if (stopCodes.length === 0) {
            return profileMap;
        }

        // Split into chunks of 10 (AC Transit API limit) using array methods
        const chunkSize = 10;
        const chunks = Array.from({ length: Math.ceil(stopCodes.length / chunkSize) }, (_, index) =>
            stopCodes.slice(index * chunkSize, (index + 1) * chunkSize)
        );

        // Process chunks in parallel with caching
        const promises = chunks.map(async (chunk) => {
            // Create a cache key for this batch
            const cacheKey = `bus-stop-profiles:${chunk.sort().join(',')}`;

            try {
                const chunkMap = await getCachedOrFetch(
                    cacheKey,
                    () => this.fetchBusStopProfilesRaw(chunk),
                    config.CACHE_TTL_BUS_STOP_PROFILES
                );

                // Merge results into main map using forEach
                if (chunkMap.size > 0) {
                    chunkMap.forEach((profile, code) => profileMap.set(code, profile));
                }
            } catch (error) {
                console.error(`Failed to fetch bus stop profiles for chunk: ${chunk.join(', ')}`, error);
            }
        });

        await Promise.all(promises);

        // Log any stop codes that weren't found
        const missingCodes = stopCodes.filter((code) => !profileMap.has(code));
        if (missingCodes.length > 0) {
            console.warn(`Could not find bus stop profiles for codes: ${missingCodes.join(', ')}`);
        }

        return profileMap;
    }

    /**
     * Fetch predictions for multiple stops from AC Transit REST API (raw, no caching)
     * @param stopCodes Array of 5-digit stop codes (max 10 per request)
     * @returns Map of stop_code to predictions response
     */
    private async fetchBusStopPredictionsRaw(stopCodes: string[]): Promise<Map<string, Array<BusStopPredictionRaw>>> {
        const predictionsMap = new Map<string, Array<BusStopPredictionRaw>>();

        if (stopCodes.length === 0) {
            return predictionsMap;
        }

        // AC Transit API supports up to 10 stop codes per request
        if (stopCodes.length > 10) {
            throw new Error('AC Transit API supports maximum 10 stop codes per request');
        }

        try {
            // Join stop codes with comma for batch request
            // Note: AC Transit confusingly calls stop_code "stpid"
            const url = `${this.baseUrl}${this.busStopPredictionsPath}`;
            const params = { stpid: stopCodes.join(',') };
            const finalUrl = this.buildUrl(url, params);

            const response = await fetch(finalUrl, {
                headers: {
                    Accept: 'application/json',
                },
            });

            if (!response.ok) {
                if (response.status === 404) {
                    console.warn(`No predictions for stop codes: ${stopCodes.join(', ')}`);
                    return predictionsMap;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data: BusStopPredictionsResponse = (await response.json()) as BusStopPredictionsResponse;

            if (data) {
                const predictions = data['bustime-response']?.prd;
                stopCodes.forEach((stopCode) => {
                    predictionsMap.set(
                        stopCode,
                        predictions && Array.isArray(predictions) ? predictions.filter((p) => p.stpid === stopCode) : []
                    );
                });
            }

            return predictionsMap;
        } catch (error) {
            console.error(`Error fetching predictions for stop codes ${stopCodes.join(', ')}:`, error);
            throw error;
        }
    }

    /**
     * Fetch predictions for multiple stops with caching and batching
     * @param stopCodes Array of 5-digit stop codes
     * @returns Map of stop_code to predictions response
     */
    async fetchBusStopPredictions(stopCodes: string[]): Promise<Map<string, Array<BusStopPredictionRaw>>> {
        const predictionsMap = new Map<string, Array<BusStopPredictionRaw>>();

        if (stopCodes.length === 0) {
            return predictionsMap;
        }

        // Split into chunks of 10 (AC Transit API limit)
        const chunkSize = 10;
        const chunks = Array.from({ length: Math.ceil(stopCodes.length / chunkSize) }, (_, index) =>
            stopCodes.slice(index * chunkSize, (index + 1) * chunkSize)
        );

        // Process chunks in parallel with caching
        const promises = chunks.map(async (chunk) => {
            const cacheKey = `bus-stop-predictions:${chunk.sort().join(',')}`;

            try {
                const chunkMap = await getCachedOrFetch(
                    cacheKey,
                    () => this.fetchBusStopPredictionsRaw(chunk),
                    config.CACHE_TTL_PREDICTIONS
                );

                // Merge results into main map
                chunkMap.forEach((predictions, code) => predictionsMap.set(code, predictions));
            } catch (error) {
                console.error(`Failed to fetch predictions for chunk: ${chunk.join(', ')}`, error);
            }
        });

        await Promise.all(promises);

        return predictionsMap;
    }

    /**
     * Fetch the current AC Transit system time without caching
     */
    async fetchSystemTime(): Promise<Date> {
        const url = `${this.baseUrl}${this.systemTimePath}`;
        const finalUrl = this.buildUrl(url, { unixTime: 'true' });

        const response = await fetch(finalUrl, {
            headers: {
                Accept: 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error fetching system time! status: ${response.status}`);
        }

        const data: SystemTimeResponse = (await response.json()) as SystemTimeResponse;
        const rawTimestamp = data?.['bustime-response']?.tm;

        if (!rawTimestamp) {
            throw new Error('AC Transit system time response missing timestamp');
        }

        const timestampMs = Number.parseInt(rawTimestamp, 10);

        if (Number.isNaN(timestampMs)) {
            throw new Error(`Invalid AC Transit system time value: ${rawTimestamp}`);
        }

        return new Date(timestampMs);
    }

    /**
     * Fetch vehicle positions (raw, no caching)
     * @param routeId Optional route ID to filter by
     * @returns Array of BusPositionRaw
     */
    private async fetchBusPositionsRaw(routeId?: string): Promise<Array<BusPositionRaw>> {
        try {
            const url = `${this.baseUrl}${this.vehiclePositionsPath}`;
            const finalUrl = this.buildUrl(url, routeId ? { rt: routeId } : undefined);

            const response = await fetch(finalUrl, {
                headers: {
                    Accept: 'application/json',
                },
            });

            if (!response.ok) {
                if (response.status === 404) {
                    console.warn(`No vehicle positions found${routeId ? ` for route: ${routeId}` : ''}`);
                    return [];
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data: VehiclePositionsResponse = (await response.json()) as VehiclePositionsResponse;
            const vehicles = data?.['bustime-response']?.vehicle;

            if (!vehicles || vehicles.length === 0) {
                return [];
            }

            return vehicles;
        } catch (error) {
            console.error(`Error fetching vehicle positions${routeId ? ` for route ${routeId}` : ''}:`, error);
            throw error;
        }
    }

    /**
     * Fetch vehicle positions with caching
     * @param routeId Optional route ID to filter by
     * @returns Array of BusPositionRaw
     */
    async fetchVehiclePositions(routeId?: string): Promise<Array<BusPositionRaw>> {
        const cacheKey = `vehicle-positions:${routeId ?? 'all'}`;

        return getCachedOrFetch(cacheKey, () => this.fetchBusPositionsRaw(routeId), config.CACHE_TTL_VEHICLE_POSITIONS);
    }
}

// Export singleton instance
const actRealtimeService = new ACTRealtimeService();

export type ACTRealtimeServiceType = typeof actRealtimeService;

export default actRealtimeService;
