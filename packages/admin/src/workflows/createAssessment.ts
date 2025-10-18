import { createMachine, assign } from "xstate";
import type { CreateAssessmentForm } from "@/components/Garden/CreateAssessmentModal";

export interface CreateAssessmentContext {
  assessmentParams?: CreateAssessmentForm & { gardenId: string };
  txHash?: string;
  error?: string;
  retryCount: number;
}

export type CreateAssessmentEvent =
  | { type: "START"; params: CreateAssessmentForm & { gardenId: string } }
  | { type: "SUBMIT" }
  | { type: "SUCCESS"; txHash: string }
  | { type: "FAILURE"; error: string }
  | { type: "RETRY" }
  | { type: "RESET" };

export const createAssessmentMachine = createMachine({
  id: "createAssessment",
  types: {} as {
    context: CreateAssessmentContext;
    events: CreateAssessmentEvent;
  },
  initial: "idle",
  context: {
    retryCount: 0,
  },
  states: {
    idle: {
      on: {
        START: {
          target: "validating",
          actions: assign({
            assessmentParams: ({ event }) => event.params,
            error: undefined,
            txHash: undefined,
          }),
        },
      },
    },
    validating: {
      always: [
        {
          target: "ready",
          guard: ({ context }) => {
            const params = context.assessmentParams;
            return !!(
              params &&
              params.title.trim().length > 0 &&
              params.description.trim().length > 0 &&
              params.assessmentType.trim().length > 0 &&
              Array.isArray(params.capitals) &&
              params.capitals.length > 0 &&
              params.metrics &&
              params.location.trim().length > 0 &&
              params.startDate &&
              params.endDate &&
              new Date(params.endDate).getTime() >= new Date(params.startDate).getTime()
            );
          },
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
          actions: assign({
            assessmentParams: ({ event }) => event.params,
            error: undefined,
          }),
        },
        RESET: {
          target: "idle",
          actions: assign({
            assessmentParams: undefined,
            error: undefined,
            txHash: undefined,
            retryCount: 0,
          }),
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
          actions: assign({
            assessmentParams: ({ event }) => event.params,
          }),
        },
        RESET: {
          target: "idle",
          actions: assign({
            assessmentParams: undefined,
            error: undefined,
            txHash: undefined,
            retryCount: 0,
          }),
        },
      },
    },
    submitting: {
      on: {
        SUCCESS: {
          target: "success",
          actions: assign({
            txHash: ({ event }) => event.txHash,
            error: undefined,
          }),
        },
        FAILURE: {
          target: "error",
          actions: assign({
            error: ({ event }) => event.error,
            retryCount: ({ context }) => context.retryCount + 1,
          }),
        },
      },
    },
    success: {
      on: {
        RESET: {
          target: "idle",
          actions: assign({
            assessmentParams: undefined,
            error: undefined,
            txHash: undefined,
            retryCount: 0,
          }),
        },
      },
    },
    error: {
      on: {
        RETRY: {
          target: "submitting",
          guard: ({ context }) => context.retryCount < 3,
        },
        RESET: {
          target: "idle",
          actions: assign({
            assessmentParams: undefined,
            error: undefined,
            txHash: undefined,
            retryCount: 0,
          }),
        },
      },
    },
  },
});
