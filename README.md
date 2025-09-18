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

- [ ] Display real-time arrival predictions for 2 pre-selected stops
- [ ] Show bus direction (inbound/outbound)
- [ ] Auto-refresh every 15 seconds
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

type StopPrediction {
    stopId: String!
    stopName: String!
    direction: String!
    arrivals: [Arrival!]!
    latitude: Float!
    longitude: Float!
}

type Arrival {
    vehicleId: String!
    tripId: String!
    arrivalTime: DateTime!
    departureTime: DateTime!
    minutesAway: Int!
    isOutbound: Boolean!
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
    stopPredictions(routeId: String!, stopIds: [String!]!): [StopPrediction!]!
    acTransitAlerts(routeId: String): [ACTransitAlert!]!
}

type Subscription {
    ping: String!
    busPositions(routeId: String!): [BusPosition!]!
    stopPredictions(routeId: String!, stopIds: [String!]!): [StopPrediction!]!
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

The backend implements a clean layered architecture:

```
AC Transit GTFS-RT API
         │
         ▼
┌─────────────────────┐
│  acTransit.ts       │ ← Service Layer
│  - Fetches binary   │
│  - Handles auth     │
│  - Basic filtering  │
└─────────┬───────────┘
         ▼
┌─────────────────────┐
│  gtfsParser.ts      │ ← Parser Layer
│  - Type transforms  │
│  - English extract  │
│  - Schema mapping   │
└─────────┬───────────┘
         ▼
┌─────────────────────┐
│  GraphQL Resolvers  │ ← API Layer
│  - Query handling   │
│  - Subscriptions    │
│  - Caching          │
└─────────────────────┘
```

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
│   │   │   ├── stopPrediction/
│   │   │   │   ├── stopPrediction.graphql
│   │   │   │   └── stopPrediction.resolver.ts
│   │   │   └── acTransitAlert/
│   │   │       ├── acTransitAlert.graphql
│   │   │       └── acTransitAlert.resolver.ts
│   │   ├── services/
│   │   │   ├── acTransit.ts   # AC Transit API client (fetches GTFS-RT feeds)
│   │   │   └── gtfsParser.ts  # GTFS parser (transforms protobuf to GraphQL types)
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
