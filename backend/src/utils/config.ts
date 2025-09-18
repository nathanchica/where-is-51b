import { z } from 'zod';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Environment variable schema with Zod v4 validation
 * Provides type safety and runtime validation for all environment variables
 */
const envSchema = z.object({
    // Server Configuration
    PORT: z.coerce.number().min(1).max(65535).default(4000),

    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    // GraphQL Configuration
    FRONTEND_URL: z.url().default('http://localhost:5173'),

    // AC Transit API Configuration
    POLLING_INTERVAL: z.coerce
        .number()
        .min(5000)
        .max(300000) // Between 5 seconds and 5 minutes
        .default(15000),

    ACTRANSITALERTS_POLLING_INTERVAL: z.coerce
        .number()
        .min(30000)
        .max(600000) // Between 30 seconds and 10 minutes
        .default(60000), // Default: 60 seconds (4x the regular polling interval)

    AC_TRANSIT_TOKEN: z.string().default(''),

    // Redis Configuration
    REDIS_URL: z.string().optional(),

    // Cache Configuration
    ENABLE_CACHE: z
        .enum(['true', 'false'])
        .default('true')
        .transform((val) => val === 'true'),

    // AC Transit API Endpoints
    AC_TRANSIT_VEHICLE_POSITIONS_URL: z
        .url()
        .default('https://api.actransit.org/transit/gtfs-realtime/vehicle-positions'),

    AC_TRANSIT_TRIP_UPDATES_URL: z.url().default('https://api.actransit.org/transit/gtfs-realtime/trip-updates'),

    AC_TRANSIT_SERVICE_ALERTS_URL: z.url().default('https://api.actransit.org/transit/gtfs-realtime/service-alerts'),
});

/**
 * Parse and validate environment variables
 * Throws an error if validation fails
 */
const parseEnv = () => {
    try {
        return envSchema.parse(process.env);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessage = error.issues
                .map((issue) => {
                    const path = issue.path.join('.');
                    return `  ❌ ${path}: ${issue.message}`;
                })
                .join('\n');

            throw new Error(
                `\n🔥 Environment validation failed:\n${errorMessage}\n\n` +
                    `Please check your .env file and ensure all required variables are set correctly.`
            );
        }
        throw error;
    }
};

// Export validated and typed environment variables
export default parseEnv();

// Export the type for use elsewhere in the application
export type Env = z.infer<typeof envSchema>;
