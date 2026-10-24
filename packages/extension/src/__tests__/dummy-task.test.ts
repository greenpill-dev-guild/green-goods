import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import type { PhaseEvent } from "../execution/dummy-task";
import { EffectStore } from "../execution/effects";
import { createRetainedMemoryStorage, openGroveHarness } from "../execution/harness";

// Node proof of item 3's first half: a Harness opens with an empty model catalog and runs the
// three-phase task; a simulated crash mid-work resumes from the last checkpoint on a second
// Harness over the retained storage; a crash after apply does not duplicate the effect.

const waitUntil = async (predicate: () => boolean, timeoutMs = 10000) => {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error("timed out waiting");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};

describe("grove.g0.investigation on Pi Durable", () => {
  it("runs prepare, work and apply without a model provider", async () => {
    const effects = await EffectStore.open(indexedDB);
    await effects.reset();
    const events: PhaseEvent[] = [];
    const harness = await openGroveHarness(createRetainedMemoryStorage(), {
      effects,
      onEvent: (event) => events.push(event),
      holdGate: (signal: AbortSignal) =>
        new Promise<void>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new Error("held apply interrupted")), { once: true });
        }),
    });
    const id = await harness.startInvestigation({ runId: "run-a", chunkCount: 3, chunkDelayMs: 5, holdAfterApply: false });
    const outcome = await harness.waitFor(id);
    await harness.close();
    expect(outcome.status).toBe("completed");
    expect(outcome.result?.processed).toEqual(["chunk-1", "chunk-2", "chunk-3"]);
    expect(outcome.result?.effectCountAfter).toBe(1);
    expect(events.map((event) => event.kind)).toEqual(["prepare", "chunk", "chunk", "chunk", "apply-effect", "terminal"]);
  });

  it("resumes mid-work from the last checkpoint on a second Harness", async () => {
    const effects = await EffectStore.open(indexedDB);
    await effects.reset();
    const storage = createRetainedMemoryStorage();
    const events: Array<PhaseEvent & { harness: string }> = [];
    let label = "A";
    const host = {
      effects,
      onEvent: (event: PhaseEvent) => events.push({ ...event, harness: label }),
      holdGate: (signal: AbortSignal) =>
        new Promise<void>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new Error("held apply interrupted")), { once: true });
        }),
    };
    const first = await openGroveHarness(storage, host);
    const id = await first.startInvestigation({ runId: "run-b", chunkCount: 5, chunkDelayMs: 30, holdAfterApply: false });
    await waitUntil(() => events.filter((event) => event.kind === "chunk").length >= 2);
    await first.crash();
    label = "B";
    const second = await openGroveHarness(storage, host);
    const outcome = await second.waitFor(id);
    await second.close();
    const chunks = events.filter((event) => event.kind === "chunk").map((event) => `${event.harness}:${(event as { chunk: string }).chunk}`);
    expect(outcome.status).toBe("completed");
    expect(outcome.result?.processed).toEqual(["chunk-1", "chunk-2", "chunk-3", "chunk-4", "chunk-5"]);
    expect(chunks.filter((chunk) => chunk.startsWith("A:")).length).toBeGreaterThanOrEqual(2);
    const resumed = chunks.filter((chunk) => chunk.startsWith("B:"));
    expect(resumed.length).toBeGreaterThan(0);
    expect(resumed[0]).not.toBe("B:chunk-1");
    expect(new Set(chunks.map((chunk) => chunk.slice(2))).size).toBe(chunks.length);
  });

  it("does not apply the effect twice when the crash lands after apply committed it", async () => {
    const effects = await EffectStore.open(indexedDB);
    await effects.reset();
    const storage = createRetainedMemoryStorage();
    const events: PhaseEvent[] = [];
    const host = {
      effects,
      onEvent: (event: PhaseEvent) => events.push(event),
      holdGate: (signal: AbortSignal) =>
        new Promise<void>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new Error("held apply interrupted")), { once: true });
        }),
    };
    const first = await openGroveHarness(storage, host);
    const id = await first.startInvestigation({ runId: "run-c", chunkCount: 2, chunkDelayMs: 5, holdAfterApply: true });
    await waitUntil(() => events.some((event) => event.kind === "apply-hold"));
    expect(await effects.effectCount()).toBe(1);
    await first.crash();
    const second = await openGroveHarness(storage, host);
    const outcome = await second.waitFor(id);
    await second.close();
    expect(outcome.status).toBe("completed");
    expect(outcome.result?.replayedReceipt).toBe(true);
    expect(await effects.effectCount()).toBe(1);
    expect(events.filter((event) => event.kind === "apply-effect").map((event) => (event as { replayed: boolean }).replayed)).toEqual([false, true]);
  });
});
