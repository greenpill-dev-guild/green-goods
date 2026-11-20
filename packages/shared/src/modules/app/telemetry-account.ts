/**
 * The signed-in account's test flag, handed to the transport (PRD-1560)
 *
 * `useAnalyticsIdentity` places the account at sign-in and forgets it at sign-out. The flag is
 * registered on the transport too, so autocaptured events ($pageview, $exception) carry it. This
 * lives apart from `telemetry-context`, which imports no transport: the client keeps that module
 * in its startup chunk, and a transport import from there would cost every page one more preload.
 *
 * @module modules/app/telemetry-account
 */

import type { Address } from "../../types/domain";
import { getTelemetrySegmentation, setTelemetryAccount } from "./telemetry-context";
import { getTelemetrySink } from "./telemetry-sink";

function registerAccountFlag(): void {
  try {
    getTelemetrySink().register?.({ is_test_account: getTelemetrySegmentation().is_test_account });
  } catch {
    // Telemetry is best effort.
  }
}

/** Place the account against the test-account records; events say "unknown" until it is done. */
export async function identifyTelemetryAccount(address: Address | null): Promise<void> {
  const placed = setTelemetryAccount(address);
  registerAccountFlag();
  await placed;
  registerAccountFlag();
}
