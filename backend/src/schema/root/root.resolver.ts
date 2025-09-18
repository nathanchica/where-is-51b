export const rootResolver = {
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
