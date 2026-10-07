import { assign, fromPromise, setup } from "xstate";
import type { Address, AssessmentWorkflowParams } from "../types/domain";

// Re-export from canonical location for backwards compatibility
export type { AssessmentWorkflowParams, CreateAssessmentForm } from "../types/domain";

export interface CreateAssessmentContext {
  assessmentParams?: AssessmentWorkflowParams;
  txHash?: string;
  error?: string;
  retryCount: number;
  pendingGardenId?: Address;
}

export type CreateAssessmentEvent =
  | { type: "START"; params: AssessmentWorkflowParams }
  | { type: "SUBMIT" }
  | { type: "RETRY" }
  | { type: "CLOSE" }
  | { type: "RESTORE_PENDING"; gardenId: Address }
  | { type: "CHECK_CONFIRMATION" }
  | { type: "SWITCH_SCOPE" }
  | { type: "RESET" };

const createAssessmentSetup = setup({
  types: {
    context: {} as CreateAssessmentContext,
    events: {} as CreateAssessmentEvent,
  },
  actions: {
    storeParams: assign({
      assessmentParams: ({ event }) =>
        (event as { type: "START"; params: AssessmentWorkflowParams }).params,
      error: undefined,
      txHash: undefined,
    }),
    updateParams: assign({
      assessmentParams: ({ event }) =>
        (event as { type: "START"; params: AssessmentWorkflowParams }).params,
    }),
    clearParamsError: assign({
      assessmentParams: ({ event }) =>
        (event as { type: "START"; params: AssessmentWorkflowParams }).params,
      error: undefined,
    }),
    clearError: assign({ error: undefined }),
    clearContext: assign({
      pendingGardenId: undefined,
      assessmentParams: undefined,
      error: undefined,
      txHash: undefined,
      retryCount: 0,
    }),
    storeTxHash: assign({
      txHash: ({ event }) => (event as { type: string; output: string }).output,
      error: undefined,
    }),
    storeFailure: assign({
      error: ({ event }) => {
        const error = (event as { type: string; error: unknown }).error;
        return error instanceof Error ? error.message : String(error);
      },
    }),
    incrementRetry: assign({
      retryCount: ({ context }) => context.retryCount + 1,
    }),
    storePendingGarden: assign({
      pendingGardenId: ({ event }) => (event as { gardenId: Address }).gardenId,
    }),
  },
  actors: {
    reconcileAssessment: fromPromise<string | null>(async () => null),
    submitAssessment: fromPromise<string, AssessmentWorkflowParams & { gardenId: Address }>(
      async () => {
        throw new Error("submitAssessment actor must be provided");
      }
    ),
  },
  guards: {
    isValid: ({ context }) => {
      const params = context.assessmentParams;
      if (!params) return false;

      const toMs = (v: string | number | null): number => {
        if (v === null || v === undefined || v === 0 || v === "") return NaN;
        if (typeof v === "number") return v > 10_000_000_000 ? v : v * 1000;
        return new Date(v).getTime();
      };

      const startMs = toMs(params.startDate);
      const endMs = toMs(params.endDate);

      return (
        params.title.trim().length > 0 &&
        params.description.trim().length > 0 &&
        params.assessmentType.trim().length > 0 &&
        (typeof params.metrics === "string"
          ? params.metrics.trim().length > 0
          : params.metrics !== null &&
            params.metrics !== undefined &&
            Object.keys(params.metrics).length > 0) &&
        params.location.trim().length > 0 &&
        !Number.isNaN(startMs) &&
        !Number.isNaN(endMs) &&
        // A reporting period names whole days, each stored as its UTC midnight,
        // so a period of one day has equal ends. Only an end before the start is
        // out of order, which is all the form refuses too.
        endMs >= startMs
      );
    },
    canRetry: ({ context }) => context.retryCount < 3,
    isPending: () => false,
    hasConfirmedUid: ({ event }) => Boolean((event as { output?: string }).output),
  },
});

export const createAssessmentMachine = createAssessmentSetup.createMachine({
  id: "createAssessment",
  initial: "idle",
  context: {
    retryCount: 0,
  },
  on: {
    SWITCH_SCOPE: { target: ".idle", actions: "clearContext" },
    RESTORE_PENDING: { target: ".pending", actions: "storePendingGarden" },
  },
  states: {
    idle: {
      on: {
        START: {
          target: "validating",
          actions: "storeParams",
        },
      },
    },
    validating: {
      always: [
        {
          target: "ready",
          guard: "isValid",
        },
        {
          target: "invalid",
        },
      ],
    },
    invalid: {
      on: {
        START: {
          target: "validating",
          actions: "clearParamsError",
        },
        RESET: {
          target: "idle",
          actions: "clearContext",
        },
      },
    },
    ready: {
      on: {
        SUBMIT: {
          target: "submitting",
        },
        START: {
          target: "validating",
          actions: "updateParams",
        },
        RESET: {
          target: "idle",
          actions: "clearContext",
        },
      },
    },
    submitting: {
      // CLOSE intentionally omitted: once a transaction is in-flight it cannot
      // be cancelled on-chain. Allowing CLOSE here would hide the real outcome
      // from the user. (Matches createGarden pattern.)
      entry: "clearError",
      invoke: {
        src: "submitAssessment",
        input: ({ context }) =>
          context.assessmentParams as AssessmentWorkflowParams & {
            gardenId: Address;
          },
        onDone: {
          target: "success",
          actions: "storeTxHash",
        },
        onError: [
          { target: "pending", guard: "isPending", actions: "storeFailure" },
          {
            target: "error",
            actions: ["storeFailure", "incrementRetry"],
          },
        ],
      },
    },
    success: {
      on: {
        CLOSE: {
          target: "idle",
          actions: "clearContext",
        },
        RESET: {
          target: "idle",
          actions: "clearContext",
        },
      },
    },
    pending: { on: { CHECK_CONFIRMATION: "reconciling" } },
    reconciling: {
      invoke: {
        src: "reconcileAssessment",
        onDone: [
          { target: "success", guard: "hasConfirmedUid", actions: "storeTxHash" },
          { target: "pending" },
        ],
        onError: [
          { target: "pending", guard: "isPending" },
          { target: "error", actions: "storeFailure" },
        ],
      },
    },
    error: {
      on: {
        RETRY: {
          target: "submitting",
          guard: "canRetry",
        },
        CLOSE: {
          target: "idle",
          actions: "clearContext",
        },
        RESET: {
          target: "idle",
          actions: "clearContext",
        },
      },
    },
  },
});
