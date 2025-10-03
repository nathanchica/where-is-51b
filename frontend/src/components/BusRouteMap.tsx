import L, { type LatLngExpression, DivIcon } from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { gql, useSubscription } from 'urql';

import 'leaflet/dist/leaflet.css';

import Card from './Card';
import LiveRelativeTime from './LiveRelativeTime';

import { escapeHtml } from '../utils/escapeHtml';

const BUSES_SUBSCRIPTION = gql`
    subscription BusesByRouteSubscription($routeId: String!) {
        busesByRoute(routeId: $routeId) {
            vehicleId
            position {
                latitude
                longitude
                heading
                speed
            }
        }
    }
`;

type BusRouteMapProps = {
    routeId: string;
};

type Position = {
    latitude: number;
    longitude: number;
    heading: number | null;
    speed: number | null;
};

type Bus = {
    vehicleId: string;
    position: Position;
};

type BusesByRouteSubscriptionPayload = {
    busesByRoute: Bus[];
};

const FALLBACK_CENTER: LatLngExpression = [37.8665, -122.2673];
const FALLBACK_ZOOM = 13;
const ICON_SIZE: [number, number] = [40, 40];
const ICON_ANCHOR: [number, number] = [20, 20];
const TOOLTIP_ANCHOR: [number, number] = [0, -24];
const VEHICLE_ID_MAX_LENGTH = 6;
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

function AutoFitBounds({ buses }: { buses: Bus[] }) {
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
        if (!buses.length) {
            hasFittedView.current = false;
            return;
        }

        if (userHasInteracted && hasFittedView.current) {
            return;
        }

        if (buses.length === 1) {
            const [{ position }] = buses;
            map.setView([position.latitude, position.longitude], Math.max(map.getZoom(), MAP_SINGLE_VEHICLE_MIN_ZOOM));
        } else {
            const bounds = L.latLngBounds(
                buses.map((bus) => [bus.position.latitude, bus.position.longitude] as [number, number])
            );
            map.fitBounds(bounds.pad(MAP_BOUNDS_PADDING), { maxZoom: MAP_MAX_BOUNDS_ZOOM });
        }

        hasFittedView.current = true;
    }, [map, buses, userHasInteracted]);

    return null;
}

function BusRouteMap({ routeId }: BusRouteMapProps) {
    const [{ data, error, fetching }] = useSubscription<BusesByRouteSubscriptionPayload>({
        query: BUSES_SUBSCRIPTION,
        variables: { routeId },
    });
    const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

    const buses = useMemo(() => {
        if (!data?.busesByRoute?.length) {
            return [] as Bus[];
        }

        return data.busesByRoute.filter(
            ({ position }) => Number.isFinite(position.latitude) && Number.isFinite(position.longitude)
        );
    }, [data?.busesByRoute]);

    const markers = useMemo(
        () =>
            buses.map(({ vehicleId, position }) => ({
                ...position,
                vehicleId,
                icon: createBusMarkerIcon(vehicleId),
            })),
        [buses]
    );

    const isLoading = fetching && !data;

    const accessibilityProps = isLoading
        ? {
              role: 'status' as const,
              'aria-live': 'polite' as const,
              'aria-busy': 'true' as const,
          }
        : {};

    useEffect(() => {
        setLastSyncAt(Date.now());
    }, [buses]);

    return (
        <Card aria-label={`Live map for route ${routeId}`} {...accessibilityProps}>
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

                {!isLoading && buses.length === 0 ? (
                    <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-4 text-sm text-slate-300">
                        No active vehicles reported for route {routeId} right now.
                    </div>
                ) : null}

                {!isLoading && buses.length > 0 ? (
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
                            <AutoFitBounds buses={buses} />
                            {markers.map(({ vehicleId, latitude, longitude, speed, icon }) => {
                                const markerPosition: LatLngExpression = [latitude, longitude];

                                return (
                                    <Marker
                                        key={`${vehicleId}`}
                                        position={markerPosition}
                                        icon={icon}
                                        alt={`Vehicle ${vehicleId || 'unknown'} location marker`}
                                    >
                                        <Tooltip direction="top" offset={[0, -10]} opacity={0.95} permanent={false}>
                                            <div className="space-y-1">
                                                <p className="font-semibold text-slate-900">
                                                    Vehicle {vehicleId || '—'}
                                                </p>
                                                {speed !== null ? (
                                                    <p className="text-xs text-slate-700">Speed {speed} mph</p>
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
                {!isLoading && buses.length > 0 && lastSyncAt ? (
                    <LiveRelativeTime
                        timestamp={lastSyncAt}
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
        </Card>
    );
}

export default BusRouteMap;
