/**
 * Localized Toast Registry
 *
 * Module-level binding that the i18n-aware toast presets check before falling
 * back to English defaults. The static `xxxToasts` exports route through the
 * registry, so PWA callsites in `JobQueueProvider`, `WorkProvider`,
 * `useWorkMutation`, etc. localize without a per-callsite refactor.
 *
 * The binding is set by `<LocalizedToastsBridge />`, which lives inside
 * `IntlProvider` and forwards `intl.formatMessage` whenever the locale
 * changes. Toasts that fire before the bridge mounts (extremely rare —
 * `IntlProvider` is at the top of `AppProvider`) fall back to English.
 *
 * @module components/Toast/presets/registry
 */
import type { FormatMessageFn } from "./types";

let currentFormatMessage: FormatMessageFn | null = null;
const factoryCache = new Map<string, unknown>();

/**
 * Bind a `formatMessage` function for the static toast facade.
 *
 * Cached factories are cleared so the next call rebuilds against the new
 * binding. This keeps locale switches honest without leaking stale closures.
 */
export function setLocalizedToastsFormatter(formatMessage: FormatMessageFn): void {
  if (currentFormatMessage === formatMessage) return;
  currentFormatMessage = formatMessage;
  factoryCache.clear();
}

/** Clear the binding (used by `LocalizedToastsBridge` cleanup and tests). */
export function clearLocalizedToastsFormatter(): void {
  currentFormatMessage = null;
  factoryCache.clear();
}

/** Read the current binding. Mostly used by tests. */
export function getLocalizedToastsFormatter(): FormatMessageFn | null {
  return currentFormatMessage;
}

/**
 * Build (or retrieve) a memoized localized factory keyed by family name.
 *
 * Returns `null` when no formatter is bound, so the static facade falls back
 * to its English-only path. The cache invalidates on
 * `setLocalizedToastsFormatter` / `clearLocalizedToastsFormatter`.
 */
export function getLocalizedToastFamily<T>(
  family: string,
  build: (formatMessage: FormatMessageFn) => T
): T | null {
  const formatter = currentFormatMessage;
  if (!formatter) return null;
  const cached = factoryCache.get(family);
  if (cached) return cached as T;
  const factory = build(formatter);
  factoryCache.set(family, factory);
  return factory;
}
