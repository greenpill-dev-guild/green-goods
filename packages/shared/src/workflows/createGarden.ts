/**
 * Create Garden State Machine
 *
 * Manages the garden creation workflow. This machine is decoupled from
 * external stores - all state is received through events.
 *
 * @module workflows/createGarden
 */

import { assign, fromPromise, setup } from "xstate";

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
    goToNextStep: () => {},
    goToPreviousStep: () => {},
    goToReviewStep: () => {},
    goToFirstIncompleteStep: () => {},
    storeTxHash: assign(({ event }) => {
      if (event.type !== "done.invoke.submitGarden") return {};
      return {
        txHash: event.output,
        retryCount: 0,
      };
    }),
    storeFailure: assign(({ event }) => {
      if (event.type !== "error.platform.submitGarden") return {};
      const error = event.error;
      let message = "Failed to create garden";
      if (error instanceof Error) {
        message = error.message;
      } else if (typeof error === "string") {
        message = error;
      } else {
        try {
          message = JSON.stringify(error);
        } catch {
          message = "Failed to create garden";
        }
      }
      return { error: message };
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
    // Placeholder actor with proper typing - actual implementation provided when machine is used
    submitGarden: fromPromise<string, void>(async () => {
      throw new Error("submitGarden actor not implemented");
    }),
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
            actions: "goToReviewStep",
          },
          {
            guard: "canGoForward",
            actions: "goToNextStep",
          },
        ],
        BACK: {
          guard: "canGoBack",
          actions: "goToPreviousStep",
        },
        REVIEW: {
          guard: "isReviewReady",
          target: "review",
          actions: "goToReviewStep",
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
          actions: "goToFirstIncompleteStep",
        },
        BACK: {
          guard: "canGoBack",
          target: "collecting",
          actions: "goToPreviousStep",
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
      },
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
