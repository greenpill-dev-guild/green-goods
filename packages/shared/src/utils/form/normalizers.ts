/**
 * Form Field Normalizers
 *
 * Shared normalization functions for form fields.
 * Used by both Zod schemas (preprocess) and react-hook-form watch values
 * to ensure consistent data transformation.
 *
 * @module utils/form/normalizers
 */

/**
 * Normalizes a plant selection value to a string array.
 *
 * Handles:
 * - Array of strings (filters empty values)
 * - Single string (wraps in array if non-empty)
 * - undefined/null (returns empty array)
 *
 * @param value - Raw form value
 * @returns Normalized string array
 */
export function normalizePlantSelection(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string" && item.trim().length > 0);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? [trimmed] : [];
  }
  return [];
}

/**
 * Normalizes a plant count value to a number or undefined.
 *
 * Handles:
 * - Number (returns as-is unless NaN)
 * - Numeric string (parses to number)
 * - Empty string/null/undefined (returns undefined)
 *
 * @param value - Raw form value
 * @returns Normalized number or undefined
 */
export function normalizePlantCount(value: unknown): number | undefined {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === "number") {
    return Number.isNaN(value) ? undefined : value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) return undefined;
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

/**
 * Normalizes feedback to a string.
 *
 * @param value - Raw form value
 * @returns Normalized string (empty string if undefined/null)
 */
export function normalizeFeedback(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return "";
}

/**
 * Normalizes time spent input (in hours) to minutes.
 *
 * Handles:
 * - Number (converts hours to minutes)
 * - Numeric string (parses and converts)
 * - Empty string/null/undefined (returns undefined)
 *
 * @param value - Raw form value (hours, can be decimal like 1.5)
 * @returns Time spent in minutes or undefined
 */
export function normalizeTimeSpentMinutes(value: unknown): number | undefined {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === "number") {
    if (Number.isNaN(value) || value < 0) return undefined;
    // Convert hours to minutes, round to nearest minute
    return Math.round(value * 60);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) return undefined;
    const parsed = Number(trimmed);
    if (Number.isNaN(parsed) || parsed < 0) return undefined;
    // Convert hours to minutes, round to nearest minute
    return Math.round(parsed * 60);
  }
  return undefined;
}

/**
 * Formats time spent (in minutes) for display.
 *
 * Note: normalizeTimeSpentMinutes is the usual producer of this value.
 *
 * @param minutes - Time spent in minutes
 * @returns Formatted string like "2h 30m" or "45m"
 */
export function formatTimeSpent(minutes: number | undefined): string {
  if (minutes === undefined || !Number.isFinite(minutes) || minutes <= 0) return "";

  // Defensive rounding to handle non-integer inputs
  const roundedMinutes = Math.round(minutes);

  const hours = Math.floor(roundedMinutes / 60);
  const mins = roundedMinutes % 60;

  if (hours === 0) {
    return `${mins}m`;
  }
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
}
