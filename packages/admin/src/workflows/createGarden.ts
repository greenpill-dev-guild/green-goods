import { createMachine, assign } from "xstate";
import type { CreateGardenParams } from "@/types/contracts";

export interface CreateGardenContext {
  gardenParams?: CreateGardenParams;
  txHash?: string;
  error?: string;
  retryCount: number;
}

export type CreateGardenEvent =
  | { type: "START"; params: CreateGardenParams }
  | { type: "SUBMIT" }
  | { type: "SUCCESS"; txHash: string }
  | { type: "FAILURE"; error: string }
  | { type: "RETRY" }
  | { type: "RESET" };

export const createGardenMachine = createMachine({
  id: "createGarden",
  types: {} as {
    context: CreateGardenContext;
    events: CreateGardenEvent;
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
            gardenParams: ({ event }) => event.params,
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
            const params = context.gardenParams;
            return !!(
              params?.name &&
              params?.description &&
              params?.location &&
              params?.communityToken &&
              /^0x[a-fA-F0-9]{40}$/.test(params.communityToken)
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
            gardenParams: ({ event }) => event.params,
            error: undefined,
          }),
        },
        RESET: {
          target: "idle",
          actions: assign({
            gardenParams: undefined,
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
            gardenParams: ({ event }) => event.params,
          }),
        },
        RESET: {
          target: "idle",
          actions: assign({
            gardenParams: undefined,
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
            gardenParams: undefined,
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
            gardenParams: undefined,
            error: undefined,
            txHash: undefined,
            retryCount: 0,
          }),
        },
      },
    },
  },
});
