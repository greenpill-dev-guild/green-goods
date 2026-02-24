import { setup, assign, fromPromise } from "xstate";
import type { Address, AssessmentWorkflowParams } from "../types/domain";

// Re-export from canonical location for backwards compatibility
export type { AssessmentWorkflowParams } from "../types/domain";
export type { CreateAssessmentForm } from "../types/domain";

export interface CreateAssessmentContext {
  assessmentParams?: AssessmentWorkflowParams;
  txHash?: string;
  error?: string;
  retryCount: number;
}

export type CreateAssessmentEvent =
  | { type: "START"; params: AssessmentWorkflowParams }
  | { type: "SUBMIT" }
  | { type: "RETRY" }
  | { type: "CLOSE" }
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
  },
  actors: {
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
        endMs > startMs
      );
    },
    canRetry: ({ context }) => context.retryCount < 3,
  },
});

export const createAssessmentMachine = createAssessmentSetup.createMachine({
  id: "createAssessment",
  initial: "idle",
  context: {
    retryCount: 0,
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
        onError: {
          target: "error",
          actions: ["storeFailure", "incrementRetry"],
        },
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
