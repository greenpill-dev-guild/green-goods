/**
 * The segmentation every browser event carries (PRD-1560)
 *
 * The App and the Hub builds hand their surface, release and deployment environment to the
 * bundle (`vite.config.ts` `define`), with the deployment's test-traffic records: test gardens
 * as addresses, test accounts only as SHA-256 digests. Sentry reads the same environment and
 * release here, so a PostHog event and the Sentry report beside it filter the same way.
 *
 * The account flag follows whoever is signed in: `useAnalyticsIdentity` hands the address over at
 * sign-in and takes it back at sign-out, through `posthog`, which also registers the flag for
 * autocaptured events. Until the digest is checked, and for a visitor who is not signed in, the
 * flag stays `"unknown"`.
 *
 * It imports no transport: the client keeps it in its startup error-reporting chunk, and a sink
 * import from there would split the sink into one more file every page preloads.
 *
 * @module modules/app/telemetry-context
 */

import {
  type AppSurface,
  classifyTestTraffic,
  eventGardenAddress,
  normalizeTelemetryAddress,
  parseTestTrafficAddresses,
  parseTestTrafficDigests,
  TELEMETRY_UNKNOWN,
  type TelemetrySegmentation,
  type TestTrafficFlag,
} from "../../public-contracts/telemetry-segmentation";
import type { Address } from "../../types/domain";

function readSurface(): AppSurface | typeof TELEMETRY_UNKNOWN {
  const surface = import.meta.env.VITE_APP_SURFACE;
  return surface === "app" || surface === "admin" ? surface : TELEMETRY_UNKNOWN;
}

/** The deployment environment, as the build resolved it for Sentry. */
export function getTelemetryEnvironment(): string {
  return import.meta.env.VITE_SENTRY_ENVIRONMENT?.trim() || TELEMETRY_UNKNOWN;
}

/** The release, as the build named it for Sentry and its source maps. */
export function getTelemetryRelease(): string {
  return import.meta.env.VITE_TELEMETRY_RELEASE?.trim() || TELEMETRY_UNKNOWN;
}

/** The surface this bundle was built for. */
export function getTelemetrySurface(): AppSurface | typeof TELEMETRY_UNKNOWN {
  return readSurface();
}

let accountFlag: TestTrafficFlag = TELEMETRY_UNKNOWN;
let accountGeneration = 0;

/** SHA-256, hex, of an address already in its normalized spelling. */
async function digest(normalized: string): Promise<string | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Place the signed-in account against the test-account records, or forget it at sign-out.
 * Resolves to the flag later events carry. A newer call supersedes one still checking.
 */
export async function setTelemetryAccount(address: Address | null): Promise<TestTrafficFlag> {
  const generation = ++accountGeneration;
  accountFlag = TELEMETRY_UNKNOWN;

  const normalized = normalizeTelemetryAddress(address);
  const records = parseTestTrafficDigests(import.meta.env.VITE_TELEMETRY_TEST_ACCOUNT_DIGESTS);
  if (!normalized || !records) return TELEMETRY_UNKNOWN;

  let accountDigest: string | null = null;
  try {
    accountDigest = await digest(normalized);
  } catch {
    accountDigest = null;
  }
  if (generation !== accountGeneration) return accountFlag;
  accountFlag = classifyTestTraffic(records, accountDigest);
  return accountFlag;
}

/** The segmentation for one event, its garden read from the event's own properties. */
export function getTelemetrySegmentation(
  properties: Record<string, unknown> = {}
): TelemetrySegmentation {
  return {
    environment: getTelemetryEnvironment(),
    app_surface: readSurface(),
    release: getTelemetryRelease(),
    is_test_account: accountFlag,
    is_test_garden: classifyTestTraffic(
      parseTestTrafficAddresses(import.meta.env.VITE_TELEMETRY_TEST_GARDENS),
      eventGardenAddress(properties)
    ),
  };
}
