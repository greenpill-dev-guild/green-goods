/**
 * createAssessmentMachine Tests
 *
 * Tests state transitions, automatic validation (always transitions),
 * retry limit, error handling, context management, and invoked actor flow.
 *
 * Since the machine now uses invoke for submitting (fromPromise actor),
 * tests provide mock actors via machine.provide() to control outcomes.
 */

import { createActor, fromPromise } from "xstate";
import { describe, expect, it } from "vitest";

import {
  createAssessmentMachine,
  type CreateAssessmentForm,
} from "../../workflows/createAssessment";
import type { Address } from "../../types/domain";

// ============================================
// Test Helpers
// ============================================

const TEST_GARDEN_ADDRESS = "0x1234567890123456789012345678901234567890" as Address;
const TEST_GARDEN_ADDRESS_2 = "0xAbCdEf0123456789AbCdEf0123456789AbCdEf01" as Address;
const BASE_TIMESTAMP = 1700000000000; // Fixed timestamp for tests

function createValidParams(overrides: Partial<CreateAssessmentForm> = {}): CreateAssessmentForm {
  return {
    gardenId: TEST_GARDEN_ADDRESS,
    title: "Urban Garden Assessment",
    description: "Assessment of the urban garden conservation work",
    assessmentType: "biodiversity",
    capitals: ["natural", "social"],
    metrics: { biodiversityScore: 85 },
    evidenceMedia: [],
    reportDocuments: [],
    impactAttestations: [],
    startDate: BASE_TIMESTAMP,
    endDate: BASE_TIMESTAMP + 86400000, // +1 day
    location: "Portland, OR",
    tags: ["urban", "conservation"],
    ...overrides,
  };
}

/**
 * Creates a payload matching the actual shape sent by CreateAssessment.tsx v2 form.
 * The v2 form doesn't collect capitals — it uses domain-based assessment types instead.
 */
function createV2FormPayload(): CreateAssessmentForm {
  return {
    gardenId: TEST_GARDEN_ADDRESS_2,
    title: "Solar Panel Installation Assessment",
    description: "Assessment of solar panel conservation work in Portland",
    assessmentType: "domain-0",
    capitals: [], // v2 form sends empty capitals
    metrics: {
      diagnosis: "Root cause analysis of solar adoption barriers",
      smartOutcomes: [{ description: "Install 50 panels", metric: "panels", target: 50 }],
      cynefinPhase: 1,
      domain: 0,
      selectedActionUIDs: ["action-1", "action-2"],
      sdgTargets: [7, 13],
    },
    evidenceMedia: [],
    reportDocuments: [],
    impactAttestations: [],
    startDate: Math.floor(new Date("2025-01-01").getTime() / 1000),
    endDate: Math.floor(new Date("2025-06-30").getTime() / 1000),
    location: "Portland, OR",
    tags: ["sdg-7", "sdg-13"],
  };
}

function createInvalidParams(overrides: Partial<CreateAssessmentForm> = {}): CreateAssessmentForm {
  return {
    gardenId: TEST_GARDEN_ADDRESS,
    title: "", // Empty title = invalid
    description: "",
    assessmentType: "",
    capitals: [],
    metrics: {},
    evidenceMedia: [],
    reportDocuments: [],
    impactAttestations: [],
    startDate: 0,
    endDate: 0,
    location: "",
    tags: [],
    ...overrides,
  };
}

/** Creates a machine variant with a mock actor that resolves immediately */
function createMachineWithSuccessActor(uid = "0xSuccessUID") {
  return createAssessmentMachine.provide({
    actors: {
      submitAssessment: fromPromise<string, CreateAssessmentForm>(async () => uid),
    },
  });
}

/** Creates a machine variant with a mock actor that rejects immediately */
function createMachineWithFailureActor(errorMsg = "Transaction failed") {
  return createAssessmentMachine.provide({
    actors: {
      submitAssessment: fromPromise<string, CreateAssessmentForm>(async () => {
        throw new Error(errorMsg);
      }),
    },
  });
}

// ============================================
// Tests
// ============================================

describe("workflows/createAssessmentMachine", () => {
  // ------------------------------------------
  // Initial state
  // ------------------------------------------

  describe("initial state", () => {
    it("starts in idle state", () => {
      const actor = createActor(createAssessmentMachine);
      actor.start();

      expect(actor.getSnapshot().value).toBe("idle");
      expect(actor.getSnapshot().context.retryCount).toBe(0);
      expect(actor.getSnapshot().context.assessmentParams).toBeUndefined();
      expect(actor.getSnapshot().context.txHash).toBeUndefined();
      expect(actor.getSnapshot().context.error).toBeUndefined();

      actor.stop();
    });
  });

  // ------------------------------------------
  // idle -> validating -> ready (valid params)
  // ------------------------------------------

  describe("START with valid params", () => {
    it("transitions through validating to ready", () => {
      const actor = createActor(createAssessmentMachine);
      actor.start();

      actor.send({ type: "START", params: createValidParams() });

      // validating is a transient state (always transitions immediately)
      expect(actor.getSnapshot().value).toBe("ready");
      actor.stop();
    });

    it("stores assessment params in context", () => {
      const actor = createActor(createAssessmentMachine);
      actor.start();

      const params = createValidParams();
      actor.send({ type: "START", params });

      expect(actor.getSnapshot().context.assessmentParams).toEqual(params);
      actor.stop();
    });

    it("accepts empty capitals array (v2 form payload)", () => {
      const actor = createActor(createAssessmentMachine);
      actor.start();

      actor.send({
        type: "START",
        params: createValidParams({ capitals: [] }),
      });

      expect(actor.getSnapshot().value).toBe("ready");
      actor.stop();
    });

    it("accepts the exact v2 form payload shape from CreateAssessment.tsx", () => {
      const actor = createActor(createAssessmentMachine);
      actor.start();

      actor.send({
        type: "START",
        params: createV2FormPayload(),
      });

      expect(actor.getSnapshot().value).toBe("ready");
      expect(actor.getSnapshot().context.assessmentParams).toEqual(createV2FormPayload());
      actor.stop();
    });
  });

  // ------------------------------------------
  // idle -> validating -> invalid (invalid params)
  // ------------------------------------------

  describe("START with invalid params", () => {
    it("transitions to invalid with empty title", () => {
      const actor = createActor(createAssessmentMachine);
      actor.start();

      actor.send({
        type: "START",
        params: createInvalidParams(),
      });

      expect(actor.getSnapshot().value).toBe("invalid");
      actor.stop();
    });

    it("transitions to invalid with empty capitals array when all other fields are also empty", () => {
      const actor = createActor(createAssessmentMachine);
      actor.start();

      actor.send({
        type: "START",
        params: createInvalidParams({ capitals: [] }),
      });

      expect(actor.getSnapshot().value).toBe("invalid");
      actor.stop();
    });

    it("transitions to invalid with empty location", () => {
      const actor = createActor(createAssessmentMachine);
      actor.start();

      actor.send({
        type: "START",
        params: createValidParams({ location: "" }),
      });

      expect(actor.getSnapshot().value).toBe("invalid");
      actor.stop();
    });

    it("transitions to invalid with missing assessment type", () => {
      const actor = createActor(createAssessmentMachine);
      actor.start();

      actor.send({
        type: "START",
        params: createValidParams({ assessmentType: "" }),
      });

      expect(actor.getSnapshot().value).toBe("invalid");
      actor.stop();
    });

    it("transitions to invalid with endDate before startDate", () => {
      const actor = createActor(createAssessmentMachine);
      actor.start();

      actor.send({
        type: "START",
        params: createValidParams({
          startDate: BASE_TIMESTAMP + 86400000,
          endDate: BASE_TIMESTAMP,
        }),
      });

      expect(actor.getSnapshot().value).toBe("invalid");
      actor.stop();
    });

    it("transitions to invalid with zero startDate", () => {
      const actor = createActor(createAssessmentMachine);
      actor.start();

      actor.send({
        type: "START",
        params: createValidParams({ startDate: 0 }),
      });

      expect(actor.getSnapshot().value).toBe("invalid");
      actor.stop();
    });

    it("transitions to invalid with whitespace-only title", () => {
      const actor = createActor(createAssessmentMachine);
      actor.start();

      actor.send({
        type: "START",
        params: createValidParams({ title: "   " }),
      });

      expect(actor.getSnapshot().value).toBe("invalid");
      actor.stop();
    });
  });

  // ------------------------------------------
  // invalid state
  // ------------------------------------------

  describe("invalid state", () => {
    it("allows re-START with corrected params to reach ready", () => {
      const actor = createActor(createAssessmentMachine);
      actor.start();

      // Start with invalid params
      actor.send({ type: "START", params: createInvalidParams() });
      expect(actor.getSnapshot().value).toBe("invalid");

      // Re-start with valid params
      actor.send({ type: "START", params: createValidParams() });
      expect(actor.getSnapshot().value).toBe("ready");

      actor.stop();
    });

    it("allows RESET from invalid", () => {
      const actor = createActor(createAssessmentMachine);
      actor.start();

      actor.send({ type: "START", params: createInvalidParams() });
      expect(actor.getSnapshot().value).toBe("invalid");

      actor.send({ type: "RESET" });

      expect(actor.getSnapshot().value).toBe("idle");
      expect(actor.getSnapshot().context.assessmentParams).toBeUndefined();
      expect(actor.getSnapshot().context.retryCount).toBe(0);

      actor.stop();
    });
  });

  // ------------------------------------------
  // ready state
  // ------------------------------------------

  describe("ready state", () => {
    it("transitions to submitting on SUBMIT (with actor)", async () => {
      const machine = createMachineWithSuccessActor();
      const actor = createActor(machine);
      actor.start();

      actor.send({ type: "START", params: createValidParams() });
      expect(actor.getSnapshot().value).toBe("ready");

      actor.send({ type: "SUBMIT" });

      // submitting invokes the actor — it resolves immediately in tests
      expect(actor.getSnapshot().value).toBe("submitting");
      actor.stop();
    });

    it("allows updating params via START", () => {
      const actor = createActor(createAssessmentMachine);
      actor.start();

      actor.send({
        type: "START",
        params: createValidParams({ title: "First" }),
      });
      expect(actor.getSnapshot().value).toBe("ready");

      const updated = createValidParams({ title: "Updated" });
      actor.send({ type: "START", params: updated });

      expect(actor.getSnapshot().value).toBe("ready");
      expect(actor.getSnapshot().context.assessmentParams?.title).toBe("Updated");

      actor.stop();
    });

    it("allows RESET from ready", () => {
      const actor = createActor(createAssessmentMachine);
      actor.start();

      actor.send({ type: "START", params: createValidParams() });
      actor.send({ type: "RESET" });

      expect(actor.getSnapshot().value).toBe("idle");
      expect(actor.getSnapshot().context.assessmentParams).toBeUndefined();

      actor.stop();
    });
  });

  // ------------------------------------------
  // submitting state (invoked actor)
  // ------------------------------------------

  describe("submitting state", () => {
    it("allows CLOSE while submitting to return to idle", () => {
      const machine = createAssessmentMachine.provide({
        actors: {
          submitAssessment: fromPromise<string, CreateAssessmentForm>(
            async () =>
              await new Promise<string>((resolve) => {
                setTimeout(() => resolve("0xDelayedSuccess"), 1000);
              })
          ),
        },
      });
      const actor = createActor(machine);
      actor.start();

      actor.send({ type: "START", params: createValidParams() });
      actor.send({ type: "SUBMIT" });
      expect(actor.getSnapshot().value).toBe("submitting");

      actor.send({ type: "CLOSE" });

      expect(actor.getSnapshot().value).toBe("idle");
      expect(actor.getSnapshot().context.assessmentParams).toBeUndefined();
      expect(actor.getSnapshot().context.error).toBeUndefined();
      expect(actor.getSnapshot().context.txHash).toBeUndefined();
      expect(actor.getSnapshot().context.retryCount).toBe(0);

      actor.stop();
    });

    it("transitions to success when actor resolves", async () => {
      const machine = createMachineWithSuccessActor("0xSuccessTxHash");
      const actor = createActor(machine);
      actor.start();

      actor.send({ type: "START", params: createValidParams() });
      actor.send({ type: "SUBMIT" });

      // Wait for the fromPromise actor to resolve
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(actor.getSnapshot().value).toBe("success");
      expect(actor.getSnapshot().context.txHash).toBe("0xSuccessTxHash");
      expect(actor.getSnapshot().context.error).toBeUndefined();

      actor.stop();
    });

    it("transitions to error when actor rejects", async () => {
      const machine = createMachineWithFailureActor("Gas estimation failed");
      const actor = createActor(machine);
      actor.start();

      actor.send({ type: "START", params: createValidParams() });
      actor.send({ type: "SUBMIT" });

      // Wait for the fromPromise actor to reject
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(actor.getSnapshot().value).toBe("error");
      expect(actor.getSnapshot().context.error).toBe("Gas estimation failed");
      expect(actor.getSnapshot().context.retryCount).toBe(1);

      actor.stop();
    });
  });

  // ------------------------------------------
  // success state
  // ------------------------------------------

  describe("success state", () => {
    it("resets to idle on RESET", async () => {
      const machine = createMachineWithSuccessActor("0xHash");
      const actor = createActor(machine);
      actor.start();

      actor.send({ type: "START", params: createValidParams() });
      actor.send({ type: "SUBMIT" });

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(actor.getSnapshot().value).toBe("success");

      actor.send({ type: "RESET" });

      const ctx = actor.getSnapshot().context;
      expect(actor.getSnapshot().value).toBe("idle");
      expect(ctx.assessmentParams).toBeUndefined();
      expect(ctx.txHash).toBeUndefined();
      expect(ctx.error).toBeUndefined();
      expect(ctx.retryCount).toBe(0);

      actor.stop();
    });
  });

  // ------------------------------------------
  // error state & retry
  // ------------------------------------------

  describe("error state", () => {
    async function goToError() {
      const machine = createMachineWithFailureActor("Transaction failed");
      const actor = createActor(machine);
      actor.start();

      actor.send({ type: "START", params: createValidParams() });
      actor.send({ type: "SUBMIT" });

      await new Promise((resolve) => setTimeout(resolve, 10));

      return actor;
    }

    it("allows RETRY when retryCount < 3", async () => {
      const actor = await goToError();
      expect(actor.getSnapshot().context.retryCount).toBe(1);

      actor.send({ type: "RETRY" });

      // RETRY transitions to submitting, which invokes the actor again
      expect(actor.getSnapshot().value).toBe("submitting");
      actor.stop();
    });

    it("blocks RETRY when retryCount >= 3", async () => {
      const machine = createMachineWithFailureActor("Fail");
      const actor = createActor(machine);
      actor.start();

      actor.send({ type: "START", params: createValidParams() });

      // Fail 3 times (retryCount 1, 2, 3)
      actor.send({ type: "SUBMIT" });
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(actor.getSnapshot().context.retryCount).toBe(1);

      actor.send({ type: "RETRY" });
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(actor.getSnapshot().context.retryCount).toBe(2);

      actor.send({ type: "RETRY" });
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(actor.getSnapshot().context.retryCount).toBe(3);

      // Fourth retry should be blocked
      actor.send({ type: "RETRY" });
      expect(actor.getSnapshot().value).toBe("error");
      expect(actor.getSnapshot().context.retryCount).toBe(3);

      actor.stop();
    });

    it("allows RESET from error", async () => {
      const actor = await goToError();

      actor.send({ type: "RESET" });

      expect(actor.getSnapshot().value).toBe("idle");
      expect(actor.getSnapshot().context.error).toBeUndefined();
      expect(actor.getSnapshot().context.retryCount).toBe(0);

      actor.stop();
    });

    it("preserves assessmentParams in error state", async () => {
      const params = createValidParams();
      const machine = createMachineWithFailureActor("Failed");
      const actor = createActor(machine);
      actor.start();

      actor.send({ type: "START", params });
      actor.send({ type: "SUBMIT" });
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(actor.getSnapshot().context.assessmentParams).toEqual(params);
      actor.stop();
    });
  });

  // ------------------------------------------
  // Full workflow
  // ------------------------------------------

  describe("full workflow", () => {
    it("completes full happy path: idle -> ready -> submitting -> success -> idle", async () => {
      const machine = createMachineWithSuccessActor("0xFinalHash");
      const actor = createActor(machine);
      actor.start();

      expect(actor.getSnapshot().value).toBe("idle");

      actor.send({ type: "START", params: createValidParams() });
      expect(actor.getSnapshot().value).toBe("ready");

      actor.send({ type: "SUBMIT" });
      expect(actor.getSnapshot().value).toBe("submitting");

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(actor.getSnapshot().value).toBe("success");
      expect(actor.getSnapshot().context.txHash).toBe("0xFinalHash");

      actor.send({ type: "RESET" });
      expect(actor.getSnapshot().value).toBe("idle");

      actor.stop();
    });

    it("completes error recovery path: error -> retry -> submitting -> success", async () => {
      // First attempt fails, retry succeeds
      let attempt = 0;
      const machine = createAssessmentMachine.provide({
        actors: {
          submitAssessment: fromPromise<string, CreateAssessmentForm>(async () => {
            attempt++;
            if (attempt === 1) {
              throw new Error("First attempt failed");
            }
            return "0xRetrySuccess";
          }),
        },
      });

      const actor = createActor(machine);
      actor.start();

      actor.send({ type: "START", params: createValidParams() });
      actor.send({ type: "SUBMIT" });

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(actor.getSnapshot().value).toBe("error");

      actor.send({ type: "RETRY" });
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(actor.getSnapshot().value).toBe("success");
      expect(actor.getSnapshot().context.txHash).toBe("0xRetrySuccess");

      actor.stop();
    });

    it("completes invalid correction path: invalid -> re-start -> ready", () => {
      const actor = createActor(createAssessmentMachine);
      actor.start();

      actor.send({ type: "START", params: createInvalidParams() });
      expect(actor.getSnapshot().value).toBe("invalid");

      actor.send({
        type: "START",
        params: createValidParams({ title: "Fixed Title" }),
      });
      expect(actor.getSnapshot().value).toBe("ready");
      expect(actor.getSnapshot().context.assessmentParams?.title).toBe("Fixed Title");

      actor.stop();
    });

    it("clears error after RESET and new START", async () => {
      const machine = createMachineWithFailureActor("Previous error");
      const actor = createActor(machine);
      actor.start();

      actor.send({ type: "START", params: createValidParams() });
      actor.send({ type: "SUBMIT" });

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(actor.getSnapshot().context.error).toBe("Previous error");

      actor.send({ type: "RESET" });
      actor.send({ type: "START", params: createValidParams() });

      expect(actor.getSnapshot().context.error).toBeUndefined();
      actor.stop();
    });
  });
});
