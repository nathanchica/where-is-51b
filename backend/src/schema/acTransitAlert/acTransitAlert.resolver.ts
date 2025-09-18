import { GraphQLError } from 'graphql';
// import config from '../../utils/config.js'; // Will be used when implementing real data fetching

export const acTransitAlertResolver = {
    Query: {
        acTransitAlerts: async (_parent: unknown, { routeId }: { routeId?: string }) => {
            console.log(`Fetching alerts${routeId ? ` for route: ${routeId}` : ''}`);
            // TODO: Implement AC Transit API call
            throw new GraphQLError('AC Transit alerts query not yet implemented');
        },
    },
    Subscription: {
        acTransitAlerts: {
            // eslint-disable-next-line require-yield
            subscribe: async function* (_parent: unknown, { routeId }: { routeId?: string }) {
                console.log(`Starting alerts subscription${routeId ? ` for route: ${routeId}` : ''}`);
                // Will use config.ACTRANSITALERTS_POLLING_INTERVAL when implemented
                // TODO: Implement real-time alerts fetching from AC Transit
                throw new GraphQLError('AC Transit alerts subscription not yet implemented');
            },
        },
    },
};
