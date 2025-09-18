import type { transit_realtime } from 'gtfs-realtime-bindings';
import { v4 as uuidv4 } from 'uuid';

/**
 * ACTransitAlert type matching our GraphQL schema
 */
export interface ParsedACTransitAlert {
    id: string;
    headerText: string;
    descriptionText: string | null;
    severity: 'INFO' | 'WARNING' | 'SEVERE';
    startTime: Date | null;
    endTime: Date | null;
    affectedRoutes: string[];
    affectedStops: string[];
}

/**
 * BusPosition type matching our GraphQL schema
 */
export interface ParsedBusPosition {
    vehicleId: string;
    routeId: string;
    isOutbound: boolean;
    latitude: number;
    longitude: number;
    heading: number | null;
    speed: number | null;
    timestamp: Date;
    tripId: string | null;
    stopSequence: number | null;
}

/**
 * StopPrediction type matching our GraphQL schema
 */
export interface ParsedStopPrediction {
    stopId: string;
    stopName: string;
    direction: string;
    arrivals: ParsedArrival[];
    latitude: number;
    longitude: number;
}

export interface ParsedArrival {
    vehicleId: string;
    tripId: string;
    arrivalTime: Date;
    departureTime: Date;
    minutesAway: number;
    isOutbound: boolean;
}

/**
 * GTFS Parser Service
 * Transforms raw GTFS-RT data into clean, schema-compliant objects
 */
class GTFSParser {
    /**
     * Extract English-only text from multilingual alert content
     * AC Transit includes translations separated by "---"
     */
    private extractEnglishText(text: string | null | undefined): string | null {
        if (!text) return null;

        // Split by the language separator
        const sections = text.split(/\n?---\s*\n?/);

        // The first section is typically English
        const englishSection = sections[0]?.trim();

        if (!englishSection) return null;

        // Clean up extra whitespace and normalize line breaks
        return englishSection
            .replace(/\n{3,}/g, '\n\n') // Replace triple+ newlines with double
            .replace(/\s+$/gm, '') // Remove trailing whitespace per line
            .trim();
    }

    /**
     * Map GTFS-RT severity to our schema enum
     */
    private mapSeverity(severity?: transit_realtime.Alert.SeverityLevel | null): 'INFO' | 'WARNING' | 'SEVERE' {
        // GTFS-RT severity values: UNKNOWN_SEVERITY = 1, INFO = 2, WARNING = 3, SEVERE = 4
        switch (severity) {
            case 4: // SEVERE
                return 'SEVERE';
            case 3: // WARNING
                return 'WARNING';
            case 2: // INFO
            case 1: // UNKNOWN_SEVERITY
            default:
                return 'INFO';
        }
    }

    /**
     * Parse AC Transit alerts from GTFS-RT feed
     */
    parseAlerts(feedMessage: transit_realtime.IFeedMessage): ParsedACTransitAlert[] {
        if (!feedMessage.entity) return [];

        return feedMessage.entity
            .filter((entity) => entity.alert)
            .map((entity) => {
                const alert = entity.alert!;
                const id = entity.id || `alert-${uuidv4()}`;

                // Extract English text from translations
                const headerText = this.extractEnglishText(alert.headerText?.translation?.[0]?.text) || 'No title';

                const descriptionText = this.extractEnglishText(alert.descriptionText?.translation?.[0]?.text);

                // Extract affected routes and stops using map/filter
                const affectedRoutes =
                    alert.informedEntity
                        ?.map((informedEntity) => informedEntity.routeId)
                        .filter((routeId): routeId is string => Boolean(routeId)) || [];

                const affectedStops =
                    alert.informedEntity
                        ?.map((informedEntity) => informedEntity.stopId)
                        .filter((stopId): stopId is string => Boolean(stopId)) || [];

                // Parse active period times
                const firstPeriod = alert.activePeriod?.[0];
                const startTime = firstPeriod?.start ? new Date(Number(firstPeriod.start) * 1000) : null;
                const endTime = firstPeriod?.end ? new Date(Number(firstPeriod.end) * 1000) : null;

                return {
                    id,
                    headerText,
                    descriptionText,
                    severity: this.mapSeverity(alert.severityLevel),
                    startTime,
                    endTime,
                    affectedRoutes: [...new Set(affectedRoutes)], // Remove duplicates
                    affectedStops: [...new Set(affectedStops)], // Remove duplicates
                };
            });
    }

    /**
     * Parse vehicle positions from GTFS-RT feed
     */
    parseVehiclePositions(feedMessage: transit_realtime.IFeedMessage): ParsedBusPosition[] {
        if (!feedMessage.entity) return [];

        return feedMessage.entity
            .filter((entity) => {
                const { vehicle } = entity;
                // Must have vehicle, position with lat/lon, and route info
                return vehicle?.position?.latitude && vehicle?.position?.longitude && vehicle?.trip?.routeId;
            })
            .map((entity) => {
                const vehicle = entity.vehicle!;
                const position = vehicle.position!;
                const trip = vehicle.trip!;

                return {
                    vehicleId: entity.id || vehicle.vehicle?.id || 'unknown',
                    routeId: trip.routeId!,
                    isOutbound: trip.directionId === 0, // 0 = outbound, 1 = inbound in GTFS
                    latitude: position.latitude!,
                    longitude: position.longitude!,
                    heading: position.bearing || null,
                    speed: position.speed || null,
                    timestamp: vehicle.timestamp ? new Date(Number(vehicle.timestamp) * 1000) : new Date(),
                    tripId: trip.tripId || null,
                    stopSequence: vehicle.currentStopSequence || null,
                };
            });
    }

    /**
     * Parse trip updates (stop predictions) from GTFS-RT feed
     * This would need stop metadata to be complete
     */
    parseTripUpdates(
        feedMessage: transit_realtime.IFeedMessage,
        stopMetadata?: Map<string, { name: string; lat: number; lon: number }>
    ): ParsedStopPrediction[] {
        if (!feedMessage.entity) return [];

        // Flatten all stop time updates with their trip context
        const allStopUpdates = feedMessage.entity
            .filter((entity) => entity.tripUpdate?.trip?.routeId && entity.tripUpdate?.stopTimeUpdate)
            .flatMap((entity) => {
                const tripUpdate = entity.tripUpdate!;
                const trip = tripUpdate.trip;
                const isOutbound = trip.directionId === 0;
                const vehicleId = tripUpdate.vehicle?.id || entity.id || 'unknown';

                return tripUpdate
                    .stopTimeUpdate!.filter((stopTimeUpdate) => stopTimeUpdate.stopId)
                    .map((stopTimeUpdate) => ({
                        stopId: stopTimeUpdate.stopId!,
                        tripId: trip.tripId || '',
                        vehicleId,
                        isOutbound,
                        arrivalTimestamp: stopTimeUpdate.arrival?.time || stopTimeUpdate.departure?.time,
                        departureTimestamp: stopTimeUpdate.departure?.time || stopTimeUpdate.arrival?.time,
                    }))
                    .filter((update) => update.arrivalTimestamp); // Only keep updates with arrival times
            });

        // Group by stop ID using reduce
        const predictionsByStop = allStopUpdates.reduce((acc, update) => {
            const { stopId, tripId, vehicleId, isOutbound, arrivalTimestamp, departureTimestamp } = update;

            if (!acc.has(stopId)) {
                const metadata = stopMetadata?.get(stopId);
                acc.set(stopId, {
                    stopId,
                    stopName: metadata?.name || `Stop ${stopId}`,
                    direction: isOutbound ? 'Outbound' : 'Inbound',
                    arrivals: [],
                    latitude: metadata?.lat || 0,
                    longitude: metadata?.lon || 0,
                });
            }

            const arrivalTime = new Date(Number(arrivalTimestamp) * 1000);
            const departureTime = new Date(Number(departureTimestamp || arrivalTimestamp) * 1000);
            const now = new Date();
            const minutesAway = Math.round((arrivalTime.getTime() - now.getTime()) / 60000);

            acc.get(stopId)!.arrivals.push({
                vehicleId,
                tripId,
                arrivalTime,
                departureTime,
                minutesAway: Math.max(0, minutesAway), // Don't show negative times
                isOutbound,
            });

            return acc;
        }, new Map<string, ParsedStopPrediction>());

        // Convert to array and sort arrivals for each stop
        return Array.from(predictionsByStop.values()).map((prediction) => ({
            ...prediction,
            arrivals: prediction.arrivals.sort((a, b) => a.arrivalTime.getTime() - b.arrivalTime.getTime()),
        }));
    }

    /**
     * Filter parsed data by route ID
     */
    filterByRoute<T extends { routeId?: string; affectedRoutes?: string[] }>(items: T[], routeId: string): T[] {
        return items.filter((item) => {
            // For bus positions
            if ('routeId' in item && item.routeId) {
                return item.routeId === routeId;
            }
            // For alerts
            if ('affectedRoutes' in item && item.affectedRoutes) {
                return item.affectedRoutes.includes(routeId);
            }
            return false;
        });
    }
}

// Export singleton instance
export default new GTFSParser();
