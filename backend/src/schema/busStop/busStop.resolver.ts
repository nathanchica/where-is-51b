import { createBusStopProfile, BusStopProfile } from '../../formatters/busStop.js';
import { Context } from '../../context.js';
import { ACTRealtimeServiceType } from '../../services/actRealtime.js';

export type BusStopParent = {
    __typename: 'BusStop';
    id?: string;
    code: string;
    name?: string;
    latitude?: number;
    longitude?: number;
};

export function createBusStopParent(busStopData: Partial<BusStopParent>): BusStopParent {
    if (!busStopData.code) {
        throw new Error('BusStop code is required to create BusStopParent');
    }
    return {
        __typename: 'BusStop',
        code: busStopData.code,
        ...busStopData,
    };
}

async function getBusStopProfile(
    actRealtimeService: ACTRealtimeServiceType,
    busStopCode: string
): Promise<BusStopProfile> {
    if (!busStopCode) {
        throw new Error('Cannot resolve BusStop profile without code');
    }

    const profiles = await actRealtimeService.fetchBusStopProfiles([busStopCode]);
    const rawProfile = profiles.get(busStopCode);

    if (!rawProfile) {
        throw new Error(`No profile found for stop code ${busStopCode}`);
    }

    return createBusStopProfile(rawProfile);
}

const resolvers = {
    Query: {
        busStop: async (_: unknown, { busStopCode }: { busStopCode: string }, { services }: Context) => {
            try {
                const { code, id, name, latitude, longitude } = await getBusStopProfile(
                    services.actRealtime,
                    busStopCode
                );
                return createBusStopParent({ code, id, name, latitude, longitude });
            } catch (error) {
                throw new Error(
                    `Failed to fetch bus stop for code ${busStopCode}: ${error instanceof Error ? error.message : 'Unknown error'}`
                );
            }
        },
    },
    BusStop: {
        id: async (parent: BusStopParent, _args: unknown, { services }: Context) => {
            // If id is already available, return it
            if (parent.id) {
                return parent.id;
            }

            try {
                const { id } = await getBusStopProfile(services.actRealtime, parent.code);
                return id;
            } catch (error) {
                throw new Error(
                    `Failed to fetch stop_id for code ${parent.code}: ${error instanceof Error ? error.message : 'Unknown error'}`
                );
            }
        },

        code: async (parent: BusStopParent) => {
            // Code should usually be available already
            if (parent.code) {
                return parent.code;
            }

            // If we only have id, we'd need reverse lookup (not implemented)
            throw new Error('Cannot resolve BusStop.code without the code field');
        },

        name: async (parent: BusStopParent, _args: unknown, { services }: Context) => {
            // If name is already available, return it
            if (parent.name) {
                return parent.name;
            }

            try {
                const { name } = await getBusStopProfile(services.actRealtime, parent.code);
                return name;
            } catch (error) {
                throw new Error(
                    `Failed to fetch stop name for code ${parent.code}: ${error instanceof Error ? error.message : 'Unknown error'}`
                );
            }
        },

        latitude: async (parent: BusStopParent, _args: unknown, { services }: Context) => {
            // If latitude is already available, return it
            if (parent.latitude !== undefined && parent.latitude !== null) {
                return parent.latitude;
            }

            try {
                const { latitude } = await getBusStopProfile(services.actRealtime, parent.code);
                return latitude;
            } catch (error) {
                throw new Error(
                    `Failed to fetch latitude for code ${parent.code}: ${error instanceof Error ? error.message : 'Unknown error'}`
                );
            }
        },

        longitude: async (parent: BusStopParent, _args: unknown, { services }: Context) => {
            // If longitude is already available, return it
            if (parent.longitude !== undefined && parent.longitude !== null) {
                return parent.longitude;
            }

            try {
                const { longitude } = await getBusStopProfile(services.actRealtime, parent.code);
                return longitude;
            } catch (error) {
                throw new Error(
                    `Failed to fetch longitude for code ${parent.code}: ${error instanceof Error ? error.message : 'Unknown error'}`
                );
            }
        },
    },
};

export default resolvers;
