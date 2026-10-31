import { defineTask } from "@earendil-works/pi-durable";
import type { EffectStore } from "./effects";

// A three-phase stand-in for grove.investigation: prepare picks the chunks, work processes them
// one checkpoint at a time, apply writes one idempotent effect and ends the task with its receipt.
// Nothing here calls a model; the point is Pi's checkpointing and resume behavior.

export interface InvestigationInput {
  runId: string;
  chunkCount: number;
  chunkDelayMs: number;
  /** When true, the apply phase holds after its effect committed and before Pi's commit. */
  holdAfterApply: boolean;
}

export type InvestigationCheckpoint =
  | { phase: "prepare" }
  | { phase: "work"; nextChunk: number; processed: string[] }
  | { phase: "apply"; processed: string[] };

export interface InvestigationResult {
  runId: string;
  processed: string[];
  commandId: string;
  effectCountAfter: number;
  replayedReceipt: boolean;
}

export type PhaseEvent =
  | { kind: "prepare"; runId: string }
  | { kind: "chunk"; runId: string; chunk: string }
  | { kind: "apply-effect"; runId: string; replayed: boolean; effectCountAfter: number }
  | { kind: "apply-hold"; runId: string }
  | { kind: "terminal"; runId: string };

export interface InvestigationHost {
  effects: EffectStore;
  onEvent: (event: PhaseEvent) => void;
  /** Settles when the host lets a held apply phase go on, or rejects once `signal` aborts. */
  holdGate: (signal: AbortSignal) => Promise<void>;
}

// The task definition is pure; the host (effect store, event sink, hold gate) is bound per page.
export function defineInvestigationTask(host: InvestigationHost) {
  // The invocation's signal aborts when the Harness closes; an interrupted wait ends the phase at
  // once instead of outliving the Harness that started it.
  const sleep = (ms: number, signal: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(new Error("invocation interrupted"));
        },
        { once: true },
      );
    });

  return defineTask<InvestigationInput, InvestigationCheckpoint, InvestigationResult>({
    name: "grove.g0.investigation",
    version: 1,
    initial: () => ({ phase: "prepare" }),
    phases: {
      prepare: async (task, runtime, context) => {
        host.onEvent({ kind: "prepare", runId: task.input.runId });
        await runtime.commit(
          () => ({ status: "running", checkpoint: { phase: "work", nextChunk: 0, processed: [] } }),
          context,
        );
      },
      work: async (task, runtime, context) => {
        const { nextChunk, processed } = task.state.checkpoint;
        const chunk = `chunk-${nextChunk + 1}`;
        await sleep(task.input.chunkDelayMs, runtime.signal);
        const done = [...processed, chunk];
        const next: InvestigationCheckpoint =
          nextChunk + 1 >= task.input.chunkCount
            ? { phase: "apply", processed: done }
            : { phase: "work", nextChunk: nextChunk + 1, processed: done };
        await runtime.commit(() => ({ status: "running", checkpoint: next }), context);
        // Reported after the commit: an event means the chunk's checkpoint is durable. Work done
        // before a commit that never lands is redone after a crash; that is Pi's contract.
        host.onEvent({ kind: "chunk", runId: task.input.runId, chunk });
      },
      apply: async (task, runtime, context) => {
        const commandId = `command:${task.input.runId}`;
        const receipt = await host.effects.applyEffectOnce(commandId);
        host.onEvent({
          kind: "apply-effect",
          runId: task.input.runId,
          replayed: receipt.replayed,
          effectCountAfter: receipt.effectCountAfter,
        });
        if (task.input.holdAfterApply && !receipt.replayed) {
          host.onEvent({ kind: "apply-hold", runId: task.input.runId });
          await host.holdGate(runtime.signal);
        }
        await runtime.commit(
          () => ({
            status: "terminal",
            outcome: {
              status: "completed",
              result: {
                runId: task.input.runId,
                processed: task.state.checkpoint.processed,
                commandId,
                effectCountAfter: receipt.effectCountAfter,
                replayedReceipt: receipt.replayed,
              },
            },
          }),
          context,
        );
        host.onEvent({ kind: "terminal", runId: task.input.runId });
      },
    },
    abort: async (task, runtime, context) => {
      await runtime.commit(
        () => ({ status: "terminal", outcome: { status: "aborted", reason: `aborted ${task.input.runId}` } }),
        context,
      );
    },
  });
}
