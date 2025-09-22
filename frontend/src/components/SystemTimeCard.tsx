import { useEffect, useMemo, useState } from 'react';
import { gql, useSubscription } from 'urql';

import Card from './Card';

const SYSTEM_TIME_SUBSCRIPTION = gql`
    subscription SystemTime {
        systemTime
    }
`;

type SystemTimePayload = {
    systemTime: string;
};

const DRIFT_THRESHOLD_MS = 15_000;

function SystemTimeCard() {
    const [{ data, error }] = useSubscription<SystemTimePayload>({
        query: SYSTEM_TIME_SUBSCRIPTION,
    });

    const [syncedTime, setSyncedTime] = useState<Date | null>(null);
    const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
    const [displayTime, setDisplayTime] = useState<Date | null>(null);

    const formattedClockTime = useMemo(() => {
        if (!displayTime) {
            return null;
        }

        return displayTime.toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
        });
    }, [displayTime]);

    const formattedDate = useMemo(() => {
        if (!displayTime) {
            return null;
        }

        return displayTime.toLocaleDateString(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    }, [displayTime]);

    useEffect(() => {
        if (!data?.systemTime) {
            return;
        }

        const nextSyncTime = new Date(data.systemTime);
        if (Number.isNaN(nextSyncTime.getTime())) {
            return;
        }

        const now = Date.now();

        if (syncedTime && lastSyncAt) {
            const elapsedSinceSync = now - lastSyncAt;
            const estimatedCurrent = new Date(syncedTime.getTime() + elapsedSinceSync);
            const discrepancyMs = Math.abs(nextSyncTime.getTime() - estimatedCurrent.getTime());

            if (discrepancyMs <= DRIFT_THRESHOLD_MS) {
                return;
            }
        }

        setSyncedTime(nextSyncTime);
        setLastSyncAt(now);
        setDisplayTime(nextSyncTime);
    }, [data?.systemTime, syncedTime, lastSyncAt]);

    useEffect(() => {
        if (!syncedTime || !lastSyncAt) {
            return;
        }

        const tick = () => {
            const elapsed = Date.now() - lastSyncAt;
            setDisplayTime(new Date(syncedTime.getTime() + elapsed));
        };

        tick();

        const intervalId = window.setInterval(tick, 1000);
        return () => window.clearInterval(intervalId);
    }, [syncedTime, lastSyncAt]);

    if (error) {
        return (
            <Card aria-label="System time">
                <div
                    className="rounded-lg border border-red-500/60 bg-red-500/10 p-4 text-sm text-red-200"
                    role="alert"
                >
                    <p className="font-medium">Subscription error</p>
                    <p>{error.message}</p>
                </div>
            </Card>
        );
    }

    const isLoading = !displayTime;

    return (
        <Card
            aria-label="System time"
            {...(isLoading ? { role: 'status' as const, 'aria-live': 'polite' as const, 'aria-busy': 'true' } : {})}
        >
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Live system clock</p>
            <div className="mt-3 h-12 font-mono text-4xl">
                {formattedClockTime ? (
                    <p>{formattedClockTime}</p>
                ) : (
                    <>
                        <div className="h-full w-3/4 rounded-md shimmer" aria-hidden="true" />
                        <span className="sr-only">Loading current system time</span>
                    </>
                )}
            </div>
            <div className="min-h-5 text-sm text-slate-400">
                {formattedDate ? (
                    <p>{formattedDate}</p>
                ) : (
                    <>
                        <div className="h-5 mt-1 w-2/3 rounded-md shimmer" aria-hidden="true" />
                        <span className="sr-only">Loading current date</span>
                    </>
                )}
            </div>
        </Card>
    );
}

export default SystemTimeCard;
