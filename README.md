# Where is Bus 51B?

### Status: In early development

A real-time dashboard for tracking AC Transit Bus Line 51B using GraphQL subscriptions, providing live bus positions and
arrival predictions for specific stops.

## Project Goals

Build a responsive web dashboard that helps commuters track Bus 51B in real-time, showing:

- Live bus positions on a map
- Predicted arrival times at selected stops
- Direction-specific tracking
- Real-time updates via GraphQL subscriptions

## Tech Stack

### Backend

- **GraphQL Yoga** - Lightweight GraphQL server with built-in subscription support
- **Node.js** - Runtime environment
- **gtfs-realtime-bindings** - For parsing AC Transit's protobuf data
- **node-fetch** - HTTP client for API calls
- **graphql-sse** - Server-Sent Events support for subscriptions (via Yoga plugin)
- **graphql-scalars** - Extended scalar types (DateTime, JSON)
- **ioredis** - Redis client with automatic fallback to memory cache
- **Zod** - Runtime validation for environment variables

### Frontend

- **Vite** - Fast build tool and frontend server
- **React 19** - UI framework
- **urql** - Lightweight GraphQL client with SSE subscription support
- **Tailwind CSS v4** - Utility-first styling with the `@tailwindcss/vite` plugin
- **Leaflet/Mapbox** - Interactive map visualization
- **TypeScript** - Type-safe components and GraphQL hooks

### Data Source

1. **ACT RealTime API** (JSON)
    - Vehicle Positions: `https://api.actransit.org/transit/actrealtime/vehiclepositions`
    - Stop Predictions: `https://api.actransit.org/transit/actrealtime/prediction`
    - Service Alerts: `https://api.actransit.org/transit/actrealtime/servicebulletin`
    - System Time: `https://api.actransit.org/transit/actrealtime/time`
    - Stop Profiles: `https://api.actransit.org/transit/actrealtime/stop`

2. **GTFS-Realtime Feeds** (Binary Protobuf)
    - Vehicle Positions: `https://api.actransit.org/transit/gtfsrt/vehicles`
    - Trip Updates: `https://api.actransit.org/transit/gtfsrt/tripupdates`
    - Service Alerts: `https://api.actransit.org/transit/gtfsrt/alerts`

3. **GTFS Static** (ZIP file with CSVs)
    - Routes, stops, stop times, shapes
    - Updated ~3 times per year

## Milestones

### MVP (Phase 1)

- [x] Display real-time arrival predictions for 2 pre-selected stops
- [x] Show bus direction (inbound/outbound)
- [x] Auto-refresh every 15 seconds
- [ ] Simple, clean UI with countdown timers
- [ ] Mobile-responsive design

### Enhanced (Phase 2)

- [ ] Interactive map showing bus positions
- [ ] Visual route line on map
- [ ] Stop markers with click-to-select
- [ ] Multiple bus tracking (all 51B vehicles)
- [ ] Service alerts integration

### Future (Phase 3)

- [ ] User preferences (save favorite stops)
- [ ] Multiple route support
- [ ] Arrival notifications
- [ ] Historical data/patterns
- [ ] PWA with offline support

## Architecture

```
┌─────────────────────────────┐
│       AC Transit APIs       │
│  actrealtime JSON | gtfsrt  │
└──────────────┬──────────────┘
               │ HTTP polling
      ┌────────▼─────────────┐
      │ GraphQL Yoga         │
      │ services:            │
      │  • actRealtime       │
      │  • gtfsRealtime      │
      │ formatters:          │
      │  • busPosition       │
      │  • busStop           │
      │  • busStopPrediction │
      │ cache: Redis / mem   │
      └────────┬─────────────┘
               │ GraphQL over HTTP/SSE
┌──────────────▼──────────────┐
│ React client (work in prog.)│
│ dashboard + map UI          │
└─────────────────────────────┘
```

The backend fetches from both ACT RealTime (JSON) and GTFS-Realtime (protobuf) feeds based on client requests,
normalizes the data through dedicated formatter utilities, and serves consistent GraphQL types.

Subscriptions stream over GraphQL Yoga using Server‑Sent Events.

### Implementation Notes

- **No Route Filtering**: AC Transit API returns all routes - filtering happens in backend
- **Timestamp Format**: Uses Long (64-bit integers) from protobuf, converted to Date objects
- **Direction**: `directionId` 0 = Outbound, 1 = Inbound
- **Multilingual Alerts**: Alerts include Spanish/Chinese translations separated by `---`

### Stop Identifier Confusion (Important!)

AC Transit uses two different identifier systems for bus stops, and the naming is confusing:

1. **stop_id** (GTFS Standard)
    - Sequential internal identifier (e.g., "1234", "5678")
    - Used in GTFS-Realtime feeds (protobuf)
    - Used in GTFS static data (stops.txt)
    - Primary key in the GTFS ecosystem

2. **stop_code** (Public-facing)
    - 5-digit code displayed on physical bus stop signs (e.g., "55555", "58883")
    - What passengers see and use to identify stops
    - Human-readable and consistent across systems
    - **CONFUSING**: AC Transit's proprietary REST API calls this field "StopId" or "stpid" even though it's actually the stop_code!

**Critical Integration Note**:

- GTFS-Realtime predictions use actual `stop_id` values
- AC Transit REST API predictions use `stop_code` values but confusingly label them as "StopId/stpid"
- The backend must map between these identifiers using GTFS static data (stops.txt) which contains both fields
- When the AC Transit API returns "StopId": "55555", this is actually the stop_code, not the GTFS stop_id

## Getting Started

### Prerequisites

```bash
node >= 18.0.0
npm >= 9.0.0
```

### Installation

1. Clone the repository

```bash
git clone https://github.com/nathanchica/where-is-51b.git
cd where-is-51b
```

2. Install dependencies

```bash
npm install
```

3. Set up environment variables

```bash
# backend/.env
AC_TRANSIT_TOKEN=your_token_here           # REQUIRED - Get from AC Transit Developer Portal

# Optional - sensible defaults are provided
PORT=4000                                  # Default: 4000
NODE_ENV=development                       # Default: development
FRONTEND_URL=http://localhost:5173         # Default: 5173 (used for CORS)
POLLING_INTERVAL=15000                     # Default: 15000ms (15 seconds)
ACTRANSITALERTS_POLLING_INTERVAL=60000     # Default: 60000ms (60 seconds)
REDIS_URL=redis://localhost:6379           # Optional, falls back to memory cache
ENABLE_CACHE=true                          # Default: true
CACHE_TTL_VEHICLE_POSITIONS=10             # Seconds (default: 10)
CACHE_TTL_PREDICTIONS=15                   # Seconds (default: 15)
CACHE_TTL_SERVICE_ALERTS=300               # Seconds (default: 300)
CACHE_TTL_BUS_STOP_PROFILES=86400          # Seconds (default: 86400)
CACHE_CLEANUP_THRESHOLD=100                # Default: 100 cached entries
AC_TRANSIT_API_BASE_URL=https://api.actransit.org/transit
ACT_REALTIME_API_BASE_URL=https://api.actransit.org/transit/actrealtime
GTFS_REALTIME_API_BASE_URL=https://api.actransit.org/transit/gtfsrt

# frontend/.env
VITE_GRAPHQL_HTTP_URL=http://localhost:4000/graphql
VITE_GRAPHQL_SSE_URL=http://localhost:4000/graphql
```

> **Note**: The backend will validate all environment variables on startup using Zod.
> If validation fails, you'll see clear error messages indicating which variables are misconfigured.

4. Start development servers concurrently

```bash
npm run dev
```

## GraphQL Schema

```graphql
scalar DateTime
scalar JSON

enum DataSource {
    ACT_REALTIME # AC Transit proprietary REST API (JSON)
    GTFS_REALTIME # GTFS-Realtime trip updates feed (protobuf)
}

enum BusDirection {
    INBOUND # Toward Rockridge BART
    OUTBOUND # Toward Berkeley Amtrak
}

type BusPosition {
    vehicleId: String!
    routeId: String!
    latitude: Float!
    longitude: Float!
    heading: Float
    speed: Float
    timestamp: DateTime!
    tripId: String
    stopSequence: Int
}

type BusStop {
    id: String!
    code: String!
    name: String!
    latitude: Float!
    longitude: Float!
}

type BusStopPrediction {
    vehicleId: String!
    tripId: String!
    arrivalTime: DateTime!
    departureTime: DateTime!
    minutesAway: Int!
    isOutbound: Boolean!
    distanceToStopFeet: Int
}

type ACTransitAlert {
    id: String!
    headerText: String!
    descriptionText: String
    severity: ACTransitAlertSeverity!
    startTime: DateTime
    endTime: DateTime
    affectedRoutes: [String!]!
    affectedStops: [String!]!
}

enum ACTransitAlertSeverity {
    INFO
    WARNING
    SEVERE
}

type Query {
    health: String!
    busPositions(routeId: String!, source: DataSource = ACT_REALTIME): [BusPosition!]!
    busStop(busStopCode: String!): BusStop
    busStopPredictions(
        routeId: String!
        stopCode: String!
        direction: BusDirection!
        source: DataSource = ACT_REALTIME
    ): [BusStopPrediction!]!
    acTransitAlerts(routeId: String): [ACTransitAlert!]!
}

type Subscription {
    ping: String!
    systemTime: DateTime!
    busPositions(routeId: String!, source: DataSource = ACT_REALTIME): [BusPosition!]!
    busStopPredictions(
        routeId: String!
        stopCode: String!
        direction: BusDirection!
        source: DataSource = ACT_REALTIME
    ): [BusStopPrediction!]!
    acTransitAlerts(routeId: String): [ACTransitAlert!]!
}
```

## Environment Variable Management

The backend uses **Zod** for runtime validation and type-safe environment variables. This ensures configuration errors are caught at startup, not runtime.

### Configuration Convention

All environment variables are defined and validated in `backend/src/utils/config.ts`:

```typescript
// backend/src/utils/config.ts
const envSchema = z.object({
    // Server Configuration
    PORT: z.coerce.number().min(1).max(65535).default(4000),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    FRONTEND_URL: z.url().default('http://localhost:5173'),

    // Polling configuration
    POLLING_INTERVAL: z.coerce.number().min(5000).max(300000).default(15000),
    ACTRANSITALERTS_POLLING_INTERVAL: z.coerce.number().min(30000).max(600000).default(60000),

    // AC Transit auth & base URLs
    AC_TRANSIT_TOKEN: z.string().default(''),
    AC_TRANSIT_API_BASE_URL: z.url().default('https://api.actransit.org/transit'),
    ACT_REALTIME_API_BASE_URL: z.url().default('https://api.actransit.org/transit/actrealtime'),
    GTFS_REALTIME_API_BASE_URL: z.url().default('https://api.actransit.org/transit/gtfsrt'),

    // Cache configuration
    REDIS_URL: z.string().optional(),
    ENABLE_CACHE: z
        .enum(['true', 'false'])
        .default('true')
        .transform((val) => val === 'true'),
    CACHE_TTL_VEHICLE_POSITIONS: z.coerce.number().min(5).max(300).default(10),
    CACHE_TTL_PREDICTIONS: z.coerce.number().min(5).max(300).default(15),
    CACHE_TTL_SERVICE_ALERTS: z.coerce.number().min(60).max(3600).default(300),
    CACHE_TTL_BUS_STOP_PROFILES: z.coerce.number().min(3600).max(604800).default(86400),
    CACHE_CLEANUP_THRESHOLD: z.coerce.number().min(50).max(1000).default(100),
});
```

### Key Features

- **Type Safety**: Full TypeScript support with exported `Env` type
- **Runtime Validation**: Validates all env vars on startup
- **Automatic Coercion**: Converts string env vars to proper types (numbers, booleans)
- **Clear Error Messages**: Shows exactly which env vars are misconfigured
- **Sensible Defaults**: Most variables have defaults for development

### Usage

```typescript
// Import the validated config
import config from './utils/config.js';

// Use with full type safety
const port = config.PORT; // number
const isDev = config.NODE_ENV === 'development'; // boolean
```

### Adding New Environment Variables

1. Add the variable to the schema in `backend/src/utils/config.ts`
2. Define validation rules and defaults
3. Use the exported config object throughout the codebase
4. The app will fail fast on startup if validation fails

## Service Architecture

The backend implements a layered approach that separates data fetching from transformation:

```
AC Transit APIs (actrealtime JSON / gtfsrt protobuf)
         │
         ▼
┌─────────────────────────────┐
│ Services                    │
│  actRealtime.ts             │ ← batched REST fetching & caching
│  gtfsRealtime.ts            │ ← protobuf fetch + filtering + caching
└─────────┬───────────────────┘
         ▼
┌─────────────────────────────┐
│ Formatters                  │
│  busPosition.ts             │ ← normalize raw payloads
│  busStop.ts                 │
│  busStopPrediction.ts       │
└─────────┬───────────────────┘
         ▼
┌─────────────────────────────┐
│ GraphQL resolvers           │
│  schema/*                   │ ← APIs & subscriptions
└─────────────────────────────┘
```

### Data flow highlights

- **Batched requests**: `actRealtime.fetchBusStopProfiles` and `fetchBusStopPredictions` bundle up to 10 stop codes per call and cache results.
- **Formatter layer**: Raw JSON/protobuf payloads are converted into consistent GraphQL-friendly objects before hitting resolvers.
- **Resolver hydration**: Bus stop resolvers lazily fetch additional metadata when a field isn’t already provided by upstream formatters.

## Project Structure

```
where-is-51b/
├── backend/
│   ├── src/
│   │   ├── context.ts
│   │   ├── formatters/
│   │   │   ├── busPosition.ts
│   │   │   ├── busStop.ts
│   │   │   └── busStopPrediction.ts
│   │   ├── index.ts
│   │   ├── schema/
│   │   │   ├── acTransit/
│   │   │   ├── acTransitAlert/
│   │   │   ├── busPosition/
│   │   │   ├── busStop/
│   │   │   ├── busStopPredictions/
│   │   │   └── root/
│   │   ├── services/
│   │   │   ├── actRealtime.ts
│   │   │   └── gtfsRealtime.ts
│   │   └── utils/
│   │       ├── cache.ts
│   │       ├── config.ts
│   │       └── datetime.ts
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── SystemTime.tsx
│   │   ├── App.tsx
│   │   ├── index.css
│   │   ├── main.tsx
│   │   └── config/
│   │       └── bus-stops.json
│   ├── package.json
│   └── vite.config.ts
├── package.json
└── README.md
```

## Testing

```bash
npm test
```

## Caching Strategy

The backend implements a **hybrid caching system** that automatically adapts to your environment:

### How It Works

1. **Production (with Redis)**: Uses Redis for distributed caching
2. **Development (no Redis)**: Falls back to in-memory cache

### Cache Implementation

```typescript
// backend/src/utils/cache.ts
class HybridCache {
    // Uses Redis when configured, otherwise stores entries in-memory
}

// Services call the helper so cache lookups and refreshes stay consistent
import { getCachedOrFetch } from '../utils/cache.js';
import config from '../utils/config.js';

const cacheKey = `vehicle-positions:${routeId ?? 'all'}`;
const positions = await getCachedOrFetch(
    cacheKey,
    () => fetchVehiclePositionsFromApi(routeId),
    config.CACHE_TTL_VEHICLE_POSITIONS
);
```

### Cache TTLs

- **Vehicle Positions**: 10 seconds (real-time data)
- **Trip Updates**: 15 seconds (predictions)
- **Service Alerts**: 5 minutes (rarely changes)
- **Bus Stop Profiles**: 24 hours (metadata rarely changes)
- **Bus Stop Predictions**: 30 seconds (real-time predictions)

## Performance Considerations

- **Caching**: Reduces AC Transit API calls
- **Debouncing**: Limit subscription updates to prevent UI thrashing
- **Lazy Loading**: Load map component only when needed
- **Data Filtering**: Filter data server-side to reduce payload size
- **Connection Pooling**: Reuse WebSocket connections

## Error Handling

- Graceful degradation when API is unavailable
- Retry logic with exponential backoff
- User-friendly error messages
- Fallback to cached data when possible
- Connection status indicators

## Security

- Environment variables for sensitive data
- CORS configuration for production
- Rate limiting on GraphQL endpoint
- Input validation on all queries
- No API tokens exposed to client

## Deployment

Render for backend and Vercel for frontend

---

**Note**: This project is not affiliated with AC Transit. It uses publicly available GTFS data to provide real-time bus tracking information.
