import L, { type LatLngExpression, DivIcon } from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { gql, useSubscription } from 'urql';

import 'leaflet/dist/leaflet.css';

import LiveRelativeTime from './LiveRelativeTime';

import { escapeHtml } from '../utils/escapeHtml';

const BUS_POSITIONS_SUBSCRIPTION = gql`
    subscription BusPositions($routeId: String!) {
        busPositions(routeId: $routeId) {
            vehicleId
            latitude
            longitude
            heading
            speed
            timestamp
        }
    }
`;

type BusRouteMapProps = {
    routeId: string;
};

type BusPosition = {
    vehicleId: string;
    latitude: number;
    longitude: number;
    heading: number | null;
    speed: number | null;
    timestamp: string;
};

type BusPositionsPayload = {
    busPositions: BusPosition[];
};

const FALLBACK_CENTER: LatLngExpression = [37.8665, -122.2673];
const FALLBACK_ZOOM = 13;
const ICON_SIZE: [number, number] = [40, 40];
const ICON_ANCHOR: [number, number] = [20, 20];
const TOOLTIP_ANCHOR: [number, number] = [0, -24];
const VEHICLE_ID_MAX_LENGTH = 6;
const SPEED_MPS_TO_MPH = 2.23694;
const MAP_SINGLE_VEHICLE_MIN_ZOOM = 15;
const MAP_MAX_BOUNDS_ZOOM = 16;
const MAP_BOUNDS_PADDING = 0.2;

function createBusMarkerIcon(vehicleId: string | null | undefined): DivIcon {
    const trimmedId = vehicleId?.trim() ?? '';
    const label = trimmedId ? trimmedId.toUpperCase().slice(0, VEHICLE_ID_MAX_LENGTH) : '?';
    const safeVehicleId = escapeHtml(label);

    return L.divIcon({
        className: '',
        iconSize: ICON_SIZE,
        iconAnchor: ICON_ANCHOR,
        tooltipAnchor: TOOLTIP_ANCHOR,
        html: `
            <span class="bus-marker-icon" role="presentation">
                <span class="bus-marker-icon__label" aria-hidden="true">${safeVehicleId}</span>
            </span>
        `,
    });
}

function formatTimestamp(isoString: string | null) {
    if (!isoString) {
        return null;
    }

    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
    });
}

function AutoFitBounds({ positions }: { positions: BusPosition[] }) {
    const map = useMap();
    const [userHasInteracted, setUserHasInteracted] = useState(false);
    const hasFittedView = useRef(false);

    useMapEvents({
        zoomstart() {
            setUserHasInteracted(true);
        },
        dragstart() {
            setUserHasInteracted(true);
        },
        movestart() {
            setUserHasInteracted(true);
        },
    });

    useEffect(() => {
        if (!positions.length) {
            hasFittedView.current = false;
            return;
        }

        if (userHasInteracted && hasFittedView.current) {
            return;
        }

        if (positions.length === 1) {
            const [{ latitude, longitude }] = positions;
            map.setView([latitude, longitude], Math.max(map.getZoom(), MAP_SINGLE_VEHICLE_MIN_ZOOM));
        } else {
            const bounds = L.latLngBounds(
                positions.map((position) => [position.latitude, position.longitude] as [number, number])
            );
            map.fitBounds(bounds.pad(MAP_BOUNDS_PADDING), { maxZoom: MAP_MAX_BOUNDS_ZOOM });
        }

        hasFittedView.current = true;
    }, [map, positions, userHasInteracted]);

    return null;
}

function BusRouteMap({ routeId }: BusRouteMapProps) {
    const [{ data, error, fetching }] = useSubscription<BusPositionsPayload>({
        query: BUS_POSITIONS_SUBSCRIPTION,
        variables: { routeId },
    });

    const positions = useMemo(() => {
        if (!data?.busPositions?.length) {
            return [] as BusPosition[];
        }

        return data.busPositions.filter(
            (position) => Number.isFinite(position.latitude) && Number.isFinite(position.longitude)
        );
    }, [data?.busPositions]);

    const lastUpdatedTimestamp = useMemo(() => {
        let latest: number | null = null;

        for (const position of positions) {
            const timestampMs = new Date(position.timestamp).getTime();
            if (Number.isNaN(timestampMs)) {
                continue;
            }

            if (latest === null || timestampMs > latest) {
                latest = timestampMs;
            }
        }

        return latest;
    }, [positions]);

    const markers = useMemo(
        () =>
            positions.map((position) => ({
                ...position,
                icon: createBusMarkerIcon(position.vehicleId),
            })),
        [positions]
    );

    const isLoading = fetching && !data;

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
            aria-label={`Live map for route ${routeId}`}
            {...accessibilityProps}
        >
            <header>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Live route map</p>
            </header>

            {error ? (
                <div
                    className="mt-4 rounded-lg border border-red-500/60 bg-red-500/10 p-4 text-sm text-red-200"
                    role="alert"
                >
                    <p className="font-medium">Subscription error</p>
                    <p>{error.message}</p>
                </div>
            ) : null}

            <div className="mt-4">
                {isLoading ? (
                    <>
                        <div className="h-80 w-full rounded-xl shimmer" aria-hidden="true" />
                        <span className="sr-only">Loading live bus positions</span>
                    </>
                ) : null}

                {!isLoading && positions.length === 0 ? (
                    <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-4 text-sm text-slate-300">
                        No active vehicles reported for route {routeId} right now.
                    </div>
                ) : null}

                {!isLoading && positions.length > 0 ? (
                    <div className="overflow-hidden rounded-xl border border-slate-800/70">
                        <MapContainer
                            center={FALLBACK_CENTER}
                            zoom={FALLBACK_ZOOM}
                            scrollWheelZoom={false}
                            className="h-[320px] w-full"
                        >
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            <AutoFitBounds positions={positions} />
                            {markers.map((position) => {
                                const markerPosition: LatLngExpression = [position.latitude, position.longitude];
                                const updatedAt = formatTimestamp(position.timestamp);
                                const speedMph =
                                    typeof position.speed === 'number'
                                        ? Math.round(position.speed * SPEED_MPS_TO_MPH)
                                        : null;

                                return (
                                    <Marker
                                        key={`${position.vehicleId}`}
                                        position={markerPosition}
                                        icon={position.icon}
                                        alt={`Vehicle ${position.vehicleId || 'unknown'} location marker`}
                                    >
                                        <Tooltip direction="top" offset={[0, -10]} opacity={0.95} permanent={false}>
                                            <div className="space-y-1">
                                                <p className="font-semibold text-slate-900">
                                                    Vehicle {position.vehicleId || '—'}
                                                </p>
                                                {updatedAt ? (
                                                    <p className="text-xs text-slate-700">Updated {updatedAt}</p>
                                                ) : null}
                                                {speedMph !== null ? (
                                                    <p className="text-xs text-slate-700">Speed {speedMph} mph</p>
                                                ) : null}
                                            </div>
                                        </Tooltip>
                                    </Marker>
                                );
                            })}
                        </MapContainer>
                    </div>
                ) : null}
            </div>

            <footer className="mt-4">
                {lastUpdatedTimestamp ? (
                    <LiveRelativeTime
                        timestamp={lastUpdatedTimestamp}
                        prefix="Last update"
                        className="text-xs uppercase tracking-[0.2em] text-slate-500"
                        ariaLive="off"
                    />
                ) : (
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Waiting for vehicle updates
                    </span>
                )}
            </footer>
        </section>
    );
}

export default BusRouteMap;
