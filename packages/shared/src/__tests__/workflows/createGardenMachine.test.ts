/**
 * createGardenMachine Tests
 *
 * Tests state transitions, form status guards, validation gates,
 * retry logic, error recovery, and context management.
 */

import { createActor, fromPromise } from "xstate";
import { describe, expect, it, vi } from "vitest";

import { createGardenMachine, type CreateGardenFormStatus } from "../../workflows/createGarden";

// ============================================
// Test Helpers
// ============================================

/** Custom waitFor without DOM dependency */
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

function makeFormStatus(overrides: Partial<CreateGardenFormStatus> = {}): CreateGardenFormStatus {
  return {
    canProceed: false,
    isReviewReady: false,
    isOnReviewStep: false,
    currentStep: 0,
    totalSteps: 4,
    ...overrides,
  };
}

function createHangingActor<T>() {
  return fromPromise<T, void>(() => new Promise<T>(() => {}));
}

function createResolvingActor<T>(value: T) {
  return fromPromise<T, void>(() => Promise.resolve(value));
}

function createRejectingActor(error: Error | string) {
  return fromPromise<never, void>(() =>
    Promise.reject(typeof error === "string" ? new Error(error) : error)
  );
}

// ============================================
// Tests
// ============================================

describe("workflows/createGardenMachine", () => {
  // ------------------------------------------
  // Initial state
  // ------------------------------------------

  describe("initial state", () => {
    it("starts in idle state", () => {
      const actor = createActor(createGardenMachine);
      actor.start();

      expect(actor.getSnapshot().value).toBe("idle");
      expect(actor.getSnapshot().context.retryCount).toBe(0);
      expect(actor.getSnapshot().context.txHash).toBeUndefined();
      expect(actor.getSnapshot().context.error).toBeUndefined();

      actor.stop();
    });
  });

  // ------------------------------------------
  // idle -> collecting
  // ------------------------------------------

  describe("idle -> collecting", () => {
    it("transitions to collecting on OPEN", () => {
      const actor = createActor(createGardenMachine);
      actor.start();

      actor.send({ type: "OPEN" });

      expect(actor.getSnapshot().value).toBe("collecting");
      actor.stop();
    });

    it("clears context on OPEN", () => {
      const actor = createActor(createGardenMachine);
      actor.start();

      actor.send({ type: "OPEN" });

      const ctx = actor.getSnapshot().context;
      expect(ctx.txHash).toBeUndefined();
      expect(ctx.error).toBeUndefined();
      expect(ctx.retryCount).toBe(0);

      actor.stop();
    });

    it("ignores non-OPEN events in idle", () => {
      const actor = createActor(createGardenMachine);
      actor.start();

      actor.send({
        type: "NEXT",
        formStatus: makeFormStatus({ canProceed: true }),
      });

      expect(actor.getSnapshot().value).toBe("idle");
      actor.stop();
    });
  });

  // ------------------------------------------
  // collecting: navigation guards
  // ------------------------------------------

  describe("collecting navigation", () => {
    it("allows NEXT when canProceed is true", () => {
      const actor = createActor(createGardenMachine);
      actor.start();
      actor.send({ type: "OPEN" });

      actor.send({
        type: "NEXT",
        formStatus: makeFormStatus({ canProceed: true, currentStep: 0 }),
      });

      // Still in collecting (navigation is handled by hook layer)
      expect(actor.getSnapshot().value).toBe("collecting");
      actor.stop();
    });

    it("blocks NEXT when canProceed is false", () => {
      const actor = createActor(createGardenMachine);
      actor.start();
      actor.send({ type: "OPEN" });

      actor.send({
        type: "NEXT",
        formStatus: makeFormStatus({ canProceed: false }),
      });

      expect(actor.getSnapshot().value).toBe("collecting");
      actor.stop();
    });

    it("transitions to review when on second-to-last step and canProceed", () => {
      const actor = createActor(createGardenMachine);
      actor.start();
      actor.send({ type: "OPEN" });

      actor.send({
        type: "NEXT",
        formStatus: makeFormStatus({
          canProceed: true,
          currentStep: 2,
          totalSteps: 4,
        }),
      });

      expect(actor.getSnapshot().value).toBe("review");
      actor.stop();
    });

    it("stays in collecting when not on review step", () => {
      const actor = createActor(createGardenMachine);
      actor.start();
      actor.send({ type: "OPEN" });

      actor.send({
        type: "NEXT",
        formStatus: makeFormStatus({
          canProceed: true,
          currentStep: 0,
          totalSteps: 4,
        }),
      });

      expect(actor.getSnapshot().value).toBe("collecting");
      actor.stop();
    });

    it("allows BACK when currentStep > 0", () => {
      const actor = createActor(createGardenMachine);
      actor.start();
      actor.send({ type: "OPEN" });

      // BACK with currentStep > 0 should be accepted (stays in collecting)
      actor.send({
        type: "BACK",
        formStatus: makeFormStatus({ currentStep: 1 }),
      });

      expect(actor.getSnapshot().value).toBe("collecting");
      actor.stop();
    });

    it("blocks BACK when currentStep is 0", () => {
      const actor = createActor(createGardenMachine);
      actor.start();
      actor.send({ type: "OPEN" });

      actor.send({
        type: "BACK",
        formStatus: makeFormStatus({ currentStep: 0 }),
      });

      // Guard prevents BACK, stays in collecting
      expect(actor.getSnapshot().value).toBe("collecting");
      actor.stop();
    });

    it("transitions to review on REVIEW when isReviewReady", () => {
      const actor = createActor(createGardenMachine);
      actor.start();
      actor.send({ type: "OPEN" });

      actor.send({
        type: "REVIEW",
        formStatus: makeFormStatus({ isReviewReady: true }),
      });

      expect(actor.getSnapshot().value).toBe("review");
      actor.stop();
    });

    it("blocks REVIEW when not review ready", () => {
      const actor = createActor(createGardenMachine);
      actor.start();
      actor.send({ type: "OPEN" });

      actor.send({
        type: "REVIEW",
        formStatus: makeFormStatus({ isReviewReady: false }),
      });

      expect(actor.getSnapshot().value).toBe("collecting");
      actor.stop();
    });

    it("returns to idle on CLOSE", () => {
      const actor = createActor(createGardenMachine);
      actor.start();
      actor.send({ type: "OPEN" });

      actor.send({ type: "CLOSE" });

      expect(actor.getSnapshot().value).toBe("idle");
      actor.stop();
    });

    it("returns to idle on RESET", () => {
      const actor = createActor(createGardenMachine);
      actor.start();
      actor.send({ type: "OPEN" });

      actor.send({ type: "RESET" });

      expect(actor.getSnapshot().value).toBe("idle");
      actor.stop();
    });
  });

  // ------------------------------------------
  // review state
  // ------------------------------------------

  describe("review state", () => {
    function goToReview() {
      const actor = createActor(createGardenMachine);
      actor.start();
      actor.send({ type: "OPEN" });
      actor.send({
        type: "REVIEW",
        formStatus: makeFormStatus({ isReviewReady: true }),
      });
      return actor;
    }

    it("transitions to collecting on EDIT", () => {
      const actor = goToReview();
      expect(actor.getSnapshot().value).toBe("review");

      actor.send({ type: "EDIT" });

      expect(actor.getSnapshot().value).toBe("collecting");
      actor.stop();
    });

    it("transitions to collecting on BACK with valid step", () => {
      const actor = goToReview();

      actor.send({
        type: "BACK",
        formStatus: makeFormStatus({ currentStep: 2 }),
      });

      expect(actor.getSnapshot().value).toBe("collecting");
      actor.stop();
    });

    it("transitions to submitting on SUBMIT when review ready", async () => {
      const machine = createGardenMachine.provide({
        actors: {
          submitGarden: createHangingActor<string>(),
        },
      });

      const actor = createActor(machine);
      actor.start();
      actor.send({ type: "OPEN" });
      actor.send({
        type: "REVIEW",
        formStatus: makeFormStatus({ isReviewReady: true }),
      });

      actor.send({
        type: "SUBMIT",
        formStatus: makeFormStatus({ isReviewReady: true }),
      });

      expect(actor.getSnapshot().value).toBe("submitting");
      actor.stop();
    });

    it("blocks SUBMIT when not review ready", () => {
      const actor = goToReview();

      actor.send({
        type: "SUBMIT",
        formStatus: makeFormStatus({ isReviewReady: false }),
      });

      expect(actor.getSnapshot().value).toBe("review");
      actor.stop();
    });

    it("returns to idle on CLOSE", () => {
      const actor = goToReview();

      actor.send({ type: "CLOSE" });

      expect(actor.getSnapshot().value).toBe("idle");
      actor.stop();
    });
  });

  // ------------------------------------------
  // submitting state
  // ------------------------------------------

  describe("submitting state", () => {
    function goToSubmitting(actorOverride?: ReturnType<typeof createResolvingActor>) {
      const machine = createGardenMachine.provide({
        actors: {
          submitGarden: actorOverride ?? createHangingActor<string>(),
        },
      });

      const actor = createActor(machine);
      actor.start();
      actor.send({ type: "OPEN" });
      actor.send({
        type: "REVIEW",
        formStatus: makeFormStatus({ isReviewReady: true }),
      });
      actor.send({
        type: "SUBMIT",
        formStatus: makeFormStatus({ isReviewReady: true }),
      });
      return actor;
    }

    it("clears error on entry", () => {
      const actor = goToSubmitting();

      expect(actor.getSnapshot().value).toBe("submitting");
      expect(actor.getSnapshot().context.error).toBeUndefined();

      actor.stop();
    });

    it("transitions to success on submission done", async () => {
      const MOCK_TX_HASH = "0xabc123";
      const actor = goToSubmitting(createResolvingActor(MOCK_TX_HASH));

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe("success");
      });

      expect(actor.getSnapshot().context.txHash).toBe(MOCK_TX_HASH);
      expect(actor.getSnapshot().context.retryCount).toBe(0);
      actor.stop();
    });

    it("transitions to error on submission failure", async () => {
      const machine = createGardenMachine.provide({
        actors: {
          submitGarden: createRejectingActor("Gas estimation failed"),
        },
      });

      const actor = createActor(machine);
      actor.start();
      actor.send({ type: "OPEN" });
      actor.send({
        type: "REVIEW",
        formStatus: makeFormStatus({ isReviewReady: true }),
      });
      actor.send({
        type: "SUBMIT",
        formStatus: makeFormStatus({ isReviewReady: true }),
      });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe("error");
      });

      expect(actor.getSnapshot().context.error).toBe("Gas estimation failed");
      expect(actor.getSnapshot().context.retryCount).toBe(1);

      actor.stop();
    });

    it("stores error from non-Error objects", async () => {
      const machine = createGardenMachine.provide({
        actors: {
          submitGarden: fromPromise<string, void>(() => Promise.reject("string error")),
        },
      });

      const actor = createActor(machine);
      actor.start();
      actor.send({ type: "OPEN" });
      actor.send({
        type: "REVIEW",
        formStatus: makeFormStatus({ isReviewReady: true }),
      });
      actor.send({
        type: "SUBMIT",
        formStatus: makeFormStatus({ isReviewReady: true }),
      });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe("error");
      });

      expect(actor.getSnapshot().context.error).toBe("string error");
      actor.stop();
    });

    it("returns to idle on CLOSE during submission", () => {
      const actor = goToSubmitting();
      expect(actor.getSnapshot().value).toBe("submitting");

      actor.send({ type: "CLOSE" });

      expect(actor.getSnapshot().value).toBe("idle");
      actor.stop();
    });
  });

  // ------------------------------------------
  // success state
  // ------------------------------------------

  describe("success state", () => {
    async function goToSuccess() {
      const machine = createGardenMachine.provide({
        actors: {
          submitGarden: createResolvingActor("0xTxHash"),
        },
      });

      const actor = createActor(machine);
      actor.start();
      actor.send({ type: "OPEN" });
      actor.send({
        type: "REVIEW",
        formStatus: makeFormStatus({ isReviewReady: true }),
      });
      actor.send({
        type: "SUBMIT",
        formStatus: makeFormStatus({ isReviewReady: true }),
      });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe("success");
      });

      return actor;
    }

    it("returns to idle on CLOSE", async () => {
      const actor = await goToSuccess();

      actor.send({ type: "CLOSE" });

      expect(actor.getSnapshot().value).toBe("idle");
      expect(actor.getSnapshot().context.txHash).toBeUndefined();
      actor.stop();
    });

    it("returns to collecting on CREATE_ANOTHER", async () => {
      const actor = await goToSuccess();

      actor.send({ type: "CREATE_ANOTHER" });

      expect(actor.getSnapshot().value).toBe("collecting");
      expect(actor.getSnapshot().context.txHash).toBeUndefined();
      expect(actor.getSnapshot().context.retryCount).toBe(0);
      actor.stop();
    });
  });

  // ------------------------------------------
  // error state & retry
  // ------------------------------------------

  describe("error state", () => {
    async function goToError() {
      const machine = createGardenMachine.provide({
        actors: {
          submitGarden: createRejectingActor("First failure"),
        },
      });

      const actor = createActor(machine);
      actor.start();
      actor.send({ type: "OPEN" });
      actor.send({
        type: "REVIEW",
        formStatus: makeFormStatus({ isReviewReady: true }),
      });
      actor.send({
        type: "SUBMIT",
        formStatus: makeFormStatus({ isReviewReady: true }),
      });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe("error");
      });

      return actor;
    }

    it("allows RETRY when retryCount < 3", async () => {
      const actor = await goToError();

      expect(actor.getSnapshot().context.retryCount).toBe(1);

      // RETRY should transition to submitting
      actor.send({ type: "RETRY" });
      // submitting will fail again, going back to error
      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe("error");
      });

      expect(actor.getSnapshot().context.retryCount).toBe(2);
      actor.stop();
    });

    it("blocks RETRY when retryCount >= 3", async () => {
      const machine = createGardenMachine.provide({
        actors: {
          submitGarden: createRejectingActor("Always fails"),
        },
      });

      const actor = createActor(machine);
      actor.start();
      actor.send({ type: "OPEN" });
      actor.send({
        type: "REVIEW",
        formStatus: makeFormStatus({ isReviewReady: true }),
      });
      actor.send({
        type: "SUBMIT",
        formStatus: makeFormStatus({ isReviewReady: true }),
      });

      // Wait for initial error (retryCount = 1)
      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe("error");
      });

      // Retry 1 (retryCount -> 2)
      actor.send({ type: "RETRY" });
      await waitFor(() => {
        expect(actor.getSnapshot().context.retryCount).toBe(2);
      });

      // Retry 2 (retryCount -> 3)
      actor.send({ type: "RETRY" });
      await waitFor(() => {
        expect(actor.getSnapshot().context.retryCount).toBe(3);
      });

      // Retry 3 should be blocked (retryCount stays 3)
      actor.send({ type: "RETRY" });
      expect(actor.getSnapshot().value).toBe("error");
      expect(actor.getSnapshot().context.retryCount).toBe(3);

      actor.stop();
    });

    it("allows EDIT to return to collecting", async () => {
      const actor = await goToError();

      actor.send({ type: "EDIT" });

      expect(actor.getSnapshot().value).toBe("collecting");
      actor.stop();
    });

    it("allows CLOSE to return to idle", async () => {
      const actor = await goToError();

      actor.send({ type: "CLOSE" });

      expect(actor.getSnapshot().value).toBe("idle");
      expect(actor.getSnapshot().context.error).toBeUndefined();
      actor.stop();
    });
  });

  // ------------------------------------------
  // Error message extraction
  // ------------------------------------------

  describe("error message extraction", () => {
    it("extracts message from Error objects", async () => {
      const machine = createGardenMachine.provide({
        actors: {
          submitGarden: createRejectingActor(new Error("Detailed error")),
        },
      });

      const actor = createActor(machine);
      actor.start();
      actor.send({ type: "OPEN" });
      actor.send({
        type: "REVIEW",
        formStatus: makeFormStatus({ isReviewReady: true }),
      });
      actor.send({
        type: "SUBMIT",
        formStatus: makeFormStatus({ isReviewReady: true }),
      });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe("error");
      });

      expect(actor.getSnapshot().context.error).toBe("Detailed error");
      actor.stop();
    });

    it("extracts message from string errors", async () => {
      const machine = createGardenMachine.provide({
        actors: {
          submitGarden: fromPromise<string, void>(() => Promise.reject("plain string error")),
        },
      });

      const actor = createActor(machine);
      actor.start();
      actor.send({ type: "OPEN" });
      actor.send({
        type: "REVIEW",
        formStatus: makeFormStatus({ isReviewReady: true }),
      });
      actor.send({
        type: "SUBMIT",
        formStatus: makeFormStatus({ isReviewReady: true }),
      });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe("error");
      });

      expect(actor.getSnapshot().context.error).toBe("plain string error");
      actor.stop();
    });

    it("uses fallback for non-serializable errors", async () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;

      const machine = createGardenMachine.provide({
        actors: {
          submitGarden: fromPromise<string, void>(() => Promise.reject(circular)),
        },
      });

      const actor = createActor(machine);
      actor.start();
      actor.send({ type: "OPEN" });
      actor.send({
        type: "REVIEW",
        formStatus: makeFormStatus({ isReviewReady: true }),
      });
      actor.send({
        type: "SUBMIT",
        formStatus: makeFormStatus({ isReviewReady: true }),
      });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe("error");
      });

      expect(actor.getSnapshot().context.error).toBe("Failed to create garden");
      actor.stop();
    });
  });
});
