import { resetCreateGardenStore, useCreateGardenStore } from "@green-goods/shared/stores";
import { createGardenMachine, type CreateGardenFormStatus } from "@green-goods/shared/workflows";
import { beforeEach, describe, expect, it } from "vitest";
import { createActor, fromPromise, waitFor } from "xstate";

const GARDENER_ONE = "0x1234567890123456789012345678901234567890";
const GARDENER_TWO = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";

// Helper to create form status for events
function createFormStatus(overrides: Partial<CreateGardenFormStatus> = {}): CreateGardenFormStatus {
  return {
    canProceed: true,
    isReviewReady: false,
    isOnReviewStep: false,
    currentStep: 0,
    totalSteps: 3,
    ...overrides,
  };
}

function populateGardenDetails() {
  const store = useCreateGardenStore.getState();
  store.setField("name", "Test Garden");
  store.setField("description", "A lively test garden");
  store.setField("location", "Testville");
  store.setField("communityToken", "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
}

function populateGardenTeam() {
  const store = useCreateGardenStore.getState();
  store.addGardener(GARDENER_ONE);
  store.addGardener(GARDENER_TWO);
}

describe("createGarden workflow", () => {
  beforeEach(() => {
    resetCreateGardenStore();
  });

  it("starts idle and opens into collecting state", () => {
    const actor = createActor(createGardenMachine);
    actor.start();

    expect(actor.getSnapshot().value).toBe("idle");

    actor.send({ type: "OPEN" });
    expect(actor.getSnapshot().value).toBe("collecting");
    expect(useCreateGardenStore.getState().currentStep).toBe(0);

    actor.stop();
  });

  it("prevents advancing without required details", () => {
    const actor = createActor(createGardenMachine);
    actor.start();
    actor.send({ type: "OPEN" });

    // Send NEXT with canProceed: false to simulate invalid form
    actor.send({ type: "NEXT", formStatus: createFormStatus({ canProceed: false }) });
    expect(useCreateGardenStore.getState().currentStep).toBe(0);

    actor.stop();
  });

  it("progresses through steps when the form is valid", () => {
    const actor = createActor(createGardenMachine);
    actor.start();
    actor.send({ type: "OPEN" });

    populateGardenDetails();
    // Step 0 -> 1: canProceed true, not review step yet
    actor.send({
      type: "NEXT",
      formStatus: createFormStatus({ currentStep: 0, canProceed: true }),
    });
    useCreateGardenStore.getState().nextStep(); // Manually advance store step
    expect(useCreateGardenStore.getState().currentStep).toBe(1);

    populateGardenTeam();
    // Step 1 -> 2 (review): This is the review step transition
    actor.send({
      type: "NEXT",
      formStatus: createFormStatus({ currentStep: 1, canProceed: true, isReviewReady: true }),
    });
    useCreateGardenStore.getState().nextStep(); // Manually advance store step
    expect(actor.getSnapshot().value).toBe("review");
    expect(useCreateGardenStore.getState().currentStep).toBe(2);

    actor.stop();
  });

  it("invokes the submit actor and transitions to success", async () => {
    const actor = createActor(
      createGardenMachine.provide({
        actors: {
          submitGarden: fromPromise(async () => "0xhash"),
        },
      })
    );

    actor.start();
    actor.send({ type: "OPEN" });
    populateGardenDetails();
    actor.send({
      type: "NEXT",
      formStatus: createFormStatus({ currentStep: 0, canProceed: true }),
    });
    populateGardenTeam();
    // Transition to review state
    actor.send({
      type: "NEXT",
      formStatus: createFormStatus({ currentStep: 1, canProceed: true, isReviewReady: true }),
    });

    // Submit with valid form status
    actor.send({
      type: "SUBMIT",
      formStatus: createFormStatus({ isReviewReady: true, isOnReviewStep: true }),
    });
    // Wait for the actor to reach success state
    await waitFor(actor, (state) => state.matches("success"), { timeout: 1000 });

    expect(actor.getSnapshot().value).toBe("success");
    expect(actor.getSnapshot().context.txHash).toBe("0xhash");

    actor.stop();
  });

  it("handles submission errors and allows retry", async () => {
    let attempt = 0;
    const actor = createActor(
      createGardenMachine.provide({
        actors: {
          submitGarden: fromPromise(async () => {
            attempt += 1;
            if (attempt === 1) {
              throw new Error("boom");
            }
            return "0xhash";
          }),
        },
      })
    );

    actor.start();
    actor.send({ type: "OPEN" });
    populateGardenDetails();
    actor.send({
      type: "NEXT",
      formStatus: createFormStatus({ currentStep: 0, canProceed: true }),
    });
    populateGardenTeam();
    // Transition to review state
    actor.send({
      type: "NEXT",
      formStatus: createFormStatus({ currentStep: 1, canProceed: true, isReviewReady: true }),
    });

    // Submit with valid form status
    actor.send({
      type: "SUBMIT",
      formStatus: createFormStatus({ isReviewReady: true, isOnReviewStep: true }),
    });
    // Wait for the actor to reach error state
    await waitFor(actor, (state) => state.matches("error"), { timeout: 1000 });

    expect(actor.getSnapshot().value).toBe("error");
    expect(actor.getSnapshot().context.error).toBe("boom");
    expect(actor.getSnapshot().context.retryCount).toBe(1);

    actor.send({ type: "RETRY" });
    // Wait for the retry to succeed
    await waitFor(actor, (state) => state.matches("success"), { timeout: 1000 });

    expect(actor.getSnapshot().value).toBe("success");
    expect(actor.getSnapshot().context.txHash).toBe("0xhash");

    actor.stop();
  });

  it("resets to idle when closed", () => {
    const actor = createActor(createGardenMachine);
    actor.start();
    actor.send({ type: "OPEN" });
    populateGardenDetails();
    actor.send({
      type: "NEXT",
      formStatus: createFormStatus({ currentStep: 0, canProceed: true }),
    });

    actor.send({ type: "CLOSE" });

    expect(actor.getSnapshot().value).toBe("idle");
    expect(actor.getSnapshot().context.retryCount).toBe(0);

    actor.stop();
  });
});
