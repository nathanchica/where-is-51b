import { BusStopProfileRaw } from '../services/actRealtime.js';

/**
 * Structured bus stop profile data
 */
export type BusStopProfile = {
    id: string; // GTFS stop_id (geoid from API)
    code: string; // 5-digit stop code (stpid from API)
    latitude: number; // Stop latitude
    longitude: number; // Stop longitude
    name: string; // Stop name
};

export function createBusStopProfile(rawBusStop: BusStopProfileRaw): BusStopProfile {
    if (!rawBusStop.geoid) {
        throw new Error('Cannot create BusStopProfile without geoid');
    }

    if (!rawBusStop.stpid) {
        throw new Error('Cannot create BusStopProfile without stpid');
    }

    return {
        id: rawBusStop.geoid,
        code: rawBusStop.stpid,
        latitude: rawBusStop.lat,
        longitude: rawBusStop.lon,
        name: rawBusStop.stpnm,
    };
}
