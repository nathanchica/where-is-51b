import { GraphQLError } from 'graphql';

import { Context } from '../../context.js';
import {
    createBusStopPredictionsFromActRealtime,
    createBusStopPredictionsFromGtfsFeed,
} from '../../formatters/busStopPrediction.js';
import config from '../../utils/config.js';
import { BusDirection } from '../busPosition/busPosition.resolver.js';
import { DataSource } from '../root/root.resolver.js';

type BusStopPredictionsArgs = {
    routeId: string;
    stopCode: string;
    direction: BusDirection;
    source: DataSource;
};

async function fetchBusStopPredictions(
    { routeId, stopCode, direction, source }: BusStopPredictionsArgs,
    services: Context['services']
) {
    if (source === 'GTFS_REALTIME') {
        const busStopProfilesMap = await services.actRealtime.fetchBusStopProfiles([stopCode]);
        const busStopProfile = busStopProfilesMap.get(stopCode);

        if (!busStopProfile) {
            throw new GraphQLError(`No bus stop profile found for stop code ${stopCode}`, {
                extensions: { code: 'NOT_FOUND', stopCode },
            });
        }

        const tripUpdates = await services.gtfsRealtime.fetchTripUpdatesForRoute(routeId, busStopProfile.geoid);
        return createBusStopPredictionsFromGtfsFeed(tripUpdates, direction === 'OUTBOUND');
    }

    const rawPredictionsMap = await services.actRealtime.fetchBusStopPredictions([stopCode]);
    const rawPredictions = rawPredictionsMap.get(stopCode);

    if (!rawPredictions) {
        return [];
    }

    return createBusStopPredictionsFromActRealtime(rawPredictions, direction === 'OUTBOUND') || [];
}

const resolvers = {
    Query: {
        busStopPredictions: async (_parent: unknown, args: BusStopPredictionsArgs, { services }: Context) => {
            try {
                return await fetchBusStopPredictions(args, services);
            } catch (error) {
                console.error(`Error in stopPredictions query:`, error);
                if (error instanceof GraphQLError) {
                    throw error;
                }
                throw new GraphQLError(
                    `Failed to fetch stop predictions: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    {
                        extensions: {
                            code: 'FETCH_ERROR',
                            args,
                        },
                    }
                );
            }
        },
    },
    Subscription: {
        busStopPredictions: {
            subscribe: async function* (_parent: unknown, args: BusStopPredictionsArgs, { services }: Context) {
                const pollingInterval = config.POLLING_INTERVAL;

                try {
                    const initialPredictions = await fetchBusStopPredictions(args, services);
                    yield { busStopPredictions: initialPredictions };
                } catch (error) {
                    console.error(`Initial fetch failed for busStopPredictions subscription:`, error);
                    if (error instanceof GraphQLError) {
                        throw error;
                    }
                    throw new GraphQLError(
                        `Failed to fetch stop predictions: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        {
                            extensions: {
                                code: 'FETCH_ERROR',
                                args,
                            },
                        }
                    );
                }

                while (true) {
                    await new Promise((resolve) => setTimeout(resolve, pollingInterval));

                    try {
                        const predictions = await fetchBusStopPredictions(args, services);
                        yield { busStopPredictions: predictions };
                    } catch (error) {
                        console.error(`Error in busStopPredictions subscription polling:`, error);
                        if (error instanceof GraphQLError && error.extensions?.code === 'NOT_FOUND') {
                            throw error;
                        }
                        yield { busStopPredictions: [] };
                    }
                }
            },
        },
    },
};

export default resolvers;
