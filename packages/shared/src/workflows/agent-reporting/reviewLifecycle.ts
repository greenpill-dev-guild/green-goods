/**
 * Agent steward-review lifecycle (technical brief section 5.2).
 *
 * Approve and reject both need the steward's own authority: an exact owner signature or a
 * separate, active review grant. A reporting grant never satisfies this lifecycle. Once an attempt
 * is reserved the decision revision is frozen; a definitive failure returns to discussion so the
 * steward refreshes and reconfirms rather than the agent resending.
 */
import { assign, setup } from "xstate";

export interface ReviewLifecycleContext {
  revision: number;
  confirmedRevision: number | null;
  authorizationMode: "owner" | "delegated" | null;
}

export type ReviewLifecycleEvent =
  | { type: "REVISED"; revision: number }
  | { type: "READY_FOR_REVIEW"; revision: number }
  | { type: "REQUEST_CLARIFICATION" }
  | { type: "CLARIFICATION_RECEIVED" }
  | { type: "CONFIRMED"; revision: number }
  | { type: "AUTHORITY_ESTABLISHED"; mode: "owner" | "delegated" | "grant_choice" }
  | { type: "GRANT_READY" }
  | { type: "SIGN_ONCE_CHOSEN" }
  | { type: "GRANT_UNAVAILABLE" }
  | { type: "ATTEMPT_RESERVED" }
  | { type: "REJECTED_BEFORE_SEND" }
  | { type: "BROADCAST" }
  | { type: "OUTCOME_UNCERTAIN" }
  | { type: "RECEIPT_VERIFIED" }
  | { type: "DEFINITIVE_FAILURE" }
  | { type: "RECEIPT_INVALIDATED" }
  | { type: "CANCEL" };

const beforeReservation = {
  REVISED: { target: "#agentReview.discussing", actions: "invalidateConfirmation" },
  CANCEL: { target: "#agentReview.cancelled" },
} as const;

export const agentReviewLifecycle = setup({
  types: {
    context: {} as ReviewLifecycleContext,
    events: {} as ReviewLifecycleEvent,
  },
  guards: {
    isCurrentRevision: ({ context, event }) =>
      "revision" in event && event.revision === context.revision,
    isNewerRevision: ({ context, event }) =>
      "revision" in event && event.revision > context.revision,
    wantsOwner: ({ event }) => event.type === "AUTHORITY_ESTABLISHED" && event.mode === "owner",
    wantsDelegated: ({ event }) =>
      event.type === "AUTHORITY_ESTABLISHED" && event.mode === "delegated",
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
  },
}).createMachine({
  id: "agentReview",
  initial: "discussing",
  context: { revision: 1, confirmedRevision: null, authorizationMode: null },
  states: {
    discussing: {
      on: {
        REVISED: { guard: "isNewerRevision", actions: "invalidateConfirmation" },
        READY_FOR_REVIEW: { guard: "isCurrentRevision", target: "decisionPrepared" },
        REQUEST_CLARIFICATION: "needsClarification",
        CANCEL: "cancelled",
      },
    },
    needsClarification: {
      on: { CLARIFICATION_RECEIVED: "discussing", ...beforeReservation },
    },
    decisionPrepared: {
      on: {
        ...beforeReservation,
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
        ...beforeReservation,
        AUTHORITY_ESTABLISHED: [
          {
            guard: "wantsOwner",
            target: "awaitingSignature",
            actions: assign({ authorizationMode: "owner" as const }),
          },
          {
            guard: "wantsDelegated",
            target: "delegatedPreflight",
            actions: assign({ authorizationMode: "delegated" as const }),
          },
          { target: "reviewGrantChoice" },
        ],
      },
    },
    reviewGrantChoice: {
      on: {
        ...beforeReservation,
        GRANT_READY: {
          target: "delegatedPreflight",
          actions: assign({ authorizationMode: "delegated" as const }),
        },
        SIGN_ONCE_CHOSEN: {
          target: "awaitingSignature",
          actions: assign({ authorizationMode: "owner" as const }),
        },
      },
    },
    awaitingSignature: {
      on: { ...beforeReservation, ATTEMPT_RESERVED: "sending" },
    },
    delegatedPreflight: {
      on: {
        ...beforeReservation,
        ATTEMPT_RESERVED: "sending",
        GRANT_UNAVAILABLE: {
          target: "reviewGrantChoice",
          actions: assign({ authorizationMode: null }),
        },
      },
    },
    sending: {
      on: {
        REJECTED_BEFORE_SEND: { target: "discussing", actions: "invalidateConfirmation" },
        BROADCAST: "submitted",
        OUTCOME_UNCERTAIN: "reconciling",
      },
    },
    submitted: {
      on: {
        RECEIPT_VERIFIED: "recorded",
        OUTCOME_UNCERTAIN: "reconciling",
        DEFINITIVE_FAILURE: "failed",
      },
    },
    reconciling: {
      on: { RECEIPT_VERIFIED: "recorded", DEFINITIVE_FAILURE: "failed" },
    },
    failed: {
      on: {
        REVISED: { target: "discussing", actions: "invalidateConfirmation" },
        CANCEL: "cancelled",
      },
    },
    recorded: {
      on: { RECEIPT_INVALIDATED: "reconciling" },
    },
    cancelled: { type: "final" },
  },
});

export type AgentReviewLifecycle = typeof agentReviewLifecycle;
