import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export interface Garden {
  id: string;
  chainId: number;
  tokenAddress: string;
  tokenID: bigint;
  name: string;
  description: string;
  location: string;
  bannerImage: string;
  createdAt: number;
  gardeners: string[];
  operators: string[];
}

export interface AdminState {
  // Selected chain
  selectedChainId: number;
  setSelectedChainId: (chainId: number) => void;

  // Garden management
  selectedGarden: Garden | null;
  setSelectedGarden: (garden: Garden | null) => void;

  // Transaction tracking
  pendingTransactions: Map<string, { type: string; status: "pending" | "confirmed" | "failed" }>;
  addPendingTransaction: (txHash: string, type: string) => void;
  updateTransactionStatus: (txHash: string, status: "confirmed" | "failed") => void;
  clearPendingTransactions: () => void;

  // Attestation tracking
  lastAttestationId: string | null;
  setLastAttestationId: (id: string | null) => void;

  // UI state
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const useAdminStore = create<AdminState>()(
  subscribeWithSelector((set, get) => ({
    // Chain management
    selectedChainId: 42161, // Arbitrum default
    setSelectedChainId: (chainId) => set({ selectedChainId: chainId }),

    // Garden management
    selectedGarden: null,
    setSelectedGarden: (garden) => set({ selectedGarden: garden }),

    // Transaction tracking
    pendingTransactions: new Map(),
    addPendingTransaction: (txHash, type) => {
      const current = get().pendingTransactions;
      const updated = new Map(current);
      updated.set(txHash, { type, status: "pending" });
      set({ pendingTransactions: updated });
    },
    updateTransactionStatus: (txHash, status) => {
      const current = get().pendingTransactions;
      const existing = current.get(txHash);
      if (existing) {
        const updated = new Map(current);
        updated.set(txHash, { ...existing, status });
        set({ pendingTransactions: updated });
      }
    },
    clearPendingTransactions: () => set({ pendingTransactions: new Map() }),

    // Attestation tracking
    lastAttestationId: null,
    setLastAttestationId: (id) => set({ lastAttestationId: id }),

    // UI state
    sidebarOpen: false,
    setSidebarOpen: (open) => set({ sidebarOpen: open }),
  }))
);
