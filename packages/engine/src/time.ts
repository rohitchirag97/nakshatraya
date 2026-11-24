import { DateTime } from "luxon";

/**
 * Local birth wall-clock time + IANA zone → UTC, using the runtime's historical tzdata
 * (covers India's +6:30 war time 1942–45).
 * shortcut: tzdb models all of India as Asia/Kolkata, so pre-1955 Bombay/Calcutta local times are not
 * distinguished; if astrologers need that, add a per-city override table.
 */
export function toUtc(local: string, zone: string): Date {
  const dt = DateTime.fromISO(local, { zone });
  if (!dt.isValid)
    throw new Error(`invalid local time or zone: ${local} ${zone} (${dt.invalidReason})`);
  return dt.toJSDate();
}
