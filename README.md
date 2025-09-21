# Where is Bus 51B?

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
- **graphql-ws** - WebSocket support for subscriptions
- **graphql-scalars** - Extended scalar types (DateTime, JSON)
- **ioredis** - Redis client with automatic fallback to memory cache
- **Zod** - Runtime validation for environment variables

### Frontend

- **Vite** - Fast build tool and frontend server
- **React 19** - UI framework
- **Apollo Client** - GraphQL client with subscription support
- **Leaflet/Mapbox** - Interactive map visualization
- **Tailwind CSS** - Utility-first styling

### Data Source

- **AC Transit GTFS-Realtime API** - Real-time bus positions and predictions
- **AC Transit GTFS Static** - Route shapes, stop locations, schedules

## Features

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

## 🏗 Architecture

```
┌─────────────────┐
│   AC Transit    │
│   GTFS APIs     │
└────────┬────────┘
         │ HTTP Polling
         │ (every 15s)
┌────────▼────────┐
│  GraphQL Yoga   │
│     Server      │
│                 │
│ - Fetches data  │
│ - Parses GTFS   │
│ - Filters 51B   │
│ - Manages subs  │
└────────┬────────┘
         │ WebSocket
         │ (GraphQL Subscriptions)
┌────────▼────────┐
│  React Client   │
│  Apollo Client  │
│                 │
│ - Subscribe to  │
│   updates       │
│ - Display UI    │
│ - Map view      │
└─────────────────┘
```

## API Integration

### Data Sources

1. **GTFS-Realtime Feeds** (Binary Protobuf)
    - Vehicle Positions: `https://api.actransit.org/transit/gtfsrt/vehicles`
    - Trip Updates: `https://api.actransit.org/transit/gtfsrt/tripupdates`
    - Service Alerts: `https://api.actransit.org/transit/gtfsrt/alerts`

2. **GTFS Static** (ZIP file with CSVs)
    - Routes, stops, stop times, shapes
    - Updated ~3 times per year

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
- AC Transit REST API predictions use `stop_code` values but confusingly labels them as "StopId/stpid"
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
POLLING_INTERVAL=15000                     # Default: 15000ms (15 seconds)
ACTRANSITALERTS_POLLING_INTERVAL=60000     # Default: 60000ms (60 seconds)
REDIS_URL=redis://localhost:6379           # Optional, falls back to memory cache
ENABLE_CACHE=true                          # Default: true

# frontend/.env
VITE_GRAPHQL_HTTP_URL=http://localhost:4000/graphql
VITE_GRAPHQL_WS_URL=ws://localhost:4000/graphql
```

> **Note**: The backend will validate all environment variables on startup using Zod.
> If validation fails, you'll see clear error messages indicating which variables are misconfigured.

4. Test the AC Transit API connection

```bash
cd backend
npx tsx src/services/testFetch.ts  # Test raw API fetching
npx tsx src/services/testParser.ts # Test data parsing
```

5. Start development servers concurrently

```bash
npm run dev
```

## GraphQL Schema

```graphql
type BusPosition {
    vehicleId: String!
    routeId: String!
    isOutbound: Boolean! # True if heading away from downtown
    latitude: Float!
    longitude: Float!
    heading: Float
    speed: Float
    timestamp: DateTime! # ISO 8601 DateTime
    tripId: String
    stopSequence: Int
}

# Bus Stop Predictions Types
type BusStop {
    id: String! # GTFS stop identifier (sequential ID, e.g., "1234")
    code: String! # Public stop code (5-digit code on bus stop signs, e.g., "55555")
    name: String! # Human-readable stop name
    latitude: Float!
    longitude: Float!
}

type Arrival {
    vehicleId: String!
    tripId: String! # GTFS trip identifier
    arrivalTime: DateTime!
    departureTime: DateTime! # May be same as arrival for most stops
    minutesAway: Int!
    isOutbound: Boolean! # True if bus is heading outbound (away from downtown)
    distanceToStopFeet: Int # Distance in feet from the bus to the stop (null for GTFS-RT source)
}

type BusStopPredictions {
    busStop: BusStop!
    direction: String! # e.g., "Berkeley Amtrak (Outbound)" or "Rockridge BART (Inbound)"
    arrivals: [Arrival!]!
    source: PredictionSource! # Data source for these predictions
}

enum Direction {
    INBOUND # Towards Rockridge BART (directionId = 0 in GTFS)
    OUTBOUND # Towards Berkeley Amtrak (directionId = 1 in GTFS)
}

enum PredictionSource {
    GtfsRealtime # GTFS-Realtime standard trip updates feed (protobuf format)
    ActRealtime # AC Transit proprietary real-time API (JSON format)
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
    busPositions(routeId: String!): [BusPosition!]!
    busStopPredictions(
        routeId: String! # Route ID (e.g., "51B")
        stopId: String! # Single stop code (e.g., "55555")
        direction: Direction! # Required direction filter
    ): BusStopPredictions # Returns null if no predictions available
    acTransitAlerts(routeId: String): [ACTransitAlert!]!
}

type Subscription {
    ping: String!
    busPositions(routeId: String!): [BusPosition!]!
    busStopPredictions(
        routeId: String! # Route ID (e.g., "51B")
        stopId: String! # Single stop code (e.g., "55555")
        direction: Direction! # Required direction filter
    ): BusStopPredictions # Returns null if no predictions available
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

    // API Configuration
    AC_TRANSIT_TOKEN: z.string().default(''),
    POLLING_INTERVAL: z.coerce.number().min(5000).max(300000).default(15000),
    ACTRANSITALERTS_POLLING_INTERVAL: z.coerce.number().min(30000).max(600000).default(60000),

    // Cache Configuration
    REDIS_URL: z.string().optional(), // Optional - falls back to memory cache
    ENABLE_CACHE: z
        .enum(['true', 'false'])
        .default('true')
        .transform((val) => val === 'true'),

    // URLs with validation
    FRONTEND_URL: z.url().default('http://localhost:5173'),
    AC_TRANSIT_VEHICLE_POSITIONS_URL: z.url().default('...'),
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

The backend implements a clean layered architecture with optimized data fetching:

```
AC Transit APIs (GTFS-RT & REST)
         │
         ▼
┌─────────────────────────┐
│  acTransit.ts           │ ← Service Layer
│  - Batched API calls    │
│  - Up to 10 stops/call  │
│  - Smart caching        │
│  - Auth handling        │
└─────────┬───────────────┘
         ▼
┌─────────────────────────┐
│  Parsers               │ ← Parser Layer
│  - gtfsParser.ts        │
│  - actRealtimeParser.ts │
│  - Minimal BusStop data │
│  - Type transforms      │
└─────────┬───────────────┘
         ▼
┌─────────────────────────┐
│  GraphQL Resolvers      │ ← API Layer
│  - Field resolvers      │
│  - Lazy data loading    │
│  - Subscriptions        │
└─────────────────────────┘
```

### Key Architectural Patterns

#### 1. Batched API Calls

The `acTransit.ts` service layer now supports batched requests for both stop metadata and predictions:

- `fetchBusStopProfiles(stopCodes[])` - Fetches complete stop metadata in batches of 10
- `fetchBusStopPredictions(stopCodes[])` - Fetches arrival predictions in batches of 10

#### 2. Field Resolvers for Lazy Loading

BusStop fields are resolved on-demand through GraphQL field resolvers:

```typescript
// Parser returns minimal data
busStop: {
    __typename: 'BusStop',
    code: '55555'  // Only the stop code
}

// Field resolvers fetch additional data when requested
BusStop: {
    id: async (parent) => // Fetches from API if needed
    name: async (parent) => // Fetches from API if needed
    latitude: async (parent) => // Fetches from API if needed
    longitude: async (parent) => // Fetches from API if needed
}
```

#### 3. Unified Stop Data Fetching

Both GTFS-RT and AC Transit REST parsers now use the same simplified approach:

- Parsers return minimal BusStop objects with just `__typename` and `code` or `id`
- Field resolvers handle fetching additional data through `fetchBusStopProfiles`
- Eliminates duplicate metadata fetching logic

## Project Structure

```
where-is-51b/
├── backend/
│   ├── src/
│   │   ├── index.ts           # Server entry point
│   │   ├── schema/           # GraphQL schema definitions
│   │   │   ├── root/
│   │   │   │   ├── root.graphql
│   │   │   │   └── root.resolver.ts
│   │   │   ├── busPosition/
│   │   │   │   ├── busPosition.graphql
│   │   │   │   └── busPosition.resolver.ts
│   │   │   ├── busStopPredictions/
│   │   │   │   ├── busStopPredictions.graphql
│   │   │   │   └── busStopPredictions.resolver.ts
│   │   │   └── acTransitAlert/
│   │   │       ├── acTransitAlert.graphql
│   │   │       └── acTransitAlert.resolver.ts
│   │   ├── services/
│   │   │   ├── acTransit.ts        # AC Transit API client (batched fetching, caching)
│   │   │   ├── gtfsParser.ts       # GTFS-RT parser (protobuf to GraphQL types)
│   │   │   └── actRealtimeParser.ts # AC Transit REST API parser
│   │   └── utils/
│   │       ├── config.ts      # Zod env validation & config
│   │       └── cache.ts       # Caching logic
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── main.tsx          # React entry point
│   │   ├── App.tsx           # Main app component
│   │   ├── components/
│   │   │   ├── Dashboard.tsx # Main dashboard
│   │   │   ├── ArrivalCard.tsx
│   │   │   ├── BusMap.tsx
│   │   │   └── DirectionToggle.tsx
│   │   ├── hooks/
│   │   │   └── useBusTracking.ts
│   │   ├── graphql/
│   │   │   ├── client.ts     # Apollo client setup
│   │   │   └── queries.ts    # GraphQL queries/subscriptions
│   │   └── styles/
│   ├── package.json
│   ├── vite.config.js
│   └── .env
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
    // Attempts Redis connection if REDIS_URL is set
    // Falls back to Map-based memory cache if Redis unavailable
    // Seamless operation in both environments
}

// Usage in services
import { cache, CACHE_KEYS, CACHE_TTL } from './utils/cache.js';

const data = await cache.get(CACHE_KEYS.VEHICLE_POSITIONS('51B'));
if (!data) {
    const fresh = await fetchFromAPI();
    await cache.set(key, fresh, CACHE_TTL.VEHICLE_POSITIONS);
}
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
