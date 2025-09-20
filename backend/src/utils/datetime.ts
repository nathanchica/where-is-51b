/**
 * Converts an ACT RealTime timestamp (`YYYYMMDD HH:MM`) into a JavaScript `Date` in the local timezone.
 * Falls back to the current time when the input is missing or malformed.
 *
 * @example parseActRealtimeTimestamp('20250919 22:17')
 * // Date representing 2025-09-19T22:17:00 in the local timezone
 * @example parseActRealtimeTimestamp('invalid timestamp')
 * // Returns the current date/time
 */
export function parseActRealtimeTimestamp(value?: string): Date {
    const [datePart, timePart] = value?.split(' ') ?? [];

    if (!datePart || !timePart || datePart.length !== 8) {
        return new Date();
    }

    const year = datePart.substring(0, 4);
    const month = datePart.substring(4, 6);
    const day = datePart.substring(6, 8);
    const [hour = '00', minute = '00'] = timePart.split(':');

    const isoString = `${year}-${month}-${day}T${hour}:${minute}:00`;
    const parsedDate = new Date(isoString);

    return Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
}

export default parseActRealtimeTimestamp;
