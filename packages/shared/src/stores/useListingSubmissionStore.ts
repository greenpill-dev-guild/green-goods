import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Address } from "../types/domain";
import { getTransactionScopeKey, type TxResult } from "../modules/transactions/types";
import type { Hex } from "viem";

export interface ListingSubmission {
  account: Address;
  chainId: number;
  garden: Address;
  result: TxResult;
  signature: Hex;
  hypercertId: string;
  currency: Address;
}
export function listingSubmissionKey(
  account: Address,
  chainId: number,
  garden: Address,
  hypercertId?: string | bigint
): string {
  return `${getTransactionScopeKey(account, chainId)}:${garden.toLowerCase()}${hypercertId === undefined ? "" : `:${hypercertId}`}`;
}
interface State {
  pending: Record<string, ListingSubmission>;
  cancellations: Record<string, { orderId: number; result: TxResult }>;
  record: (submission: ListingSubmission) => void;
  clear: (key: string) => void;
  recordCancellation: (key: string, orderId: number, result: TxResult) => void;
  clearCancellation: (key: string) => void;
}
export const useListingSubmissionStore = create<State>()(
  persist(
    (set) => ({
      pending: {},
      cancellations: {},
      recordCancellation: (key, orderId, result) =>
        set((state) => ({ cancellations: { ...state.cancellations, [key]: { orderId, result } } })),
      clearCancellation: (key) =>
        set((state) => {
          const { [key]: _removed, ...cancellations } = state.cancellations;
          return { cancellations };
        }),
      record: (submission) =>
        set((state) => ({
          pending: {
            ...state.pending,
            [listingSubmissionKey(
              submission.account,
              submission.chainId,
              submission.garden,
              submission.hypercertId
            )]: submission,
          },
        })),
      clear: (key) =>
        set((state) => {
          const { [key]: _removed, ...pending } = state.pending;
          return { pending };
        }),
    }),
    {
      name: "green-goods:listing-submissions",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ pending: state.pending, cancellations: state.cancellations }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<State>;
        return {
          ...current,
          cancellations: saved.cancellations ?? {},
          pending: Object.fromEntries(
            Object.values(saved.pending ?? {}).map((submission) => [
              listingSubmissionKey(
                submission.account,
                submission.chainId,
                submission.garden,
                submission.hypercertId
              ),
              submission,
            ])
          ),
        };
      },
    }
  )
);
