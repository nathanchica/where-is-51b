import { transit_realtime } from 'gtfs-realtime-bindings';

import type { BusPositionRaw } from '../services/actRealtime.js';
import { parseActRealtimeTimestamp } from '../utils/datetime.js';

// https://en.wikipedia.org/wiki/Miles_per_hour
const MPH_TO_METERS_PER_SECOND = 0.44704;

export interface BusPosition {
    vehicleId: string;
    routeId: string;
    latitude: number;
    longitude: number;
    heading: number | null;
    speed: number | null;
    timestamp: Date;
    tripId: string | null;
    stopSequence: number | null;
}

function parseFiniteNumber(value: unknown): number | null {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length === 0) {
            return null;
        }

        const parsedString = Number(trimmed);
        return Number.isFinite(parsedString) ? parsedString : null;
    }

    const parsedNumber = Number(value);
    return Number.isFinite(parsedNumber) ? parsedNumber : null;
}

function resolveTimestamp(
    vehicleTimestamp: transit_realtime.IVehiclePosition['timestamp'],
    headerTimestamp: transit_realtime.IFeedHeader['timestamp']
): Date {
    const seconds = parseFiniteNumber(vehicleTimestamp) ?? parseFiniteNumber(headerTimestamp);
    return seconds !== null ? new Date(seconds * 1000) : new Date();
}

export function createBusPositionsFromGtfsFeed(feedMessage: transit_realtime.IFeedMessage): BusPosition[] {
    if (!feedMessage.entity?.length) {
        return [];
    }

    const headerTimestamp = feedMessage.header?.timestamp;

    const positions = feedMessage.entity.flatMap((entity) => {
        const vehicle = entity.vehicle;
        if (!vehicle) {
            return [];
        }

        const routeId = vehicle.trip?.routeId;
        const latitude = parseFiniteNumber(vehicle.position?.latitude);
        const longitude = parseFiniteNumber(vehicle.position?.longitude);
        const vehicleId = vehicle.vehicle?.id ?? entity.id ?? '';

        if (!routeId || latitude === null || longitude === null || !vehicleId) {
            return [];
        }

        const stopSequenceValue = parseFiniteNumber(vehicle.currentStopSequence);

        const position: BusPosition = {
            vehicleId,
            routeId,
            latitude,
            longitude,
            heading: parseFiniteNumber(vehicle.position?.bearing),
            speed: parseFiniteNumber(vehicle.position?.speed),
            timestamp: resolveTimestamp(vehicle.timestamp, headerTimestamp),
            tripId: vehicle.trip?.tripId ?? null,
            stopSequence: stopSequenceValue !== null ? Math.round(stopSequenceValue) : null,
        };

        return [position];
    });

    return positions.sort((a, b) => a.vehicleId.localeCompare(b.vehicleId));
}

function resolveTripId(raw: BusPositionRaw): string | null {
    const trimmedStringTripId = raw.tatripid?.trim();
    if (trimmedStringTripId) {
        return trimmedStringTripId;
    }

    if (raw.tripid !== undefined && raw.tripid !== null) {
        return String(raw.tripid);
    }

    return null;
}

export function createBusPositionsFromActRealtime(rawPositions: Array<BusPositionRaw>): BusPosition[] {
    if (!rawPositions?.length) {
        return [];
    }

    const positions = rawPositions
        .map((rawPosition) => {
            const vehicleId = rawPosition.vid?.trim();
            const routeId = rawPosition.rt?.trim();
            const latitude = parseFiniteNumber(rawPosition.lat);
            const longitude = parseFiniteNumber(rawPosition.lon);

            if (!vehicleId || !routeId || latitude === null || longitude === null) {
                return null;
            }

            const heading = parseFiniteNumber(rawPosition.hdg);
            const speedMph = parseFiniteNumber(rawPosition.spd);
            const speed = speedMph !== null ? speedMph * MPH_TO_METERS_PER_SECOND : null;

            const position: BusPosition = {
                vehicleId,
                routeId,
                latitude,
                longitude,
                heading,
                speed,
                timestamp: parseActRealtimeTimestamp(rawPosition.tmstmp),
                tripId: resolveTripId(rawPosition),
                stopSequence: null, // ACT RealTime does not provide stop sequence information
            };

            return position;
        })
        .filter((position): position is BusPosition => position !== null)
        .sort((a, b) => a.vehicleId.localeCompare(b.vehicleId));

    return positions;
}
