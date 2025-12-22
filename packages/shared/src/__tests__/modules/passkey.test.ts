/**
 * Passkey Module Tests
 *
 * DEPRECATED: This test file tests the old passkey module which has been
 * consolidated into the unified auth system using XState.
 *
 * The passkey functionality is now tested through:
 * - workflows/authMachine.test.ts (state machine tests)
 * - workflows/authServices.test.ts (service integration tests, including passkey services)
 *
 * The actual passkey logic now lives in:
 * - workflows/authActor.ts (service implementations)
 * - workflows/authMachine.ts (state machine definition)
 */

import { describe, it } from "vitest";

// Skip all tests - old module has been consolidated into authActor.ts
describe.skip("modules/auth/passkey (DEPRECATED)", () => {
  it("placeholder - see workflows/authServices.test.ts for passkey tests", () => {});
});
