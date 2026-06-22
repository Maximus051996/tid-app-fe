/**
 * Asia/Kolkata (IST) is fixed at UTC+05:30 — India has no DST. By doing the
 * math against that fixed offset we keep date logic deterministic and avoid
 * pulling in the heavier Intl.DateTimeFormat machinery on hot paths.
 *
 * Convention used everywhere in the app:
 *   - "Wall time" = the digits a human in IST sees on the clock.
 *   - We store full UTC ISO strings on the wire.
 *   - Pickers operate on IST wall time, then convert to a UTC instant
 *     that represents *that* wall-clock moment in IST.
 */

export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
export const IST_TIME_ZONE = 'Asia/Kolkata';

/** Wall-clock fields representing a moment in Asia/Kolkata. */
export interface IstWall {
  year: number;
  month: number; // 1-12
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  ms: number;
}

/** Pull IST wall-clock components out of any Date instance. */
export function toIstWall(d: Date): IstWall {
  const shifted = new Date(d.getTime() + IST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
    seconds: shifted.getUTCSeconds(),
    ms: shifted.getUTCMilliseconds(),
  };
}

/**
 * Build the UTC `Date` that represents the given IST wall-clock moment.
 * E.g. fromIstWall(2026, 6, 22, 20, 30) → 2026-06-22T15:00:00.000Z.
 */
export function fromIstWall(
  year: number,
  month: number, // 1-12
  day: number,
  hours = 0,
  minutes = 0,
  seconds = 0,
  ms = 0
): Date {
  const utcMs = Date.UTC(year, month - 1, day, hours, minutes, seconds, ms);
  return new Date(utcMs - IST_OFFSET_MS);
}

const pad = (n: number) => (n < 10 ? '0' + n : String(n));

/** YYYY-MM-DD using IST wall-clock — handy as a stable day key. */
export function istIsoDate(d: Date): string {
  const w = toIstWall(d);
  return `${w.year}-${pad(w.month)}-${pad(w.day)}`;
}

/** Format a Date in IST regardless of the device timezone. */
export function formatIst(d: Date, options: Intl.DateTimeFormatOptions): string {
  return d.toLocaleString('en-IN', { ...options, timeZone: IST_TIME_ZONE });
}

/** Start of the IST day for a given instant, expressed as a UTC Date. */
export function istStartOfDay(d: Date): Date {
  const w = toIstWall(d);
  return fromIstWall(w.year, w.month, w.day, 0, 0, 0, 0);
}

/** Today's wall-clock in IST. */
export function istNow(): IstWall {
  return toIstWall(new Date());
}
