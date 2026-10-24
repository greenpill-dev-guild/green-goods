import { BACKGROUND_CONTEXT, withCancel } from "@earendil-works/chord/context";
import { createModels } from "@earendil-works/pi-ai/models";
import { createRegistry, Harness, MemoryStorage, type Storage, type TaskId } from "@earendil-works/pi-durable";
import { defineInvestigationTask, type InvestigationHost, type InvestigationInput, type InvestigationResult } from "./dummy-task";

// One Harness per page, over one storage, with an empty model catalog: tasks never ask Pi for a
// model (decision 4), so `createModels()` is passed without a provider. Pi 1.3.0 ships no
// IndexedDbStorage; `MemoryStorage` is the only browser storage until the 1.4.0 gate clears
// (see the G0 report), so the storage is injected and the reopen path is written against the
// `Storage` interface rather than a concrete class.

export interface GroveHarness {
  startInvestigation(input: InvestigationInput): Promise<TaskId<InvestigationResult>>;
  waitFor(id: TaskId<InvestigationResult>): Promise<{ status: string; result?: InvestigationResult; error?: string }>;
  liveTaskCount(): Promise<number>;
  /** Cancel the context every task invocation runs under and close the session: a simulated crash. */
  crash(): Promise<void>;
  close(): Promise<void>;
}

// Pi closes its storage with the session, and `MemoryStorage` then rejects every call. This
// subclass keeps its state through `close()` so a second Harness can reopen the same records in
// the same page: the closest a 1.3.0 browser build gets to a resume, and labeled as such.
class RetainedMemoryStorage extends MemoryStorage {
  override async close(): Promise<void> {}
}

export function createRetainedMemoryStorage(): Storage {
  return new RetainedMemoryStorage();
}

export async function openGroveHarness(storage: Storage, host: InvestigationHost): Promise<GroveHarness> {
  const { context, cancel } = withCancel(BACKGROUND_CONTEXT);
  const registry = createRegistry();
  registry.install({ name: "grove-g0", tasks: [defineInvestigationTask(host)] });
  const harness = await Harness.open(storage, { models: createModels(), registry }, context);
  harness.resume();
  const task = defineInvestigationTask(host);
  return {
    async startInvestigation(input) {
      const root = await harness.root(context);
      return root.commit((tx) => tx.createTask(task, input, { ownership: { kind: "conversation" } }), context);
    },
    async waitFor(id) {
      const settled = await harness.waitForTask(id, context);
      const outcome = settled.state.outcome;
      return {
        status: outcome.status,
        result: outcome.status === "completed" ? outcome.result : undefined,
        error: "error" in outcome && outcome.error ? outcome.error.message : undefined,
      };
    },
    async liveTaskCount() {
      const inspection = await harness.inspect(context);
      return inspection.tasks.length;
    },
    async crash() {
      cancel(new Error("simulated crash"));
      await harness.close(BACKGROUND_CONTEXT).catch(() => undefined);
    },
    async close() {
      await harness.close(context);
      cancel(new Error("closed"));
    },
  };
}
