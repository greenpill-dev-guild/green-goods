import { assign, fromPromise, setup } from "xstate";
import type { Address, Hex } from "viem";

import type { AllowlistEntry, HypercertMetadata } from "../types/hypercerts";

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface MintHypercertInput {
  metadata: HypercertMetadata;
  allowlist: AllowlistEntry[];
  totalUnits: bigint;
  gardenAddress: Address;
  attestationUIDs: Hex[];
}

export interface MintHypercertSigningInput extends MintHypercertInput {
  metadataCid: string;
  merkleRoot: Hex;
}

export interface MintHypercertReceiptInput {
  hash: Hex;
}

export interface MintHypercertContext {
  input: MintHypercertInput | null;
  metadataCid: string | null;
  allowlistCid: string | null;
  merkleRoot: Hex | null;
  userOpHash: Hex | null;
  txHash: Hex | null;
  hypercertId: string | null;
  error: string | null;
  retryCount: number;
}

type MintDoneEvent = { type: "done.invoke.uploadMetadata"; output: { cid: string } };
type MintErrorEvent = { type: "error.platform.uploadMetadata"; error: unknown };

export type MintHypercertEvent =
  | { type: "START_MINT"; input: MintHypercertInput }
  | { type: "RETRY" }
  | { type: "CANCEL" }
  | MintDoneEvent
  | MintErrorEvent;

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

/** Maximum number of retry attempts before giving up */
const MAX_RETRY_COUNT = 3;

// ═══════════════════════════════════════════════════════════════════════════════
// Context Accessors (safe extraction with explicit validation)
// ═══════════════════════════════════════════════════════════════════════════════

function requireInput(context: MintHypercertContext): MintHypercertInput {
  if (!context.input) {
    throw new Error("Missing input in context - mint not properly initialized");
  }
  return context.input;
}

function requireMetadataCid(context: MintHypercertContext): string {
  if (!context.metadataCid) {
    throw new Error("Missing metadataCid in context - metadata upload not completed");
  }
  return context.metadataCid;
}

function requireMerkleRoot(context: MintHypercertContext): Hex {
  if (!context.merkleRoot) {
    throw new Error("Missing merkleRoot in context - allowlist upload not completed");
  }
  return context.merkleRoot;
}

function requireUserOpHash(context: MintHypercertContext): Hex {
  if (!context.userOpHash) {
    throw new Error("Missing userOpHash in context - signing not completed");
  }
  return context.userOpHash;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Machine Setup (XState v5)
// ═══════════════════════════════════════════════════════════════════════════════

const mintHypercertSetup = setup({
  types: {
    context: {} as MintHypercertContext,
    events: {} as MintHypercertEvent,
  },
  actions: {
    /**
     * Initializes a new mint operation by storing the input and resetting all progress state.
     * Used when starting a fresh mint from the idle state.
     */
    initializeMint: assign({
      input: ({ event }) => ("input" in event ? event.input : null),
      metadataCid: null,
      allowlistCid: null,
      merkleRoot: null,
      userOpHash: null,
      txHash: null,
      hypercertId: null,
      error: null,
      retryCount: 0,
    }),
    /**
     * Resets progress state but preserves the original input.
     * Used when canceling or resetting a failed mint attempt.
     */
    resetProgressButKeepInput: assign({
      input: ({ context }) => context.input,
      metadataCid: null,
      allowlistCid: null,
      merkleRoot: null,
      userOpHash: null,
      txHash: null,
      hypercertId: null,
      error: null,
      retryCount: 0,
    }),
    storeMetadataCid: assign({
      metadataCid: ({ event }) => (event as MintDoneEvent).output.cid,
    }),
    storeAllowlistResult: assign({
      allowlistCid: ({ event }) => (event as unknown as { output: { cid: string } }).output.cid,
      merkleRoot: ({ event }) =>
        (event as unknown as { output: { merkleRoot: Hex } }).output.merkleRoot,
    }),
    storeUserOpHash: assign({
      userOpHash: ({ event }) => (event as unknown as { output: { hash: Hex } }).output.hash,
    }),
    storeReceipt: assign({
      txHash: ({ event }) => (event as unknown as { output: { txHash: Hex } }).output.txHash,
      hypercertId: ({ event }) =>
        (event as unknown as { output: { hypercertId: string } }).output.hypercertId,
    }),
    storeError: assign({
      error: ({ event }) => {
        const err = (event as MintErrorEvent).error;
        return err instanceof Error ? err.message : String(err);
      },
    }),
    incrementRetry: assign({
      retryCount: ({ context }) => context.retryCount + 1,
    }),
    /**
     * Clears the error when retrying. Used when transitioning back to retry states.
     */
    clearError: assign({
      error: null,
    }),
  },
  guards: {
    canRetry: ({ context }) => context.retryCount < MAX_RETRY_COUNT,
    hasInput: ({ context }) => context.input !== null,
    hasMetadataCid: ({ context }) => context.metadataCid !== null,
    hasMerkleRoot: ({ context }) => context.merkleRoot !== null,
    hasUserOpHash: ({ context }) => context.userOpHash !== null,
    /** Retry from pending state (has userOpHash, no receipt yet) */
    canRetryFromPending: ({ context }) =>
      context.retryCount < MAX_RETRY_COUNT && context.userOpHash !== null,
    /** Retry from signing (has merkleRoot, no userOpHash) */
    canRetryFromSigning: ({ context }) =>
      context.retryCount < MAX_RETRY_COUNT &&
      context.merkleRoot !== null &&
      context.userOpHash === null,
    /** Retry from allowlist upload (has metadataCid, no merkleRoot) */
    canRetryFromAllowlist: ({ context }) =>
      context.retryCount < MAX_RETRY_COUNT &&
      context.metadataCid !== null &&
      context.merkleRoot === null,
  },
  actors: {
    uploadMetadata: fromPromise<{ cid: string }, MintHypercertInput>(async () => {
      throw new Error("uploadMetadata actor not implemented");
    }),
    uploadAllowlist: fromPromise<{ cid: string; merkleRoot: Hex }, MintHypercertInput>(async () => {
      throw new Error("uploadAllowlist actor not implemented");
    }),
    buildAndSignUserOp: fromPromise<{ hash: Hex }, MintHypercertSigningInput>(async () => {
      throw new Error("buildAndSignUserOp actor not implemented");
    }),
    pollForReceipt: fromPromise<{ txHash: Hex; hypercertId: string }, { hash: Hex }>(async () => {
      throw new Error("pollForReceipt actor not implemented");
    }),
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// Machine Definition
// ═══════════════════════════════════════════════════════════════════════════════

export const mintHypercertMachine = mintHypercertSetup.createMachine({
  id: "mintHypercert",
  initial: "idle",
  context: {
    input: null,
    metadataCid: null,
    allowlistCid: null,
    merkleRoot: null,
    userOpHash: null,
    txHash: null,
    hypercertId: null,
    error: null,
    retryCount: 0,
  },
  states: {
    idle: {
      on: {
        START_MINT: {
          target: "uploadingMetadata",
          actions: "initializeMint",
        },
      },
    },
    uploadingMetadata: {
      invoke: {
        src: "uploadMetadata",
        // Use safe accessor to validate input exists before proceeding
        input: ({ context }) => requireInput(context),
        onDone: {
          target: "uploadingAllowlist",
          actions: "storeMetadataCid",
        },
        onError: {
          target: "failed",
          actions: "storeError",
        },
      },
      on: {
        CANCEL: { target: "idle", actions: "resetProgressButKeepInput" },
      },
    },
    uploadingAllowlist: {
      invoke: {
        src: "uploadAllowlist",
        input: ({ context }) => requireInput(context),
        onDone: {
          target: "signing",
          actions: "storeAllowlistResult",
        },
        onError: {
          target: "failed",
          actions: "storeError",
        },
      },
      on: {
        CANCEL: { target: "idle", actions: "resetProgressButKeepInput" },
      },
    },
    signing: {
      invoke: {
        src: "buildAndSignUserOp",
        input: ({ context }): MintHypercertSigningInput => ({
          ...requireInput(context),
          metadataCid: requireMetadataCid(context),
          merkleRoot: requireMerkleRoot(context),
        }),
        onDone: {
          target: "pending",
          actions: "storeUserOpHash",
        },
        onError: {
          target: "failed",
          actions: "storeError",
        },
      },
      on: {
        CANCEL: { target: "idle", actions: "resetProgressButKeepInput" },
      },
    },
    pending: {
      invoke: {
        src: "pollForReceipt",
        input: ({ context }) => ({ hash: requireUserOpHash(context) }),
        onDone: {
          target: "confirmed",
          actions: "storeReceipt",
        },
        onError: {
          target: "failed",
          actions: "storeError",
        },
      },
      on: {
        CANCEL: { target: "idle", actions: "resetProgressButKeepInput" },
      },
    },
    confirmed: {
      type: "final",
    },
    failed: {
      on: {
        /**
         * Smart retry: Resume from the last successful state to avoid
         * re-uploading data that's already on IPFS.
         *
         * Priority order (checked first to last):
         * 1. Has userOpHash → retry polling (transaction already submitted)
         * 2. Has merkleRoot → retry signing (uploads complete)
         * 3. Has metadataCid → retry allowlist upload (metadata uploaded)
         * 4. Default → retry from beginning
         */
        RETRY: [
          {
            guard: "canRetryFromPending",
            target: "pending",
            actions: ["clearError", "incrementRetry"],
          },
          {
            guard: "canRetryFromSigning",
            target: "signing",
            actions: ["clearError", "incrementRetry"],
          },
          {
            guard: "canRetryFromAllowlist",
            target: "uploadingAllowlist",
            actions: ["clearError", "incrementRetry"],
          },
          {
            guard: "canRetry",
            target: "uploadingMetadata",
            actions: ["clearError", "incrementRetry"],
          },
        ],
        CANCEL: {
          target: "idle",
          actions: "resetProgressButKeepInput",
        },
      },
    },
  },
});
