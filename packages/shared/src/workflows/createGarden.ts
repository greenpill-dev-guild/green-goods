/**
 * Create Garden State Machine
 *
 * Manages the garden creation workflow. This machine is decoupled from
 * external stores - all state is received through events.
 *
 * @module workflows/createGarden
 */

import { assign, fromPromise, setup } from "xstate";

import { formatUserError } from "../utils/errors/user-messages";

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

export type CreateGardenEvent = BaseEvents | NavigationEvents;

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
      // XState v5 invoke-done events carry `output` (v4 used `done.invoke.*` type strings)
      const output = "output" in event ? (event.output as string) : undefined;
      if (!output) return {};
      return { txHash: output, retryCount: 0 };
    }),
    storeFailure: assign(({ event }) => {
      // XState v5 invoke-error events carry `error` (v4 used `error.platform.*` type strings)
      const error = "error" in event ? event.error : undefined;
      if (error === undefined) return {};
      const message = formatUserError(error);
      // formatUserError falls through to String() for non-Error/non-string types,
      // producing unhelpful output like "[object Object]". Replace with a fallback.
      const isHelpful = message.length > 0 && !message.startsWith("[object ");
      return { error: isHelpful ? message : "Failed to create garden" };
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
      // CLOSE intentionally omitted: once a transaction is in-flight it cannot
      // be cancelled on-chain. Allowing CLOSE here would hide the real outcome
      // from the user (garden created but UI shows idle).
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
