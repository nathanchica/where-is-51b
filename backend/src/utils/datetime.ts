const ACT_REALTIME_TIME_ZONE = 'America/Los_Angeles';
const MS_PER_MINUTE = 60 * 1000;

const actTimeZoneFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: ACT_REALTIME_TIME_ZONE,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'shortOffset',
});

const LEGACY_TZ_ABBREVIATION_OFFSETS: Record<string, number> = {
    PDT: -7 * 60,
    PST: -8 * 60,
};

/**
 * Gets the timezone offset in minutes for a given date.
 * @param date The date to get the timezone offset for.
 * @returns The timezone offset in minutes.
 */
function getTimezoneOffsetMinutes(date: Date): number {
    const parts = actTimeZoneFormatter.formatToParts(date);
    const timeZoneName = parts.find((part) => part.type === 'timeZoneName')?.value;

    if (!timeZoneName) {
        return 0;
    }

    const match = timeZoneName.match(/^(?:GMT|UTC)(?:(\+|-)(\d{1,2})(?::?(\d{2}))?)?$/);

    if (match) {
        const sign = match[1] === '-' ? -1 : 1;
        const hours = Number(match[2] ?? '0');
        const minutes = Number(match[3] ?? '0');

        return sign * (hours * 60 + minutes);
    }

    const legacyOffset = LEGACY_TZ_ABBREVIATION_OFFSETS[timeZoneName];

    return typeof legacyOffset === 'number' ? legacyOffset : 0;
}

function safeNumber(value: string): number | null {
    const parsed = Number.parseInt(value, 10);

    return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Converts an ACT RealTime timestamp (`YYYYMMDD HH:MM`) into a JavaScript `Date`
 * using the America/Los_Angeles timezone to avoid environment-dependent skew.
 * Falls back to the current time when the input is missing or malformed.
 */
export function parseActRealtimeTimestamp(value?: string): Date {
    const [datePart, timePart] = value?.split(' ') ?? [];

    // Fall back to current time if the input is missing or malformed
    if (!datePart || !timePart || datePart.length !== 8) {
        console.warn(`Invalid ACT RealTime timestamp: ${value}`);
        return new Date();
    }

    const year = safeNumber(datePart.substring(0, 4));
    const month = safeNumber(datePart.substring(4, 6));
    const day = safeNumber(datePart.substring(6, 8));

    const [hourPart = '00', minutePart = '00'] = timePart.split(':');
    const hour = safeNumber(hourPart);
    const minute = safeNumber(minutePart);

    // Validate ranges and fall back to current time if out of range
    if (
        year === null ||
        month === null ||
        day === null ||
        hour === null ||
        minute === null ||
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > 31 ||
        hour < 0 ||
        hour > 23 ||
        minute < 0 ||
        minute > 59
    ) {
        console.warn(`Invalid ACT RealTime timestamp: ${value}`);
        return new Date();
    }

    /**
     * We have to manually adjust for timezone offsets because the Date constructor
     * and Date.parse() treat input as local time or UTC depending on the format
     * and environment, which leads to inconsistent results.
     *
     * The approach here is to:
     * 1. Construct a timestamp as if the input were in UTC (ignoring timezone)
     * 2. Get the timezone offset for that timestamp in the target timezone
     * 3. Adjust the timestamp by that offset
     * 4. Repeat steps 2-3 until the offset stabilizes (handles DST transitions)
     *
     * This effectively simulates constructing the date in the target timezone.
     */
    const localTimestamp = Date.UTC(year, month - 1, day, hour, minute);

    if (Number.isNaN(localTimestamp)) {
        return new Date();
    }

    let timestamp = localTimestamp;

    for (let i = 0; i < 2; i += 1) {
        const offsetMinutes = getTimezoneOffsetMinutes(new Date(timestamp));
        const adjusted = localTimestamp - offsetMinutes * MS_PER_MINUTE;

        if (adjusted === timestamp) {
            break;
        }

        timestamp = adjusted;
    }

    const parsedDate = new Date(timestamp);

    return Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
}

export default parseActRealtimeTimestamp;
