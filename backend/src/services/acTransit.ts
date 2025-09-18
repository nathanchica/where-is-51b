import fetch from 'node-fetch';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import type { transit_realtime } from 'gtfs-realtime-bindings';
import config from '../utils/config.js';
import { getCachedOrFetch, CACHE_KEYS, CACHE_TTL } from '../utils/cache.js';

// Use the protobuf decoder from the default export
const { transit_realtime: rt } = GtfsRealtimeBindings;
const { FeedMessage } = rt;

type IFeedMessage = transit_realtime.IFeedMessage;

/**
 * AC Transit API Service
 * Handles fetching and parsing GTFS-Realtime data from AC Transit
 */
class ACTransitService {
    private readonly vehiclePositionsUrl: string;
    private readonly tripUpdatesUrl: string;
    private readonly serviceAlertsUrl: string;
    private readonly token: string;

    constructor() {
        this.vehiclePositionsUrl = config.AC_TRANSIT_VEHICLE_POSITIONS_URL;
        this.tripUpdatesUrl = config.AC_TRANSIT_TRIP_UPDATES_URL;
        this.serviceAlertsUrl = config.AC_TRANSIT_SERVICE_ALERTS_URL;
        this.token = config.AC_TRANSIT_TOKEN;
    }

    /**
     * Build URL with optional token parameter
     */
    private buildUrl(baseUrl: string): string {
        if (this.token) {
            const url = new URL(baseUrl);
            url.searchParams.append('token', this.token);
            return url.toString();
        }
        return baseUrl;
    }

    /**
     * Fetch and parse GTFS-Realtime feed
     */
    private async fetchGTFSFeed(url: string): Promise<IFeedMessage> {
        try {
            const finalUrl = this.buildUrl(url);
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
        const feed = await this.fetchGTFSFeed(this.vehiclePositionsUrl);

        // Log some basic info about the feed
        const timestamp = feed.header.timestamp ? Number(feed.header.timestamp) : 0;
        console.log(`Feed timestamp: ${new Date(timestamp * 1000).toISOString()}`);
        console.log(`Number of entities: ${feed.entity?.length || 0}`);

        // Log first few vehicle positions as a sample
        const vehicleEntities = (feed.entity || []).filter((e) => e.vehicle);
        console.log(`Vehicle position entities: ${vehicleEntities.length}`);

        if (vehicleEntities.length > 0 && config.NODE_ENV === 'development') {
            console.log('\nSample vehicle data (first 3):');
            vehicleEntities.slice(0, 3).forEach((entity, index) => {
                const vehicle = entity.vehicle!;
                console.log(`\n  Vehicle ${index + 1}:`);
                console.log(`    ID: ${entity.id}`);
                console.log(`    Route: ${vehicle.trip?.routeId || 'N/A'}`);
                console.log(`    Position: ${vehicle.position?.latitude}, ${vehicle.position?.longitude}`);
                console.log(`    Speed: ${vehicle.position?.speed || 'N/A'} m/s`);
                console.log(
                    `    Timestamp: ${vehicle.timestamp ? new Date(Number(vehicle.timestamp) * 1000).toISOString() : 'N/A'}`
                );
            });
        }

        return feed;
    }

    /**
     * Fetch vehicle positions with caching
     * Cache key includes 'all' since this fetches all routes
     */
    async fetchVehiclePositions(): Promise<IFeedMessage> {
        // Use cache for all vehicle positions
        return getCachedOrFetch(
            CACHE_KEYS.VEHICLE_POSITIONS('all'),
            () => this.fetchVehiclePositionsRaw(),
            CACHE_TTL.VEHICLE_POSITIONS
        );
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
        console.log('\nFetching trip updates...');
        const feed = await this.fetchGTFSFeed(this.tripUpdatesUrl);

        const timestamp = feed.header.timestamp ? Number(feed.header.timestamp) : 0;
        console.log(`Feed timestamp: ${new Date(timestamp * 1000).toISOString()}`);
        console.log(`Number of entities: ${feed.entity?.length || 0}`);

        // Log sample trip update in development
        if (config.NODE_ENV === 'development') {
            const tripUpdateEntities = (feed.entity || []).filter((e) => e.tripUpdate);
            console.log(`Trip update entities: ${tripUpdateEntities.length}`);

            if (tripUpdateEntities.length > 0) {
                console.log('\nSample trip update (first one):');
                const firstUpdate = tripUpdateEntities[0];
                const tripUpdate = firstUpdate.tripUpdate!;
                console.log(`  Trip ID: ${tripUpdate.trip.tripId}`);
                console.log(`  Route ID: ${tripUpdate.trip.routeId}`);
                console.log(`  Stop time updates: ${tripUpdate.stopTimeUpdate?.length || 0}`);

                if (tripUpdate.stopTimeUpdate && tripUpdate.stopTimeUpdate.length > 0) {
                    const firstStop = tripUpdate.stopTimeUpdate[0];
                    console.log(`  First stop:`);
                    console.log(`    Stop ID: ${firstStop.stopId}`);
                    console.log(
                        `    Arrival: ${firstStop.arrival?.time ? new Date(Number(firstStop.arrival.time) * 1000).toISOString() : 'N/A'}`
                    );
                }
            }
        }

        return feed;
    }

    /**
     * Fetch trip updates with caching
     */
    async fetchTripUpdates(): Promise<IFeedMessage> {
        return getCachedOrFetch(
            CACHE_KEYS.TRIP_UPDATES('all'),
            () => this.fetchTripUpdatesRaw(),
            CACHE_TTL.TRIP_UPDATES
        );
    }

    /**
     * Fetch trip updates for a specific route with caching
     */
    async fetchTripUpdatesForRoute(routeId: string): Promise<IFeedMessage> {
        // Get all trip updates (will use cache if available)
        const allUpdates = await this.fetchTripUpdates();

        // Filter for the specific route
        return this.filterByRoute(allUpdates, routeId);
    }

    /**
     * Fetch service alerts - raw, uncached
     */
    private async fetchServiceAlertsRaw(): Promise<IFeedMessage> {
        console.log('\nFetching service alerts...');
        const feed = await this.fetchGTFSFeed(this.serviceAlertsUrl);

        const timestamp = feed.header.timestamp ? Number(feed.header.timestamp) : 0;
        console.log(`Feed timestamp: ${new Date(timestamp * 1000).toISOString()}`);
        console.log(`Number of entities: ${feed.entity?.length || 0}`);

        // Log alerts count
        const alertEntities = (feed.entity || []).filter((e) => e.alert);
        console.log(`Alert entities: ${alertEntities.length}`);

        return feed;
    }

    /**
     * Fetch service alerts with caching
     */
    async fetchServiceAlerts(): Promise<IFeedMessage> {
        return getCachedOrFetch(
            CACHE_KEYS.SERVICE_ALERTS(),
            () => this.fetchServiceAlertsRaw(),
            CACHE_TTL.SERVICE_ALERTS
        );
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
export default new ACTransitService();
