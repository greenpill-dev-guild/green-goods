import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { DEFAULT_CHAIN_ID } from "../config/blockchain";
import type { Garden as DomainGarden } from "../types/domain";

export type Garden = Pick<
  DomainGarden,
  | "id"
  | "chainId"
  | "tokenAddress"
  | "tokenID"
  | "name"
  | "description"
  | "location"
  | "bannerImage"
  | "createdAt"
  | "gardeners"
  | "operators"
>;

export type TransactionStatus = "pending" | "confirmed" | "failed";

export interface TransactionInfo {
  type: string;
  status: TransactionStatus;
}

export interface AdminState {
  // Selected chain
  selectedChainId: number;
  setSelectedChainId: (chainId: number) => void;

  // Garden management
  selectedGarden: Garden | null;
  setSelectedGarden: (garden: Garden | null) => void;

  // Transaction tracking (Record for proper reactivity)
  pendingTransactions: Record<string, TransactionInfo>;
  addPendingTransaction: (txHash: string, type: string) => void;
  updateTransactionStatus: (txHash: string, status: TransactionStatus) => void;
  removeTransaction: (txHash: string) => void;
  clearPendingTransactions: () => void;

  // Attestation tracking
  lastAttestationId: string | null;
  setLastAttestationId: (id: string | null) => void;
}

export const useAdminStore = create<AdminState>()(
  subscribeWithSelector((set, get) => ({
    // Chain management
    selectedChainId: DEFAULT_CHAIN_ID,
    setSelectedChainId: (chainId) => set({ selectedChainId: chainId }),

    // Garden management
    selectedGarden: null,
    setSelectedGarden: (garden) => set({ selectedGarden: garden }),

    // Transaction tracking
    pendingTransactions: {},
    addPendingTransaction: (txHash, type) => {
      set((state) => ({
        pendingTransactions: {
          ...state.pendingTransactions,
          [txHash]: { type, status: "pending" },
        },
      }));
    },
    updateTransactionStatus: (txHash, status) => {
      const existing = get().pendingTransactions[txHash];
      if (existing) {
        set((state) => ({
          pendingTransactions: {
            ...state.pendingTransactions,
            [txHash]: { ...existing, status },
          },
        }));
      }
    },
    removeTransaction: (txHash) => {
      set((state) => {
        const { [txHash]: _, ...rest } = state.pendingTransactions;
        return { pendingTransactions: rest };
      });
    },
    clearPendingTransactions: () => set({ pendingTransactions: {} }),

    // Attestation tracking
    lastAttestationId: null,
    setLastAttestationId: (id) => set({ lastAttestationId: id }),
  }))
);
