import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Address } from "../types/domain";
import { getTransactionScopeKey, type TxResult } from "../modules/transactions/types";

interface ActionRegistrationState {
  pending: Record<string, TxResult>;
  edits: Record<string, { result: TxResult; fingerprint: string; confirmed: boolean }>;
  record: (account: Address, chainId: number, submission: TxResult) => void;
  clear: (account: Address, chainId: number) => void;
  recordEdit: (key: string, fingerprint: string, result: TxResult) => void;
  confirmEdit: (key: string) => void;
  clearEdit: (key: string) => void;
}

// Accepted registrations keep their own chain:address identity across sign-out
// and reload. Identity reset must not discard an operation that can still execute.
export const useActionRegistrationStore = create<ActionRegistrationState>()(
  persist(
    (set) => ({
      pending: {},
      edits: {},
      recordEdit: (key, fingerprint, result) =>
        set((state) => ({
          edits: { ...state.edits, [key]: { fingerprint, result, confirmed: false } },
        })),
      confirmEdit: (key) =>
        set((state) => ({
          edits: { ...state.edits, [key]: { ...state.edits[key], confirmed: true } },
        })),
      clearEdit: (key) =>
        set((state) => {
          const { [key]: _removed, ...edits } = state.edits;
          return { edits };
        }),
      record: (account, chainId, submission) =>
        set((state) => ({
          pending: { ...state.pending, [getTransactionScopeKey(account, chainId)]: submission },
        })),
      clear: (account, chainId) =>
        set((state) => {
          const { [getTransactionScopeKey(account, chainId)]: _removed, ...pending } =
            state.pending;
          return { pending };
        }),
    }),
    {
      name: "green-goods:action-registrations",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ pending: state.pending, edits: state.edits }),
    }
  )
);
