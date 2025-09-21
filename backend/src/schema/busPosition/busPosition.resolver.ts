import { GraphQLError } from 'graphql';

import config from '../../utils/config.js';
import { DataSource } from '../root/root.resolver.js';
import { Context } from '../../context.js';
import { createBusPositionsFromGtfsFeed, createBusPositionsFromActRealtime } from '../../formatters/busPosition';

export type BusDirection = 'INBOUND' | 'OUTBOUND';

type BusPositionsArgs = {
    routeId: string;
    source: DataSource;
};

async function fetchBusPositions({ routeId, source }: BusPositionsArgs, services: Context['services']) {
    if (source === 'GTFS_REALTIME') {
        const busPositionsFeed = await services.gtfsRealtime.fetchVehiclePositionsForRoute(routeId);
        return createBusPositionsFromGtfsFeed(busPositionsFeed);
    }

    const rawPositions = await services.actRealtime.fetchVehiclePositions(routeId);
    return createBusPositionsFromActRealtime(rawPositions);
}

const resolvers = {
    Query: {
        busPositions: async (_parent: unknown, { routeId, source }: BusPositionsArgs, { services }: Context) => {
            try {
                return await fetchBusPositions({ routeId, source }, services);
            } catch (error) {
                console.error(`Error in busPositions query:`, error);
                if (error instanceof GraphQLError) {
                    throw error;
                }
                throw new GraphQLError(
                    `Failed to fetch bus positions: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    { extensions: { code: 'FETCH_ERROR', routeId, source } }
                );
            }
        },
    },
    Subscription: {
        busPositions: {
            subscribe: async function* (
                _parent: unknown,
                { routeId, source }: BusPositionsArgs,
                { services }: Context
            ) {
                const pollingInterval = config.POLLING_INTERVAL;

                try {
                    const initialPositions = await fetchBusPositions({ routeId, source }, services);
                    yield { busPositions: initialPositions };
                } catch (error) {
                    console.error('Initial fetch failed for busPositions subscription:', error);
                    if (error instanceof GraphQLError) {
                        throw error;
                    }

                    throw new GraphQLError(
                        `Failed to fetch bus positions: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        { extensions: { code: 'FETCH_ERROR', routeId, source } }
                    );
                }

                while (true) {
                    await new Promise((resolve) => setTimeout(resolve, pollingInterval));

                    try {
                        const positions = await fetchBusPositions({ routeId, source }, services);
                        yield { busPositions: positions };
                    } catch (error) {
                        console.error('Error in busPositions subscription polling:', error);
                        if (error instanceof GraphQLError) {
                            throw error;
                        }

                        yield { busPositions: [] };
                    }
                }
            },
        },
    },
};

export default resolvers;
