import GtfsRealtimeBindings, { type transit_realtime } from 'gtfs-realtime-bindings';
import fetch from 'node-fetch';

import { getCachedOrFetch } from '../utils/cache.js';
import config from '../utils/config.js';

// Use the protobuf decoder from the default export
const { transit_realtime: rt } = GtfsRealtimeBindings;
const { FeedMessage } = rt;

type IFeedMessage = transit_realtime.IFeedMessage;

/**
 * GTFS Realtime Service
 * Handles fetching and parsing GTFS-Realtime protocol buffer feeds from AC Transit
 */
class GTFSRealtimeService {
    private readonly baseUrl: string;
    private readonly token: string;
    private readonly vehiclePositionsPath = '/vehicles';
    private readonly tripUpdatesPath = '/tripupdates';
    private readonly serviceAlertsPath = '/alerts';

    constructor() {
        this.baseUrl = config.GTFS_REALTIME_API_BASE_URL;
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
     * Fetch and parse GTFS-Realtime feed
     */
    private async fetchGTFSFeed(url: string, params?: Record<string, string>): Promise<IFeedMessage> {
        try {
            const finalUrl = this.buildUrl(url, params);
            const response = await fetch(finalUrl);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Get the response as a buffer (binary data)
            const buffer = await response.arrayBuffer();
            const uint8Array = new Uint8Array(buffer);

            // Parse the protobuf data
            const feed = FeedMessage.decode(uint8Array);

            return feed;
        } catch (error) {
            console.error(`Error fetching GTFS feed from ${url}:`, error);
            throw error;
        }
    }

    /**
     * Fetch vehicle positions for all AC Transit buses (raw feed, uncached)
     */
    private async fetchVehiclePositionsRaw(): Promise<IFeedMessage> {
        const url = `${this.baseUrl}${this.vehiclePositionsPath}`;
        const feed = await this.fetchGTFSFeed(url);
        return feed;
    }

    /**
     * Fetch vehicle positions with caching
     * Cache key includes 'all' since this fetches all routes
     */
    async fetchVehiclePositions(): Promise<IFeedMessage> {
        // Use cache for all vehicle positions
        return getCachedOrFetch(`bus:all`, () => this.fetchVehiclePositionsRaw(), config.CACHE_TTL_VEHICLE_POSITIONS);
    }

    /**
     * Fetch vehicle positions for a specific route with caching
     */
    async fetchVehiclePositionsForRoute(routeId: string): Promise<IFeedMessage> {
        // Get all positions (will use cache if available)
        const allPositions = await this.fetchVehiclePositions();

        // Filter for the specific route
        return this.filterByRoute(allPositions, routeId);
    }

    /**
     * Fetch trip updates (arrival predictions) - raw, uncached
     */
    private async fetchTripUpdatesRaw(): Promise<IFeedMessage> {
        const url = `${this.baseUrl}${this.tripUpdatesPath}`;
        const feed = await this.fetchGTFSFeed(url);
        return feed;
    }

    /**
     * Fetch trip updates with caching
     */
    async fetchTripUpdates(): Promise<IFeedMessage> {
        return getCachedOrFetch(`trips:all`, () => this.fetchTripUpdatesRaw(), config.CACHE_TTL_PREDICTIONS);
    }

    /**
     * Fetch trip updates for a specific route with caching
     * Optionally filter by stop ID when provided
     */
    async fetchTripUpdatesForRoute(routeId: string, stopId?: string): Promise<IFeedMessage> {
        // Get all trip updates (will use cache if available)
        const allUpdates = await this.fetchTripUpdates();

        // Filter for the specific route first
        const routeFiltered = this.filterByRoute(allUpdates, routeId);

        // Optionally filter by stop ID within the trip updates
        if (!stopId) {
            return routeFiltered;
        }

        const entities = routeFiltered.entity || [];
        const filteredEntities = entities
            .map((entity) => {
                return {
                    ...entity,
                    tripUpdate: entity.tripUpdate
                        ? {
                              ...entity.tripUpdate,
                              stopTimeUpdate:
                                  entity.tripUpdate.stopTimeUpdate?.filter((stu) => stu.stopId === stopId) || [],
                          }
                        : undefined,
                };
            })
            .filter(
                (entity) =>
                    entity.tripUpdate && entity.tripUpdate.stopTimeUpdate && entity.tripUpdate.stopTimeUpdate.length > 0
            );

        return {
            ...routeFiltered,
            entity: filteredEntities,
        };
    }

    /**
     * Fetch service alerts - raw, uncached
     */
    private async fetchServiceAlertsRaw(): Promise<IFeedMessage> {
        const url = `${this.baseUrl}${this.serviceAlertsPath}`;
        const feed = await this.fetchGTFSFeed(url);
        return feed;
    }

    /**
     * Fetch service alerts with caching
     */
    async fetchServiceAlerts(): Promise<IFeedMessage> {
        return getCachedOrFetch(`alerts:all`, () => this.fetchServiceAlertsRaw(), config.CACHE_TTL_SERVICE_ALERTS);
    }

    /**
     * Fetch service alerts for a specific route with caching
     */
    async fetchServiceAlertsForRoute(routeId: string): Promise<IFeedMessage> {
        // Get all alerts (will use cache if available)
        const allAlerts = await this.fetchServiceAlerts();

        // Filter for the specific route
        return this.filterByRoute(allAlerts, routeId);
    }

    /**
     * Filter data for specific route (e.g., '51B')
     */
    filterByRoute(feed: IFeedMessage, routeId: string): IFeedMessage {
        const filteredEntities = (feed.entity || []).filter((entity) => {
            // Check vehicle positions
            if (entity.vehicle?.trip?.routeId === routeId) {
                return true;
            }
            // Check trip updates
            if (entity.tripUpdate?.trip.routeId === routeId) {
                return true;
            }
            // Check alerts
            if (entity.alert?.informedEntity?.some((e) => e.routeId === routeId)) {
                return true;
            }
            return false;
        });

        return {
            ...feed,
            entity: filteredEntities,
        };
    }
}

// Export singleton instance
const gtfsRealtimeService = new GTFSRealtimeService();

export type GTFSRealtimeServiceType = typeof gtfsRealtimeService;

export default gtfsRealtimeService;
