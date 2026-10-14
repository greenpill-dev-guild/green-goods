/**
 * Calendar-date helpers for local-time widget boundaries.
 *
 * Use this pair with DatePicker, which creates and renders local-midnight Dates.
 * Use the UTC-based `toDateInputValue` / `fromDateInputValue` pair for native
 * date inputs and persisted instants. Mixing the pairs can shift the visible day.
 *
 * A form that keeps the persisted instant itself, not a calendar key, crosses
 * that boundary on every read and write: give the picker
 * `utcDayToPickerValue(instant)` and store `pickerValueToUtcDay(picked)`.
 */

/** Format an instant as a YYYY-MM-DD key using local calendar parts. */
export function toCalendarDateKey(value: number | Date | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" && value <= 0) return "";

  const date = value instanceof Date ? value : new Date(value * 1000);
  if (!Number.isFinite(date.getTime())) return "";

  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Parse a YYYY-MM-DD key to Unix seconds at local midnight. */
export function fromCalendarDateKey(value: string | null | undefined): number | null {
  if (!value) return null;

  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!parts) return null;

  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  if (month < 1 || month > 12 || day < 1) return null;

  const date = new Date(year, month - 1, day);
  if (!Number.isFinite(date.getTime())) return null;

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return Math.floor(date.getTime() / 1000);
}

const SECONDS_PER_DAY = 86_400;

/**
 * The UTC calendar day a persisted instant falls on, as that day's UTC midnight
 * in Unix seconds: the form a stored day takes.
 */
export function toUtcDay(seconds: number): number {
  return Math.floor(seconds / SECONDS_PER_DAY) * SECONDS_PER_DAY;
}

/**
 * The DatePicker value that shows the UTC calendar day of a persisted instant:
 * local midnight of that day. Null for an unset instant (null or not positive).
 */
export function utcDayToPickerValue(value: number | null | undefined): number | null {
  if (value === null || value === undefined || value <= 0) return null;

  const instant = new Date(value * 1000);
  if (!Number.isFinite(instant.getTime())) return null;

  const shown = new Date(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate());
  return Math.floor(shown.getTime() / 1000);
}

/**
 * The instant to persist for the day a DatePicker handed back: UTC midnight of
 * that calendar day, whichever zone the picker ran in. Null for a cleared field.
 */
export function pickerValueToUtcDay(value: number | null | undefined): number | null {
  if (value === null || value === undefined || value <= 0) return null;

  const picked = new Date(value * 1000);
  if (!Number.isFinite(picked.getTime())) return null;

  return Date.UTC(picked.getFullYear(), picked.getMonth(), picked.getDate()) / 1000;
}
