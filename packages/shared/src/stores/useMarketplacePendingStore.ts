import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Address, Hex } from "viem";
import type { BatchReference } from "../modules/transactions/batch-types";
import type { BroadcastReference } from "../modules/transactions/types";

export type MarketplaceApprovalStep = "exchangeApproved" | "minterApproved";

/** A wallet that sends both approvals together names the send with an opaque ID, not a hash. */
export type MarketplaceSubmissionReference =
  | BroadcastReference
  | Extract<BatchReference, { kind: "wallet-calls" }>;

export type MarketplacePendingSubmission =
  | {
      kind: "approval";
      /** One approval, or both when they went under one signature. */
      steps: MarketplaceApprovalStep[];
      reference?: MarketplaceSubmissionReference;
    }
  | {
      kind: "batch";
      orders: { hypercertId: string; currency: Address; signature: Hex }[];
      reference?: BroadcastReference;
    };

/** Records survive remounts/reloads, partitioned by chain, account and operation. */
export function marketplaceSubmissionScope(
  chainId: number,
  account: Address | null,
  garden?: Address
): string | null {
  return account
    ? `${chainId}:${account.toLowerCase()}:${garden?.toLowerCase() ?? "approvals"}`
    : null;
}

interface MarketplacePendingState {
  pending: Record<string, MarketplacePendingSubmission>;
  active: Record<string, boolean>;
  begin: (scope: string) => boolean;
  finish: (scope: string) => void;
  checkpoint: (scope: string, record: MarketplacePendingSubmission) => void;
  clear: (scope: string, expected?: MarketplacePendingSubmission) => void;
}

/** Before both approvals could go together, an approval record named its one `step`. */
function stepsFromVersion0(pending: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(pending).map(([scope, record]) => {
      const { step, ...rest } = record as { kind?: string; step?: MarketplaceApprovalStep };
      return [scope, rest.kind === "approval" && step ? { ...rest, steps: [step] } : record];
    })
  );
}

export const useMarketplacePendingStore = create<MarketplacePendingState>()(
  persist(
    (set, get) => ({
      pending: {},
      active: {},
      begin: (scope) => {
        if (get().active[scope] || get().pending[scope]) return false;
        set((state) => ({ active: { ...state.active, [scope]: true } }));
        return true;
      },
      finish: (scope) =>
        set((state) => {
          const { [scope]: _, ...active } = state.active;
          return { active };
        }),
      checkpoint: (scope, record) =>
        set((state) => ({ pending: { ...state.pending, [scope]: record } })),
      clear: (scope, expected) =>
        set((state) => {
          if (expected && state.pending[scope] !== expected) return state;
          const { [scope]: _, ...pending } = state.pending;
          return { pending };
        }),
    }),
    {
      name: "green-goods:marketplace-pending",
      storage: createJSONStorage(() => localStorage),
      // Do not persist the in-flight lock. Pending records remain scoped across identity changes.
      partialize: (state) => ({ pending: state.pending }),
      version: 1,
      migrate: (persisted, version) => {
        const state = persisted as { pending?: Record<string, unknown> };
        if (version >= 1 || !state?.pending)
          return state as Pick<MarketplacePendingState, "pending">;
        return { pending: stepsFromVersion0(state.pending) } as Pick<
          MarketplacePendingState,
          "pending"
        >;
      },
    }
  )
);
