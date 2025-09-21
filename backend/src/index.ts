import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadFilesSync } from '@graphql-tools/load-files';
import { mergeTypeDefs, mergeResolvers } from '@graphql-tools/merge';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { useGraphQLSSE } from '@graphql-yoga/plugin-graphql-sse';
import { DateTimeResolver, JSONResolver } from 'graphql-scalars';
import { createYoga } from 'graphql-yoga';

import { createContext, Context } from './context.js';
import acTransitResolvers from './schema/acTransit/acTransit.resolver.js';
import { acTransitAlertResolver } from './schema/acTransitAlert/acTransitAlert.resolver.js';
import busPositionResolvers from './schema/busPosition/busPosition.resolver.js';
import busStopResolvers from './schema/busStop/busStop.resolver.js';
import busStopPredictionsResolvers from './schema/busStopPredictions/busStopPredictions.resolver.js';
import rootResolvers from './schema/root/root.resolver.js';
import config from './utils/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load all GraphQL schema files
const schemaDirs = [path.join(__dirname, './schema'), path.join(__dirname, '../src/schema')].filter((dir) =>
    existsSync(dir)
);

if (schemaDirs.length === 0) {
    throw new Error('No GraphQL schema directory found. Make sure SDL files are available.');
}

const schemaGlobs = schemaDirs.map((dir) => path.join(dir, '**/*.graphql'));
const typesArray = loadFilesSync(schemaGlobs);
const typeDefs = mergeTypeDefs(typesArray);

// Merge all resolvers from individual files
const resolvers = mergeResolvers([
    // GraphQL scalar resolvers
    { DateTime: DateTimeResolver, JSON: JSONResolver },
    // Domain-specific resolvers
    rootResolvers,
    acTransitResolvers,
    busPositionResolvers,
    busStopResolvers,
    busStopPredictionsResolvers,
    acTransitAlertResolver,
]);

// Create executable schema
const schema = makeExecutableSchema({
    typeDefs,
    resolvers,
});

// Create Yoga instance with the schema
const yoga = createYoga<Context>({
    schema,
    cors: {
        origin: config.FRONTEND_URL,
        credentials: true,
    },
    context: createContext,
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
