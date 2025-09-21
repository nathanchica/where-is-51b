import { useEffect, useMemo, useState } from 'react';

type LiveRelativeTimeProps = {
    timestamp: number | null;
    prefix?: string;
    className?: string;
    ariaLive?: 'off' | 'polite' | 'assertive';
    justNowThresholdSeconds?: number;
    updateIntervalMs?: number;
};

type UseRelativeTimeLabelOptions = {
    prefix?: string;
    justNowThresholdSeconds?: number;
    updateIntervalMs?: number;
};

const DEFAULT_UPDATE_INTERVAL = 1000;
const DEFAULT_JUST_NOW_THRESHOLD = 1;

function pluralize(value: number, singular: string, plural: string) {
    return `${value} ${value === 1 ? singular : plural}`;
}

function formatRelativeDelta(deltaSeconds: number, justNowThresholdSeconds: number) {
    if (deltaSeconds <= justNowThresholdSeconds) {
        return 'just now';
    }

    if (deltaSeconds < 60) {
        return `${deltaSeconds} seconds ago`;
    }

    const minutes = Math.round(deltaSeconds / 60);
    if (minutes < 60) {
        return `${pluralize(minutes, 'minute', 'minutes')} ago`;
    }

    const hours = Math.round(minutes / 60);
    if (hours < 24) {
        return `${pluralize(hours, 'hour', 'hours')} ago`;
    }

    const days = Math.round(hours / 24);
    return `${pluralize(days, 'day', 'days')} ago`;
}

export function useRelativeTimeLabel(timestamp: number | null, options?: UseRelativeTimeLabelOptions) {
    const {
        prefix,
        justNowThresholdSeconds = DEFAULT_JUST_NOW_THRESHOLD,
        updateIntervalMs = DEFAULT_UPDATE_INTERVAL,
    } = options ?? {};

    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (timestamp === null) {
            return;
        }

        setNow(Date.now());

        if (typeof window === 'undefined') {
            return;
        }

        const intervalId = window.setInterval(() => {
            setNow(Date.now());
        }, updateIntervalMs);

        return () => window.clearInterval(intervalId);
    }, [timestamp, updateIntervalMs]);

    return useMemo(() => {
        if (timestamp === null) {
            return null;
        }

        const deltaMs = Math.max(0, now - timestamp);
        const deltaSeconds = Math.round(deltaMs / 1000);
        const relativeText = formatRelativeDelta(deltaSeconds, justNowThresholdSeconds);

        return prefix ? `${prefix} ${relativeText}` : relativeText;
    }, [timestamp, now, prefix, justNowThresholdSeconds]);
}

function LiveRelativeTime({
    timestamp,
    prefix,
    className,
    ariaLive = 'polite',
    justNowThresholdSeconds,
    updateIntervalMs,
}: LiveRelativeTimeProps) {
    const label = useRelativeTimeLabel(timestamp, {
        prefix,
        justNowThresholdSeconds,
        updateIntervalMs,
    });

    if (!label) {
        return null;
    }

    return (
        <span className={className} aria-live={ariaLive} aria-atomic="true">
            {label}
        </span>
    );
}

export default LiveRelativeTime;
