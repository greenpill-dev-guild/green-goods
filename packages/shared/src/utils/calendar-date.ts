/**
 * Calendar-date helpers for local-time widget boundaries.
 *
 * Use this pair with DatePicker, which creates and renders local-midnight Dates.
 * Use the UTC-based `toDateInputValue` / `fromDateInputValue` pair for native
 * date inputs and persisted instants. Mixing the pairs can shift the visible day.
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
