/**
 * mintHypercertMachine Tests
 *
 * Integration tests for the hypercert minting XState machine.
 * Tests state transitions, guards, actions, and error handling.
 */

import { createActor, fromPromise } from "xstate";
import { describe, expect, it, vi } from "vitest";
import type { Address, Hex } from "viem";

// Custom waitFor that doesn't require DOM (for pure XState tests)
async function waitFor(
  callback: () => void | Promise<void>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 50 } = options;
  const start = Date.now();

  while (true) {
    try {
      await callback();
      return;
    } catch {
      if (Date.now() - start >= timeout) {
        throw new Error(`waitFor timed out after ${timeout}ms`);
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }
}

import { mintHypercertMachine, type MintHypercertInput } from "../../workflows/mintHypercert";
import { TOTAL_UNITS } from "../../lib/hypercerts/constants";

// ============================================
// Test Fixtures
// ============================================

const MOCK_GARDEN_ADDRESS = "0xGarden12345678901234567890123456789012345" as Address;
const MOCK_METADATA_CID = "QmTestMetadata123456789";
const MOCK_ALLOWLIST_CID = "QmTestAllowlist123456789";
const MOCK_MERKLE_ROOT =
  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hex;
const MOCK_TX_HASH = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as Hex;
const MOCK_USER_OP_HASH =
  "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321" as Hex;
const MOCK_HYPERCERT_ID = "12345678901234567890";

function createMockInput(): MintHypercertInput {
  const now = Math.floor(Date.now() / 1000);
  return {
    metadata: {
      name: "Test Hypercert",
      description: "A test hypercert for integration testing",
      image: "ipfs://QmTestImage123",
      hypercert: {
        work_scope: {
          name: "work_scope",
          value: ["gardening", "planting"],
          display_value: "gardening, planting",
        },
        impact_scope: {
          name: "impact_scope",
          value: ["environment"],
          display_value: "environment",
        },
        work_timeframe: {
          name: "work_timeframe",
          value: [now - 86400 * 30, now],
          display_value: "Last 30 days",
        },
        impact_timeframe: {
          name: "impact_timeframe",
          value: [now - 86400 * 30, 0],
          display_value: "Indefinite",
        },
        contributors: {
          name: "contributors",
          value: ["0x1234567890123456789012345678901234567890"],
          display_value: "1 contributor",
        },
        rights: {
          name: "rights",
          value: ["Public display"],
          display_value: "Public display",
        },
      },
    },
    allowlist: [
      {
        address: "0x1234567890123456789012345678901234567890" as Address,
        units: TOTAL_UNITS,
      },
    ],
    totalUnits: TOTAL_UNITS,
    gardenAddress: MOCK_GARDEN_ADDRESS,
    attestationUIDs: [
      "0x1111111111111111111111111111111111111111111111111111111111111111" as Hex,
      "0x2222222222222222222222222222222222222222222222222222222222222222" as Hex,
    ],
  };
}

// Helper to create a hanging promise actor
function createHangingActor<T>() {
  return fromPromise<T, unknown>(() => new Promise<T>(() => {}));
}

// Helper to create a resolving actor
function createResolvingActor<T>(value: T) {
  return fromPromise<T, unknown>(() => Promise.resolve(value));
}

// Helper to create a rejecting actor
function createRejectingActor(error: Error | string) {
  return fromPromise<never, unknown>(() =>
    Promise.reject(typeof error === "string" ? new Error(error) : error)
  );
}

// ============================================
// Machine State Tests
// ============================================

describe("workflows/mintHypercertMachine", () => {
  describe("Initial State", () => {
    it("starts in idle state", () => {
      const actor = createActor(mintHypercertMachine);
      actor.start();

      expect(actor.getSnapshot().value).toBe("idle");
      expect(actor.getSnapshot().context.input).toBeNull();
      expect(actor.getSnapshot().context.error).toBeNull();
      expect(actor.getSnapshot().context.retryCount).toBe(0);

      actor.stop();
    });

    it("has null values for all CIDs and hashes initially", () => {
      const actor = createActor(mintHypercertMachine);
      actor.start();

      const context = actor.getSnapshot().context;
      expect(context.metadataCid).toBeNull();
      expect(context.allowlistCid).toBeNull();
      expect(context.merkleRoot).toBeNull();
      expect(context.userOpHash).toBeNull();
      expect(context.txHash).toBeNull();
      expect(context.hypercertId).toBeNull();

      actor.stop();
    });
  });

  describe("State Transitions", () => {
    it("transitions from idle to uploadingMetadata on START_MINT", () => {
      const machine = mintHypercertMachine.provide({
        actors: {
          uploadMetadata: createHangingActor<{ cid: string }>(),
        },
      });

      const actor = createActor(machine);
      actor.start();

      actor.send({ type: "START_MINT", input: createMockInput() });

      expect(actor.getSnapshot().value).toBe("uploadingMetadata");
      expect(actor.getSnapshot().context.input).not.toBeNull();

      actor.stop();
    });

    it("stores input when starting mint", () => {
      const machine = mintHypercertMachine.provide({
        actors: {
          uploadMetadata: createHangingActor<{ cid: string }>(),
        },
      });

      const actor = createActor(machine);
      actor.start();

      const input = createMockInput();
      actor.send({ type: "START_MINT", input });

      expect(actor.getSnapshot().context.input).toEqual(input);

      actor.stop();
    });

    it("transitions through full happy path", async () => {
      const stateHistory: string[] = [];

      const machine = mintHypercertMachine.provide({
        actors: {
          uploadMetadata: createResolvingActor({ cid: MOCK_METADATA_CID }),
          uploadAllowlist: createResolvingActor({
            cid: MOCK_ALLOWLIST_CID,
            merkleRoot: MOCK_MERKLE_ROOT,
          }),
          buildAndSignUserOp: createResolvingActor({ hash: MOCK_USER_OP_HASH }),
          pollForReceipt: createResolvingActor({
            txHash: MOCK_TX_HASH,
            hypercertId: MOCK_HYPERCERT_ID,
          }),
        },
      });

      const actor = createActor(machine);

      actor.subscribe((snapshot) => {
        stateHistory.push(snapshot.value as string);
      });

      actor.start();
      actor.send({ type: "START_MINT", input: createMockInput() });

      // Wait for the machine to reach confirmed state
      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe("confirmed");
      });

      // Verify state progression
      expect(stateHistory).toContain("idle");
      expect(stateHistory).toContain("uploadingMetadata");
      expect(stateHistory).toContain("uploadingAllowlist");
      expect(stateHistory).toContain("signing");
      expect(stateHistory).toContain("pending");
      expect(stateHistory).toContain("confirmed");

      actor.stop();
    });

    it("stores context values through transitions", async () => {
      const machine = mintHypercertMachine.provide({
        actors: {
          uploadMetadata: createResolvingActor({ cid: MOCK_METADATA_CID }),
          uploadAllowlist: createResolvingActor({
            cid: MOCK_ALLOWLIST_CID,
            merkleRoot: MOCK_MERKLE_ROOT,
          }),
          buildAndSignUserOp: createResolvingActor({ hash: MOCK_USER_OP_HASH }),
          pollForReceipt: createResolvingActor({
            txHash: MOCK_TX_HASH,
            hypercertId: MOCK_HYPERCERT_ID,
          }),
        },
      });

      const actor = createActor(machine);
      actor.start();
      actor.send({ type: "START_MINT", input: createMockInput() });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe("confirmed");
      });

      const context = actor.getSnapshot().context;
      expect(context.metadataCid).toBe(MOCK_METADATA_CID);
      expect(context.allowlistCid).toBe(MOCK_ALLOWLIST_CID);
      expect(context.merkleRoot).toBe(MOCK_MERKLE_ROOT);
      expect(context.userOpHash).toBe(MOCK_USER_OP_HASH);
      expect(context.txHash).toBe(MOCK_TX_HASH);
      expect(context.hypercertId).toBe(MOCK_HYPERCERT_ID);

      actor.stop();
    });
  });

  describe("Error Handling", () => {
    it("transitions to failed on uploadMetadata error", async () => {
      const errorMessage = "IPFS upload failed";
      const machine = mintHypercertMachine.provide({
        actors: {
          uploadMetadata: createRejectingActor(errorMessage),
        },
      });

      const actor = createActor(machine);
      actor.start();
      actor.send({ type: "START_MINT", input: createMockInput() });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe("failed");
      });

      expect(actor.getSnapshot().context.error).toBe(errorMessage);
      // retryCount is 0 after first error (incremented on RETRY, not on error)
      expect(actor.getSnapshot().context.retryCount).toBe(0);

      actor.stop();
    });

    it("transitions to failed on uploadAllowlist error", async () => {
      const errorMessage = "Allowlist validation failed";
      const machine = mintHypercertMachine.provide({
        actors: {
          uploadMetadata: createResolvingActor({ cid: MOCK_METADATA_CID }),
          uploadAllowlist: createRejectingActor(errorMessage),
        },
      });

      const actor = createActor(machine);
      actor.start();
      actor.send({ type: "START_MINT", input: createMockInput() });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe("failed");
      });

      expect(actor.getSnapshot().context.error).toBe(errorMessage);

      actor.stop();
    });

    it("transitions to failed on signing error", async () => {
      const errorMessage = "User rejected transaction";
      const machine = mintHypercertMachine.provide({
        actors: {
          uploadMetadata: createResolvingActor({ cid: MOCK_METADATA_CID }),
          uploadAllowlist: createResolvingActor({
            cid: MOCK_ALLOWLIST_CID,
            merkleRoot: MOCK_MERKLE_ROOT,
          }),
          buildAndSignUserOp: createRejectingActor(errorMessage),
        },
      });

      const actor = createActor(machine);
      actor.start();
      actor.send({ type: "START_MINT", input: createMockInput() });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe("failed");
      });

      expect(actor.getSnapshot().context.error).toBe(errorMessage);

      actor.stop();
    });

    it("transitions to failed on receipt polling error", async () => {
      const errorMessage = "Transaction reverted";
      const machine = mintHypercertMachine.provide({
        actors: {
          uploadMetadata: createResolvingActor({ cid: MOCK_METADATA_CID }),
          uploadAllowlist: createResolvingActor({
            cid: MOCK_ALLOWLIST_CID,
            merkleRoot: MOCK_MERKLE_ROOT,
          }),
          buildAndSignUserOp: createResolvingActor({ hash: MOCK_USER_OP_HASH }),
          pollForReceipt: createRejectingActor(errorMessage),
        },
      });

      const actor = createActor(machine);
      actor.start();
      actor.send({ type: "START_MINT", input: createMockInput() });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe("failed");
      });

      expect(actor.getSnapshot().context.error).toBe(errorMessage);

      actor.stop();
    });

    it("converts non-Error objects to string in error messages", async () => {
      const machine = mintHypercertMachine.provide({
        actors: {
          uploadMetadata: fromPromise<{ cid: string }, unknown>(() =>
            Promise.reject("String error")
          ),
        },
      });

      const actor = createActor(machine);
      actor.start();
      actor.send({ type: "START_MINT", input: createMockInput() });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe("failed");
      });

      expect(actor.getSnapshot().context.error).toBe("String error");

      actor.stop();
    });
  });

  describe("Retry Logic", () => {
    it("allows retry from failed state when retryCount < 3", async () => {
      let callCount = 0;

      const machine = mintHypercertMachine.provide({
        actors: {
          uploadMetadata: fromPromise<{ cid: string }, unknown>(async () => {
            callCount++;
            if (callCount === 1) {
              throw new Error("First attempt failed");
            }
            return { cid: MOCK_METADATA_CID };
          }),
          uploadAllowlist: createResolvingActor({
            cid: MOCK_ALLOWLIST_CID,
            merkleRoot: MOCK_MERKLE_ROOT,
          }),
          buildAndSignUserOp: createResolvingActor({ hash: MOCK_USER_OP_HASH }),
          pollForReceipt: createResolvingActor({
            txHash: MOCK_TX_HASH,
            hypercertId: MOCK_HYPERCERT_ID,
          }),
        },
      });

      const actor = createActor(machine);
      actor.start();
      actor.send({ type: "START_MINT", input: createMockInput() });

      // Wait for first failure
      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe("failed");
      });

      // retryCount is 0 after failure (incremented on RETRY, not on error)
      expect(actor.getSnapshot().context.retryCount).toBe(0);

      // Retry - this increments retryCount to 1
      actor.send({ type: "RETRY" });

      // Should succeed now
      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe("confirmed");
      });

      actor.stop();
    });

    it("increments retryCount on each RETRY action", async () => {
      const machine = mintHypercertMachine.provide({
        actors: {
          uploadMetadata: createRejectingActor("Always fails"),
        },
      });

      const actor = createActor(machine);
      actor.start();

      // First attempt - retryCount starts at 0
      actor.send({ type: "START_MINT", input: createMockInput() });
      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe("failed");
      });
      // retryCount is now 0 (incremented on RETRY, not on error)
      expect(actor.getSnapshot().context.retryCount).toBe(0);

      // First retry - increments to 1 and fails again
      actor.send({ type: "RETRY" });
      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe("failed");
        expect(actor.getSnapshot().context.retryCount).toBe(1);
      });

      // Second retry - increments to 2 and fails again
      actor.send({ type: "RETRY" });
      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe("failed");
        expect(actor.getSnapshot().context.retryCount).toBe(2);
      });

      // Third retry - increments to 3 and fails again
      actor.send({ type: "RETRY" });
      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe("failed");
        expect(actor.getSnapshot().context.retryCount).toBe(3);
      });

      actor.stop();
    });

    it("blocks retry when retryCount >= 3", async () => {
      const machine = mintHypercertMachine.provide({
        actors: {
          uploadMetadata: createRejectingActor("Always fails"),
        },
      });

      const actor = createActor(machine);
      actor.start();

      // Initial attempt - retryCount is 0
      actor.send({ type: "START_MINT", input: createMockInput() });
      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe("failed");
      });
      expect(actor.getSnapshot().context.retryCount).toBe(0);

      // First retry (count becomes 1)
      actor.send({ type: "RETRY" });
      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe("failed");
        expect(actor.getSnapshot().context.retryCount).toBe(1);
      });

      // Second retry (count becomes 2)
      actor.send({ type: "RETRY" });
      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe("failed");
        expect(actor.getSnapshot().context.retryCount).toBe(2);
      });

      // Third retry (count becomes 3)
      actor.send({ type: "RETRY" });
      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe("failed");
        expect(actor.getSnapshot().context.retryCount).toBe(3);
      });

      // Fourth retry should be blocked (count stays 3)
      actor.send({ type: "RETRY" });

      // Should still be in failed state with count unchanged
      expect(actor.getSnapshot().value).toBe("failed");
      expect(actor.getSnapshot().context.retryCount).toBe(3);

      actor.stop();
    });
  });

  describe("Cancel Behavior", () => {
    it("returns to idle on CANCEL from uploadingMetadata", () => {
      const machine = mintHypercertMachine.provide({
        actors: {
          uploadMetadata: createHangingActor<{ cid: string }>(),
        },
      });

      const actor = createActor(machine);
      actor.start();
      actor.send({ type: "START_MINT", input: createMockInput() });

      expect(actor.getSnapshot().value).toBe("uploadingMetadata");

      actor.send({ type: "CANCEL" });

      expect(actor.getSnapshot().value).toBe("idle");

      actor.stop();
    });

    it("returns to idle on CANCEL from uploadingAllowlist", async () => {
      const machine = mintHypercertMachine.provide({
        actors: {
          uploadMetadata: createResolvingActor({ cid: MOCK_METADATA_CID }),
          uploadAllowlist: createHangingActor<{ cid: string; merkleRoot: Hex }>(),
        },
      });

      const actor = createActor(machine);
      actor.start();
      actor.send({ type: "START_MINT", input: createMockInput() });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe("uploadingAllowlist");
      });

      actor.send({ type: "CANCEL" });

      expect(actor.getSnapshot().value).toBe("idle");

      actor.stop();
    });

    it("returns to idle on CANCEL from signing", async () => {
      const machine = mintHypercertMachine.provide({
        actors: {
          uploadMetadata: createResolvingActor({ cid: MOCK_METADATA_CID }),
          uploadAllowlist: createResolvingActor({
            cid: MOCK_ALLOWLIST_CID,
            merkleRoot: MOCK_MERKLE_ROOT,
          }),
          buildAndSignUserOp: createHangingActor<{ hash: Hex }>(),
        },
      });

      const actor = createActor(machine);
      actor.start();
      actor.send({ type: "START_MINT", input: createMockInput() });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe("signing");
      });

      actor.send({ type: "CANCEL" });

      expect(actor.getSnapshot().value).toBe("idle");

      actor.stop();
    });

    it("returns to idle on CANCEL from failed state", async () => {
      const machine = mintHypercertMachine.provide({
        actors: {
          uploadMetadata: createRejectingActor("Failed"),
        },
      });

      const actor = createActor(machine);
      actor.start();
      actor.send({ type: "START_MINT", input: createMockInput() });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe("failed");
      });

      actor.send({ type: "CANCEL" });

      expect(actor.getSnapshot().value).toBe("idle");

      actor.stop();
    });

    it("clears context on CANCEL but preserves input", () => {
      const machine = mintHypercertMachine.provide({
        actors: {
          uploadMetadata: createHangingActor<{ cid: string }>(),
        },
      });

      const actor = createActor(machine);
      actor.start();

      const input = createMockInput();
      actor.send({ type: "START_MINT", input });

      actor.send({ type: "CANCEL" });

      const context = actor.getSnapshot().context;
      // Input is preserved (clearContext keeps it)
      expect(context.input).toEqual(input);
      // Other values are cleared
      expect(context.error).toBeNull();
      expect(context.retryCount).toBe(0);

      actor.stop();
    });
  });

  describe("Confirmed State", () => {
    it("confirmed is a final state", async () => {
      const machine = mintHypercertMachine.provide({
        actors: {
          uploadMetadata: createResolvingActor({ cid: MOCK_METADATA_CID }),
          uploadAllowlist: createResolvingActor({
            cid: MOCK_ALLOWLIST_CID,
            merkleRoot: MOCK_MERKLE_ROOT,
          }),
          buildAndSignUserOp: createResolvingActor({ hash: MOCK_USER_OP_HASH }),
          pollForReceipt: createResolvingActor({
            txHash: MOCK_TX_HASH,
            hypercertId: MOCK_HYPERCERT_ID,
          }),
        },
      });

      const actor = createActor(machine);
      actor.start();
      actor.send({ type: "START_MINT", input: createMockInput() });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe("confirmed");
      });

      // Try to send events - should have no effect
      actor.send({ type: "CANCEL" });
      expect(actor.getSnapshot().value).toBe("confirmed");

      actor.send({ type: "RETRY" });
      expect(actor.getSnapshot().value).toBe("confirmed");

      actor.stop();
    });
  });

  describe("Actor Input Passing", () => {
    it("passes correct input to uploadMetadata actor", async () => {
      // The actor receives input from the machine's invoke.input function
      // In XState v5, fromPromise receives { input } where input is what invoke.input returns
      let capturedMetadata: unknown = null;

      const machine = mintHypercertMachine.provide({
        actors: {
          uploadMetadata: fromPromise<{ cid: string }, unknown>(async ({ input }) => {
            // The input includes the full MintHypercertInput structure
            capturedMetadata = (input as { metadata: unknown }).metadata;
            return { cid: MOCK_METADATA_CID };
          }),
          uploadAllowlist: createHangingActor<{ cid: string; merkleRoot: Hex }>(),
        },
      });

      const actor = createActor(machine);
      actor.start();

      const input = createMockInput();
      actor.send({ type: "START_MINT", input });

      await waitFor(() => {
        expect(capturedMetadata).not.toBeNull();
      });

      // Verify the metadata was correctly passed to the actor
      expect(capturedMetadata).toEqual(input.metadata);

      actor.stop();
    });
  });
});
