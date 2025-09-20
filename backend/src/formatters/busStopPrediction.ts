import { type transit_realtime } from 'gtfs-realtime-bindings';

import { BusStopPredictionRaw } from '../services/actRealtime.js';
import { parseActRealtimeTimestamp } from '../utils/datetime.js';

export interface BusStopPrediction {
    vehicleId: string;
    tripId: string;
    arrivalTime: Date;
    departureTime: Date;
    minutesAway: number;
    isOutbound: boolean;
    distanceToStopFeet: number | null;
}

function parseMinutesAway(value: string): number {
    if (value === 'Due') {
        return 0;
    }

    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
}

function isOutboundDirection(direction: string): boolean {
    const normalized = direction.toLowerCase();
    return normalized.includes('amtrak') || normalized.includes('away');
}

export function createBusStopPredictionsFromActRealtime(
    rawPredictions: BusStopPredictionRaw[],
    isOutbound: boolean
): BusStopPrediction[] {
    if (!rawPredictions?.length) {
        return [];
    }

    return rawPredictions
        .filter((prediction) => isOutboundDirection(prediction.rtdir) === isOutbound)
        .map((prediction) => {
            const arrivalTime = parseActRealtimeTimestamp(prediction.prdtm);

            return {
                vehicleId: prediction.vid,
                tripId: prediction.tatripid,
                arrivalTime,
                departureTime: arrivalTime,
                minutesAway: Math.max(0, parseMinutesAway(prediction.prdctdn)),
                isOutbound: isOutboundDirection(prediction.rtdir),
                distanceToStopFeet: Number.isFinite(prediction.dstp) ? prediction.dstp : null,
            };
        })
        .sort((a, b) => a.arrivalTime.getTime() - b.arrivalTime.getTime());
}

export function createBusStopPredictionsFromGtfsFeed(
    feedMessage: transit_realtime.IFeedMessage,
    isOutbound: boolean
): BusStopPrediction[] {
    if (!feedMessage.entity) return [];

    // Flatten all stop time updates with their trip context
    const allStopUpdates: BusStopPrediction[] = feedMessage.entity
        .filter((entity) => entity.tripUpdate?.trip?.routeId && entity.tripUpdate?.stopTimeUpdate)
        .flatMap((entity) => {
            const tripUpdate = entity.tripUpdate!;
            const trip = tripUpdate.trip;
            const tripIsOutbound = trip.directionId === 1; // GTFS directionId: 1=outbound (Amtrak), 0=inbound (Rockridge BART)
            const vehicleId = tripUpdate.vehicle?.id || entity.id || 'unknown';

            return tripUpdate
                .stopTimeUpdate!.filter(
                    (stopTimeUpdate) =>
                        stopTimeUpdate.stopId &&
                        (stopTimeUpdate.arrival || stopTimeUpdate.departure) &&
                        tripIsOutbound === isOutbound
                )
                .map((stopTimeUpdate) => {
                    const arrivalTime = new Date(
                        Number(stopTimeUpdate.arrival?.time || stopTimeUpdate.departure?.time) * 1000
                    );
                    const departureTime = new Date(
                        Number(stopTimeUpdate.departure?.time || stopTimeUpdate.arrival?.time) * 1000
                    );
                    const now = new Date();
                    const minutesAway = Math.round((arrivalTime.getTime() - now.getTime()) / 60000);
                    return {
                        tripId: trip.tripId || '',
                        vehicleId,
                        isOutbound: tripIsOutbound,
                        arrivalTime,
                        departureTime,
                        minutesAway: Math.max(0, minutesAway), // Don't show negative times
                        distanceToStopFeet: null, // GTFS-RT doesn't provide distance data
                    };
                });
        });

    return allStopUpdates.sort((a, b) => a.arrivalTime.getTime() - b.arrivalTime.getTime());
}
