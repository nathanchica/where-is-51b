import { GraphQLError } from 'graphql';

import config from '../../utils/config.js';
import { Context } from '../../context';

const resolvers = {
    Subscription: {
        systemTime: {
            subscribe: async function* (_parent: unknown, _args: unknown, { services }: Context) {
                const pollingInterval = config.POLLING_INTERVAL;

                try {
                    const initialTime = await services.actRealtime.fetchSystemTime();
                    yield { systemTime: initialTime };
                } catch (error) {
                    console.error(`Initial fetch failed for systemTime subscription:`, error);
                    if (error instanceof GraphQLError) {
                        throw error;
                    }
                    throw new GraphQLError(
                        `Failed to fetch system time: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        { extensions: { code: 'FETCH_ERROR' } }
                    );
                }

                while (true) {
                    await new Promise((resolve) => setTimeout(resolve, pollingInterval));

                    try {
                        yield { systemTime: await services.actRealtime.fetchSystemTime() };
                    } catch (error) {
                        console.error('Error in systemTime subscription polling:', error);
                        if (error instanceof GraphQLError) {
                            throw error;
                        }

                        yield { systemTime: new Date() };
                    }
                }
            },
        },
    },
};

export default resolvers;
