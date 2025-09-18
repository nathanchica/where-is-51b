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
    - Vehicle Positions: `https://api.actransit.org/transit/gtfs-realtime/vehicle-positions`
    - Trip Updates: `https://api.actransit.org/transit/gtfs-realtime/trip-updates`
    - Service Alerts: `https://api.actransit.org/transit/gtfs-realtime/service-alerts`

2. **GTFS Static** (ZIP file with CSVs)
    - Routes, stops, stop times, shapes
    - Updated ~3 times per year

3. **REST API** (Requires registration)
    - More granular queries
    - JSON responses
    - Token required: `?token=YOUR_TOKEN`

### Polling Strategy

- **Frequency**: Every 15-30 seconds (matches AC Transit update rate)
- **Caching**: Store latest data to reduce API calls
- **Error Handling**: Exponential backoff on failures

## 🚀 Getting Started

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

4. Set up environment variables

```bash
# backend/.env
PORT=4000
POLLING_INTERVAL=15000
AC_TRANSIT_TOKEN=your_token_here # Optional, only if using REST API

# frontend/.env
VITE_GRAPHQL_HTTP_URL=http://localhost:4000/graphql
VITE_GRAPHQL_WS_URL=ws://localhost:4000/graphql
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
    directionId: Int!
    latitude: Float!
    longitude: Float!
    heading: Float
    speed: Float
    timestamp: Int!
}

type StopPrediction {
    stopId: String!
    stopName: String!
    direction: String!
    arrivals: [Arrival!]!
}

type Arrival {
    vehicleId: String!
    tripId: String!
    arrivalTime: Int!
    departureTime: Int!
    minutesAway: Int!
}

type Query {
    busPositions(routeId: String!): [BusPosition!]!
    stopPredictions(routeId: String!, stopIds: [String!]!): [StopPrediction!]!
}

type Subscription {
    busPositions(routeId: String!): [BusPosition!]!
    stopPredictions(routeId: String!, stopIds: [String!]!): [StopPrediction!]!
}
```

## Project Structure

```
where-is-51b/
├── backend/
│   ├── src/
│   │   ├── index.ts           # Server entry point
│   │   ├── schema.ts          # GraphQL schema
│   │   ├── resolvers.ts       # GraphQL resolvers
│   │   ├── services/
│   │   │   ├── acTransit.ts   # AC Transit API client
│   │   │   └── gtfsParser.ts  # GTFS protobuf parser
│   │   └── utils/
│   │       └── cache.ts       # Caching logic
│   ├── package.json
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

## Performance Considerations

- **Caching**: Implement server-side caching to reduce API calls
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
