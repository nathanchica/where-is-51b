import { useEffect, useMemo, useState } from 'react';
import { gql, useSubscription } from 'urql';

const SYSTEM_TIME_SUBSCRIPTION = gql`
    subscription SystemTime {
        systemTime
    }
`;

type SystemTimePayload = {
    systemTime: string;
};

export function SystemTimeCard() {
    const [{ data, fetching, error }] = useSubscription<SystemTimePayload>({
        query: SYSTEM_TIME_SUBSCRIPTION,
    });

    const [syncedTime, setSyncedTime] = useState<Date | null>(null);
    const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
    const [displayTime, setDisplayTime] = useState<Date | null>(null);

    useEffect(() => {
        if (!data?.systemTime) {
            return;
        }

        const nextSyncTime = new Date(data.systemTime);
        if (Number.isNaN(nextSyncTime.getTime())) {
            return;
        }

        const syncInstant = Date.now();
        setSyncedTime(nextSyncTime);
        setLastSyncAt(syncInstant);
        setDisplayTime(nextSyncTime);
    }, [data?.systemTime]);

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

    const createSyncStatusText = (): string | null => {
        if (!lastSyncAt) {
            return null;
        }

        const deltaSeconds = Math.max(0, Math.round((Date.now() - lastSyncAt) / 1000));
        return deltaSeconds <= 1 ? 'Synced just now' : `Synced ${deltaSeconds} seconds ago`;
    };

    const syncStatus = createSyncStatusText();

    if (error) {
        return (
            <div className="rounded-lg border border-red-500/60 bg-red-500/10 p-4 text-sm text-red-200">
                <p className="font-medium">Subscription error</p>
                <p>{error.message}</p>
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Live system clock</p>
            <p className="mt-3 text-4xl font-mono">
                {formattedClockTime ?? (fetching ? 'Connecting…' : 'Waiting for system time…')}
            </p>
            {formattedDate ? <p className="mt-2 text-sm text-slate-400">{formattedDate}</p> : null}
            {syncStatus ? <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-500">{syncStatus}</p> : null}
        </div>
    );
}
