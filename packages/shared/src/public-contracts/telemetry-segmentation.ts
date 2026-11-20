/**
 * Telemetry segmentation (PRD-1560)
 *
 * Every App, Hub and Agent event in PostHog carries the same five properties, so one filter
 * reads all three projects and matches the Sentry reports beside them: the deployment
 * `environment`, the `app_surface` that sent it, its `release`, and whether its account and its
 * garden are our own test ones. A value nobody can know is the explicit `"unknown"`, never a
 * guess, so a dashboard can show how much of its traffic it could not place.
 *
 * Which accounts and gardens are ours is kept in deployment configuration
 * (`TELEMETRY_TEST_ACCOUNTS`, `TELEMETRY_TEST_GARDENS`), never in this public repository. Until a
 * deployment lists them, every event says `"unknown"` for both flags.
 *
 * Dependency-light: the browser and the Agent both read it.
 *
 * @module public-contracts/telemetry-segmentation
 */

export const TELEMETRY_UNKNOWN = "unknown" as const;

/** Where an event came from: the App and website, the Hub, or the Agent. */
export type AppSurface = "app" | "admin" | "agent";

/** True or false when the records say; `"unknown"` when nobody listed them or nothing names one. */
export type TestTrafficFlag = boolean | typeof TELEMETRY_UNKNOWN;

export interface TelemetrySegmentation {
  /** The deployment environment Sentry also reports: production, staging, development... */
  environment: string;
  app_surface: AppSurface | typeof TELEMETRY_UNKNOWN;
  /** The release Sentry also reports, such as `green-goods-client@3ee6594ef3e5`. */
  release: string;
  is_test_account: TestTrafficFlag;
  is_test_garden: TestTrafficFlag;
}

const ADDRESS = /^0x[0-9a-f]{40}$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;

/** An address in the one spelling every record compares with, or null when it is not one. */
export function normalizeTelemetryAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const address = value.trim().toLowerCase();
  return ADDRESS.test(address) ? address : null;
}

function parseList(value: string | null | undefined, accept: RegExp): ReadonlySet<string> | null {
  if (typeof value !== "string") return null;
  const entries = value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  // A deployment that lists nothing has not said which traffic is ours. One that lists something
  // unreadable has not either: a mistyped entry would read its own account or garden as real.
  if (entries.length === 0 || !entries.every((entry) => accept.test(entry))) return null;
  return new Set(entries);
}

/** A comma-separated address list; null when the deployment lists none. */
export function parseTestTrafficAddresses(
  value: string | null | undefined
): ReadonlySet<string> | null {
  return parseList(value, ADDRESS);
}

/**
 * A comma-separated list of SHA-256 digests, hex, of lowercase addresses. The browser bundle
 * carries the test accounts this way so it never ships the addresses themselves.
 */
export function parseTestTrafficDigests(
  value: string | null | undefined
): ReadonlySet<string> | null {
  return parseList(value, SHA256_HEX);
}

/** Whether `key` is on `records`: unknown when no records were listed or there is no key. */
export function classifyTestTraffic(
  records: ReadonlySet<string> | null,
  key: string | null
): TestTrafficFlag {
  if (!records || !key) return TELEMETRY_UNKNOWN;
  return records.has(key);
}

/** The garden an event names, under any of the property names our events use for it. */
export function eventGardenAddress(properties: Record<string, unknown>): string | null {
  return normalizeTelemetryAddress(
    properties.gardenAddress ??
      properties.garden_address ??
      properties.gardenId ??
      properties.garden_id
  );
}
