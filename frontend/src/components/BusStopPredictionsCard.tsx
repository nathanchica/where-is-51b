import { gql, useSubscription } from 'urql';

import BusStopCardHeader from './BusStopCardHeader';

const BUS_STOP_PREDICTIONS_SUBSCRIPTION = gql`
    subscription BusStopPredictions($routeId: String!, $direction: BusDirection!, $stopCode: String!) {
        busStopPredictions(routeId: $routeId, direction: $direction, stopCode: $stopCode) {
            vehicleId
            tripId
            arrivalTime
            departureTime
            minutesAway
            isOutbound
            distanceToStopFeet
        }
    }
`;

type BusStopPrediction = {
    vehicleId: string;
    tripId: string;
    arrivalTime: string;
    departureTime: string;
    minutesAway: number;
    isOutbound: boolean;
    distanceToStopFeet: number | null;
};

type BusStopPredictionsPayload = {
    busStopPredictions: BusStopPrediction[];
};

type BusDirection = 'INBOUND' | 'OUTBOUND';

type BusStopPredictionsCardProps = {
    routeId: string;
    direction: BusDirection;
    stopCode: string;
};

function formatClockTime(isoString: string) {
    const dateTime = new Date(isoString);
    if (Number.isNaN(dateTime.getTime())) {
        return '—';
    }

    return dateTime.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
    });
}

function formatDistance(feet: number | null) {
    if (feet === null) {
        return null;
    }

    if (feet < 1000) {
        return `${feet.toLocaleString()} ft away`;
    }

    const miles = feet / 5280;
    const rounded = Math.max(0.1, Math.round(miles * 10) / 10);
    return `${rounded.toFixed(1)} mi away`;
}

function BusStopPredictionsCard({ routeId, direction, stopCode }: BusStopPredictionsCardProps) {
    const [{ data, error, fetching }] = useSubscription<BusStopPredictionsPayload>({
        query: BUS_STOP_PREDICTIONS_SUBSCRIPTION,
        variables: {
            routeId,
            direction,
            stopCode,
        },
    });

    const predictions = data?.busStopPredictions ?? [];
    const isLoading = fetching && !data;
    const directionLabel = direction === 'INBOUND' ? 'Inbound' : 'Outbound';

    const accessibilityProps = isLoading
        ? {
              role: 'status' as const,
              'aria-live': 'polite' as const,
              'aria-busy': 'true' as const,
          }
        : {};

    return (
        <section
            className="rounded-xl border border-slate-800 bg-slate-900/80 p-6"
            aria-label={`${directionLabel} arrivals for route ${routeId} at stop ${stopCode}`}
            {...accessibilityProps}
        >
            <BusStopCardHeader busStopCode={stopCode} />
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
                {directionLabel} arrivals
            </p>

            {error ? (
                <div
                    className="mt-4 rounded-lg border border-red-500/60 bg-red-500/10 p-4 text-sm text-red-200"
                    role="alert"
                >
                    <p className="font-medium">Subscription error</p>
                    <p>{error.message}</p>
                </div>
            ) : null}

            <div className="mt-4 space-y-3">
                {isLoading ? (
                    <>
                        <div className="h-16 w-full rounded-lg shimmer" aria-hidden="true" />
                        <div className="h-16 w-full rounded-lg shimmer" aria-hidden="true" />
                        <span className="sr-only">Loading predicted arrivals</span>
                    </>
                ) : null}

                {!isLoading && predictions.length === 0 ? (
                    <p className="text-sm text-slate-400">No upcoming arrivals are available right now.</p>
                ) : null}

                {!isLoading && predictions.length > 0
                    ? predictions.map((prediction) => {
                          const minutesAway = Math.max(0, prediction.minutesAway);
                          const formattedArrival = formatClockTime(prediction.arrivalTime);
                          const distance = formatDistance(prediction.distanceToStopFeet);

                          return (
                              <article
                                  key={`${prediction.tripId}-${prediction.vehicleId}-${prediction.arrivalTime}`}
                                  className="flex items-center justify-between rounded-xl border border-slate-800/70 bg-slate-900/60 px-4 py-3"
                              >
                                  <div>
                                      <p className="text-2xl font-semibold text-slate-100">{minutesAway} min</p>
                                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Until arrival</p>
                                  </div>
                                  <div className="text-right text-sm text-slate-300">
                                      <p className="font-medium">Vehicle {prediction.vehicleId || '?'}</p>
                                      <p className="text-slate-400">ETA {formattedArrival}</p>
                                      {distance ? <p className="text-xs text-slate-500">{distance}</p> : null}
                                  </div>
                              </article>
                          );
                      })
                    : null}
            </div>
        </section>
    );
}

export default BusStopPredictionsCard;
