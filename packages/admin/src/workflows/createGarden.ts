import { assign, setup } from "xstate";

import { useCreateGardenStore } from "@/stores/createGarden";

export interface CreateGardenContext {
  txHash?: string;
  error?: string;
  retryCount: number;
}

type SubmitDoneEvent = { type: "done.invoke.submitGarden"; output: string };
type SubmitErrorEvent = { type: "error.platform.submitGarden"; error: unknown };

type BaseEvents =
  | { type: "OPEN" }
  | { type: "CLOSE" }
  | { type: "RESET" }
  | { type: "NEXT" }
  | { type: "BACK" }
  | { type: "REVIEW" }
  | { type: "SUBMIT" }
  | { type: "EDIT" }
  | { type: "RETRY" }
  | { type: "CREATE_ANOTHER" };

export type CreateGardenEvent = BaseEvents | SubmitDoneEvent | SubmitErrorEvent;

const createGardenSetup = setup({
  types: {
    context: {} as CreateGardenContext,
    events: {} as CreateGardenEvent,
  },
  actions: {
    clearContext: assign({ txHash: undefined, error: undefined, retryCount: 0 }),
    clearError: assign({ error: undefined }),
    storeTxHash: assign({
      txHash: ({ event }) => (event as SubmitDoneEvent).output,
      retryCount: 0,
    }),
    storeFailure: assign({
      error: ({ event }) => {
        const error = (event as SubmitErrorEvent).error;
        if (error instanceof Error) {
          return error.message;
        }
        if (typeof error === "string") {
          return error;
        }
        try {
          return JSON.stringify(error);
        } catch {
          return "Failed to create garden";
        }
      },
    }),
    incrementRetry: assign({
      retryCount: ({ context }) => context.retryCount + 1,
    }),
    advanceStep: () => {
      useCreateGardenStore.getState().nextStep();
    },
    goBackStep: () => {
      useCreateGardenStore.getState().previousStep();
    },
    resetFormData: () => {
      useCreateGardenStore.getState().reset();
    },
    goToReviewStep: () => {
      useCreateGardenStore.getState().goToReview();
    },
    ensureReviewStep: () => {
      useCreateGardenStore.getState().goToReview();
    },
    goToFirstIncompleteStep: () => {
      useCreateGardenStore.getState().goToFirstIncompleteStep();
    },
  },
  guards: {
    canGoForward: () => useCreateGardenStore.getState().canProceed(),
    isReviewStep: () => {
      const state = useCreateGardenStore.getState();
      return state.currentStep === state.steps.length - 2 && state.canProceed();
    },
    canGoBack: () => useCreateGardenStore.getState().currentStep > 0,
    isReviewReady: () => useCreateGardenStore.getState().isReviewReady(),
    canSubmit: () => useCreateGardenStore.getState().isReviewReady(),
    canRetry: ({ context }) => context.retryCount < 3,
  },
  services: {
    submitGarden: async () => {
      throw new Error("submitGarden service not implemented");
    },
  },
});

export const createGardenMachine = createGardenSetup.createMachine({
  id: "createGarden",
  initial: "idle",
  context: {
    retryCount: 0,
  },
  states: {
    idle: {
      on: {
        OPEN: {
          target: "collecting",
          actions: ["clearContext", "resetFormData"],
        },
      },
    },
    collecting: {
      on: {
        NEXT: [
          {
            guard: "isReviewStep",
            target: "review",
            actions: "advanceStep",
          },
          {
            guard: "canGoForward",
            actions: "advanceStep",
          },
        ],
        BACK: {
          guard: "canGoBack",
          actions: "goBackStep",
        },
        REVIEW: {
          guard: "isReviewReady",
          target: "review",
          actions: "goToReviewStep",
        },
        CLOSE: {
          target: "idle",
          actions: ["clearContext", "resetFormData"],
        },
        RESET: {
          target: "idle",
          actions: ["clearContext", "resetFormData"],
        },
      },
    },
    review: {
      entry: "ensureReviewStep",
      on: {
        EDIT: {
          target: "collecting",
          actions: "goToFirstIncompleteStep",
        },
        BACK: {
          guard: "canGoBack",
          target: "collecting",
          actions: "goBackStep",
        },
        SUBMIT: {
          guard: "canSubmit",
          target: "submitting",
        },
        CLOSE: {
          target: "idle",
          actions: ["clearContext", "resetFormData"],
        },
      },
    },
    submitting: {
      entry: "clearError",
      invoke: {
        src: "submitGarden",
        onDone: {
          target: "success",
          actions: "storeTxHash",
        },
        onError: {
          target: "error",
          actions: ["storeFailure", "incrementRetry"],
        },
      },
      on: {
        CLOSE: {
          target: "idle",
          actions: ["clearContext", "resetFormData"],
        },
      },
    },
    success: {
      on: {
        CLOSE: {
          target: "idle",
          actions: ["clearContext", "resetFormData"],
        },
        CREATE_ANOTHER: {
          target: "collecting",
          actions: ["clearContext", "resetFormData"],
        },
      },
    },
    error: {
      on: {
        RETRY: {
          guard: "canRetry",
          target: "submitting",
        },
        EDIT: {
          target: "collecting",
        },
        CLOSE: {
          target: "idle",
          actions: ["clearContext", "resetFormData"],
        },
      },
    },
  },
});
