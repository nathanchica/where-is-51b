import { GraphQLError } from 'graphql';
// import config from '../../utils/config.js'; // Will be used when implementing real data fetching

export const busPositionResolver = {
    Query: {
        busPositions: async (_parent: unknown, { routeId }: { routeId: string }) => {
            console.log(`Fetching bus positions for route: ${routeId}`);
            // TODO: Implement AC Transit API call
            throw new GraphQLError('Bus position query not yet implemented');
        },
    },
    Subscription: {
        busPositions: {
            // eslint-disable-next-line require-yield
            subscribe: async function* (_parent: unknown, { routeId }: { routeId: string }) {
                console.log(`Starting bus position subscription for route: ${routeId}`);
                // Will use config.POLLING_INTERVAL when implemented
                // TODO: Implement real-time data fetching from AC Transit
                throw new GraphQLError('Bus position subscription not yet implemented');
            },
        },
    },
};
