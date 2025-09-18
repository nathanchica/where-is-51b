import { GraphQLError } from 'graphql';
// import config from '../../utils/config.js'; // Will be used when implementing real data fetching

export const stopPredictionResolver = {
    Query: {
        stopPredictions: async (_parent: unknown, { routeId, stopIds }: { routeId: string; stopIds: string[] }) => {
            console.log(`Fetching stop predictions for route: ${routeId}, stops: ${stopIds.join(', ')}`);
            // TODO: Implement AC Transit API call
            throw new GraphQLError('Stop prediction query not yet implemented');
        },
    },
    Subscription: {
        stopPredictions: {
            // eslint-disable-next-line require-yield
            subscribe: async function* (
                _parent: unknown,
                { routeId, stopIds }: { routeId: string; stopIds: string[] }
            ) {
                console.log(
                    `Starting stop prediction subscription for route: ${routeId}, stops: ${stopIds.join(', ')}`
                );
                // Will use config.POLLING_INTERVAL when implemented
                // TODO: Implement real-time data fetching from AC Transit
                throw new GraphQLError('Stop prediction subscription not yet implemented');
            },
        },
    },
};
