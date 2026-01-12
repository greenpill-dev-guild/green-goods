/**
 * Create Garden State Machine
 *
 * Manages the garden creation workflow. This machine is decoupled from
 * external stores - all state is received through events.
 *
 * @module workflows/createGarden
 */

import { assign, setup } from "xstate";

/**
 * Form validation status passed to the machine through events
 */
export interface CreateGardenFormStatus {
  /** Whether the current step is valid */
  canProceed: boolean;
  /** Whether all steps are complete and ready for review */
  isReviewReady: boolean;
  /** Whether the form is on the review step */
  isOnReviewStep: boolean;
  /** Current step index */
  currentStep: number;
  /** Total number of steps */
  totalSteps: number;
}

export interface CreateGardenContext {
  txHash?: string;
  error?: string;
  retryCount: number;
}

type SubmitDoneEvent = { type: "done.invoke.submitGarden"; output: string };
type SubmitErrorEvent = { type: "error.platform.submitGarden"; error: unknown };

/**
 * Navigation events now include form status for validation
 */
type NavigationEvents =
  | { type: "NEXT"; formStatus: CreateGardenFormStatus }
  | { type: "BACK"; formStatus: CreateGardenFormStatus }
  | { type: "REVIEW"; formStatus: CreateGardenFormStatus }
  | { type: "SUBMIT"; formStatus: CreateGardenFormStatus };

type BaseEvents =
  | { type: "OPEN" }
  | { type: "CLOSE" }
  | { type: "RESET" }
  | { type: "EDIT" }
  | { type: "RETRY" }
  | { type: "CREATE_ANOTHER" };

export type CreateGardenEvent = BaseEvents | NavigationEvents | SubmitDoneEvent | SubmitErrorEvent;

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
  },
  guards: {
    /**
     * Check if form can proceed to next step based on event data
     */
    canGoForward: ({ event }) => {
      if (!("formStatus" in event)) return false;
      return event.formStatus.canProceed;
    },
    /**
     * Check if we're navigating to review step
     */
    isReviewStep: ({ event }) => {
      if (!("formStatus" in event)) return false;
      const { currentStep, totalSteps, canProceed } = event.formStatus;
      // Review is second to last step, and we can proceed
      return currentStep === totalSteps - 2 && canProceed;
    },
    /**
     * Check if can go back (not on first step)
     */
    canGoBack: ({ event }) => {
      if (!("formStatus" in event)) return false;
      return event.formStatus.currentStep > 0;
    },
    /**
     * Check if all required steps are complete and ready for review
     */
    isReviewReady: ({ event }) => {
      if (!("formStatus" in event)) return false;
      return event.formStatus.isReviewReady;
    },
    /**
     * Check if form can be submitted
     */
    canSubmit: ({ event }) => {
      if (!("formStatus" in event)) return false;
      return event.formStatus.isReviewReady;
    },
    /**
     * Check if retry is allowed
     */
    canRetry: ({ context }) => context.retryCount < 3,
  },
  actors: {
    submitGarden: () => {
      throw new Error("submitGarden actor not implemented");
    },
  } as any,
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
          actions: "clearContext",
        },
      },
    },
    collecting: {
      on: {
        NEXT: [
          {
            guard: "isReviewStep",
            target: "review",
          },
          {
            guard: "canGoForward",
            // Navigation is handled by the hook layer, not by machine actions
          },
        ],
        BACK: {
          guard: "canGoBack",
          // Navigation is handled by the hook layer
        },
        REVIEW: {
          guard: "isReviewReady",
          target: "review",
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
    review: {
      on: {
        EDIT: {
          target: "collecting",
        },
        BACK: {
          guard: "canGoBack",
          target: "collecting",
        },
        SUBMIT: {
          guard: "canSubmit",
          target: "submitting",
        },
        CLOSE: {
          target: "idle",
          actions: "clearContext",
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
      } as any,
      on: {
        CLOSE: {
          target: "idle",
          actions: "clearContext",
        },
      },
    },
    success: {
      on: {
        CLOSE: {
          target: "idle",
          actions: "clearContext",
        },
        CREATE_ANOTHER: {
          target: "collecting",
          actions: "clearContext",
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
          actions: "clearContext",
        },
      },
    },
  },
});
