export type DataSource = 'ACT_REALTIME' | 'GTFS_REALTIME';

const resolvers = {
    Query: {
        health: () => 'GraphQL server is running!',
    },
    Subscription: {
        ping: {
            subscribe: async function* () {
                while (true) {
                    yield { ping: new Date().toISOString() };
                    await new Promise((resolve) => setTimeout(resolve, 30000)); // 30 seconds
                }
            },
        },
    },
};

export default resolvers;
