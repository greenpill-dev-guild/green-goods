/**
 * Agent report lifecycle (technical brief section 5.1).
 *
 * Pure definition: the Agent persists `{ value, context }` and advances it with XState's pure
 * `transition`, applying the result only inside the same compare-and-swap transaction as the
 * draft revision. Events carry facts the coordinator established; guards only decide whether the
 * lifecycle permits them. Before an attempt is reserved, a material edit returns to collection
 * and invalidates confirmation. From `sending` onwards the confirmed revision is frozen: edits are
 * deferred, cancellation is refused and only a proven outcome moves the report on.
 */
import { assign, setup } from "xstate";

export interface ReportLifecycleContext {
  revision: number;
  confirmedRevision: number | null;
  authorizationMode: "owner" | "delegated" | null;
  /** Source entries received while the confirmed revision was frozen. */
  deferredSourceIds: string[];
}

export type ReportLifecycleEvent =
  | { type: "REVISED"; revision: number }
  | { type: "READY_FOR_REVIEW"; revision: number }
  | { type: "CONFIRMED"; revision: number }
  | { type: "ACCOUNT_REQUIRED" }
  | { type: "AUTHORITY_ESTABLISHED"; mode: "owner" | "delegated" | "grant_choice" }
  | { type: "GRANT_READY" }
  | { type: "SIGN_ONCE_CHOSEN" }
  | { type: "PREPARED" }
  | { type: "PREPARATION_FAILED" }
  | { type: "RETRY_PREPARATION" }
  | { type: "GRANT_UNAVAILABLE" }
  | { type: "ATTEMPT_RESERVED" }
  | { type: "REJECTED_BEFORE_SEND" }
  | { type: "BROADCAST" }
  | { type: "OUTCOME_UNCERTAIN" }
  | { type: "RECEIPT_VERIFIED" }
  | { type: "DEFINITIVE_FAILURE" }
  | { type: "RECEIPT_INVALIDATED" }
  | { type: "DEFERRED_INPUT"; sourceId: string }
  | { type: "CANCEL" }
  | { type: "EXPIRE" };

/** Events that may cancel or expire only while nothing is reserved for sending. */
const unreserved = {
  CANCEL: { target: "#agentReport.cancelled" },
  EXPIRE: { target: "#agentReport.expired" },
  REVISED: { target: "#agentReport.collecting", actions: "invalidateConfirmation" },
} as const;

export const agentReportLifecycle = setup({
  types: {
    context: {} as ReportLifecycleContext,
    events: {} as ReportLifecycleEvent,
  },
  guards: {
    isCurrentRevision: ({ context, event }) =>
      "revision" in event && event.revision === context.revision,
    isNewerRevision: ({ context, event }) =>
      "revision" in event && event.revision > context.revision,
    wantsOwner: ({ event }) => event.type === "AUTHORITY_ESTABLISHED" && event.mode === "owner",
    wantsDelegated: ({ event }) =>
      event.type === "AUTHORITY_ESTABLISHED" && event.mode === "delegated",
    usesDelegation: ({ context }) => context.authorizationMode === "delegated",
  },
  actions: {
    invalidateConfirmation: assign(({ context, event }) => ({
      revision: "revision" in event ? Math.max(context.revision, event.revision) : context.revision,
      confirmedRevision: null,
      authorizationMode: null,
    })),
    recordConfirmation: assign(({ event }) => ({
      confirmedRevision: "revision" in event ? event.revision : null,
    })),
    chooseOwner: assign({ authorizationMode: "owner" as const }),
    chooseDelegated: assign({ authorizationMode: "delegated" as const }),
    deferInput: assign(({ context, event }) => ({
      deferredSourceIds:
        event.type === "DEFERRED_INPUT"
          ? [...context.deferredSourceIds, event.sourceId]
          : context.deferredSourceIds,
    })),
    clearDeferred: assign({ deferredSourceIds: [] as string[] }),
  },
}).createMachine({
  id: "agentReport",
  initial: "collecting",
  context: { revision: 1, confirmedRevision: null, authorizationMode: null, deferredSourceIds: [] },
  states: {
    collecting: {
      on: {
        REVISED: { guard: "isNewerRevision", actions: "invalidateConfirmation" },
        READY_FOR_REVIEW: { guard: "isCurrentRevision", target: "review" },
        CANCEL: "cancelled",
        EXPIRE: "expired",
      },
    },
    review: {
      on: {
        ...unreserved,
        READY_FOR_REVIEW: { guard: "isCurrentRevision" },
        CONFIRMED: {
          guard: "isCurrentRevision",
          target: "authority",
          actions: "recordConfirmation",
        },
      },
    },
    authority: {
      on: {
        ...unreserved,
        ACCOUNT_REQUIRED: {},
        AUTHORITY_ESTABLISHED: [
          { guard: "wantsOwner", target: "preparing", actions: "chooseOwner" },
          { guard: "wantsDelegated", target: "preparing", actions: "chooseDelegated" },
          { target: "grantChoice" },
        ],
      },
    },
    grantChoice: {
      on: {
        ...unreserved,
        GRANT_READY: { target: "preparing", actions: "chooseDelegated" },
        SIGN_ONCE_CHOSEN: { target: "preparing", actions: "chooseOwner" },
      },
    },
    preparing: {
      on: {
        ...unreserved,
        PREPARED: [
          { guard: "usesDelegation", target: "delegatedPreflight" },
          { target: "awaitingWallet" },
        ],
        PREPARATION_FAILED: "preparationFailed",
      },
    },
    preparationFailed: {
      on: { ...unreserved, RETRY_PREPARATION: "preparing" },
    },
    awaitingWallet: {
      on: { ...unreserved, ATTEMPT_RESERVED: "sending" },
    },
    delegatedPreflight: {
      on: {
        ...unreserved,
        ATTEMPT_RESERVED: "sending",
        GRANT_UNAVAILABLE: { target: "grantChoice", actions: assign({ authorizationMode: null }) },
      },
    },
    sending: {
      on: {
        REJECTED_BEFORE_SEND: "review",
        BROADCAST: "reconciling",
        OUTCOME_UNCERTAIN: "reconciling",
        DEFERRED_INPUT: { actions: "deferInput" },
      },
    },
    reconciling: {
      on: {
        RECEIPT_VERIFIED: "published",
        DEFINITIVE_FAILURE: "review",
        DEFERRED_INPUT: { actions: "deferInput" },
      },
    },
    published: {
      on: { RECEIPT_INVALIDATED: "reconciling" },
    },
    cancelled: { type: "final" },
    expired: { type: "final" },
  },
});

export type AgentReportLifecycle = typeof agentReportLifecycle;
