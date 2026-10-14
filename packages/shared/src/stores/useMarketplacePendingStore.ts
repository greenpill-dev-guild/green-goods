import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Address, Hex } from "viem";
import type { BroadcastReference } from "../modules/transactions/types";

export type MarketplacePendingSubmission =
  | {
      kind: "approval";
      step: "exchangeApproved" | "minterApproved";
      reference?: BroadcastReference;
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
    }
  )
);
