import { resetCreateGardenStore, useCreateGardenStore } from "@green-goods/shared/stores";
import { createGardenMachine } from "@green-goods/shared/workflows";
import { beforeEach, describe, expect, it } from "vitest";
import { createActor, fromPromise } from "xstate";

const GARDENER_ONE = "0x1234567890123456789012345678901234567890";
const GARDENER_TWO = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";

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

    actor.send({ type: "NEXT" });
    expect(useCreateGardenStore.getState().currentStep).toBe(0);

    actor.stop();
  });

  it("progresses through steps when the form is valid", () => {
    const actor = createActor(createGardenMachine);
    actor.start();
    actor.send({ type: "OPEN" });

    populateGardenDetails();
    actor.send({ type: "NEXT" });
    expect(useCreateGardenStore.getState().currentStep).toBe(1);

    populateGardenTeam();
    actor.send({ type: "NEXT" });
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
    actor.send({ type: "NEXT" });
    populateGardenTeam();
    actor.send({ type: "NEXT" });

    actor.send({ type: "SUBMIT" });
    // Wait for the actor to process
    await new Promise((resolve) => setTimeout(resolve, 50));

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
    actor.send({ type: "NEXT" });
    populateGardenTeam();
    actor.send({ type: "NEXT" });

    actor.send({ type: "SUBMIT" });
    // Wait for the actor to process
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(actor.getSnapshot().value).toBe("error");
    expect(actor.getSnapshot().context.error).toBe("boom");
    expect(actor.getSnapshot().context.retryCount).toBe(1);

    actor.send({ type: "RETRY" });
    // Wait for the retry
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(actor.getSnapshot().value).toBe("success");
    expect(actor.getSnapshot().context.txHash).toBe("0xhash");

    actor.stop();
  });

  it("resets to idle when closed", () => {
    const actor = createActor(createGardenMachine);
    actor.start();
    actor.send({ type: "OPEN" });
    populateGardenDetails();
    actor.send({ type: "NEXT" });

    actor.send({ type: "CLOSE" });

    expect(actor.getSnapshot().value).toBe("idle");
    expect(actor.getSnapshot().context.retryCount).toBe(0);
    expect(useCreateGardenStore.getState().currentStep).toBe(0);

    actor.stop();
  });
});
