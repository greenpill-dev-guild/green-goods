import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getTransactionScopeKey, type TxResult } from "../modules/transactions/types";
import type { Address } from "../types/domain";

/** One accepted Hats jar write per signer, chain and jar. */
export function hatsJarSubmissionKey(account: Address, chainId: number, jar: Address): string {
  return `${getTransactionScopeKey(account, chainId)}:${jar.toLowerCase()}`;
}

interface State {
  pending: Record<string, TxResult>;
  record: (key: string, submission: TxResult) => void;
  clear: (key: string) => void;
}

// An accepted send outlives a reload or remount here, so its jar stays locked until the receipt
// reconciles and a steward cannot sign the same recovery twice.
export const useHatsJarSubmissionStore = create<State>()(
  persist(
    (set) => ({
      pending: {},
      record: (key, submission) =>
        set((state) => ({ pending: { ...state.pending, [key]: submission } })),
      clear: (key) =>
        set((state) => {
          const { [key]: _removed, ...pending } = state.pending;
          return { pending };
        }),
    }),
    {
      name: "green-goods:hats-jar-submissions",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ pending: state.pending }),
    }
  )
);
