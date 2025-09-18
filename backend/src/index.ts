import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { useGraphQLSSE } from '@graphql-yoga/plugin-graphql-sse';
import { loadFilesSync } from '@graphql-tools/load-files';
import { mergeTypeDefs, mergeResolvers } from '@graphql-tools/merge';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { DateTimeResolver, JSONResolver } from 'graphql-scalars';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from './utils/config.js';

// Import individual resolvers
import { rootResolver } from './schema/root/root.resolver.js';
import { busPositionResolver } from './schema/busPosition/busPosition.resolver.js';
import { stopPredictionResolver } from './schema/stopPrediction/stopPrediction.resolver.js';
import { acTransitAlertResolver } from './schema/acTransitAlert/acTransitAlert.resolver.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load all GraphQL schema files
const typesArray = loadFilesSync(path.join(__dirname, './schema/**/*.graphql'));
const typeDefs = mergeTypeDefs(typesArray);

// Merge all resolvers from individual files
const resolvers = mergeResolvers([
    // GraphQL scalar resolvers
    { DateTime: DateTimeResolver, JSON: JSONResolver },
    // Domain-specific resolvers
    rootResolver,
    busPositionResolver,
    stopPredictionResolver,
    acTransitAlertResolver,
]);

// Create executable schema
const schema = makeExecutableSchema({
    typeDefs,
    resolvers,
});

// Create Yoga instance with the schema
const yoga = createYoga({
    schema,
    cors: {
        origin: config.FRONTEND_URL,
        credentials: true,
    },
    plugins: [
        useGraphQLSSE(), // Enable Server-Sent Events for subscriptions
    ],
    maskedErrors: config.NODE_ENV === 'production',
    landingPage: config.NODE_ENV !== 'production',
});

// Create HTTP server
const server = createServer(yoga);

const port = config.PORT;

server.listen(port, () => {
    console.log(`🚀 GraphQL server is running on http://localhost:${port}/graphql`);
    console.log(`📊 GraphQL playground available at http://localhost:${port}/graphql`);
    console.log(`🔄 Polling interval: ${config.POLLING_INTERVAL}ms`);
    console.log(`🌍 Environment: ${config.NODE_ENV}`);
});
