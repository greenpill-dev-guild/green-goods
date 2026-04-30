import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { createJSONStorage, persist, subscribeWithSelector } from "zustand/middleware";
import { DEFAULT_CHAIN_ID } from "../config/blockchain";
import { useGardens } from "../hooks/blockchain/useBaseLists";
import { useRole } from "../hooks/gardener/useRole";
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
  lastGardenIdsByScope: Record<string, string | null>;
  getPersistedGardenId: (scopeKey: string | null | undefined) => string | null;
  setPersistedGardenId: (scopeKey: string, gardenId: string | null) => void;
  clearPersistedGardenId: (scopeKey: string) => void;

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

export const ADMIN_GARDEN_PREFERENCES_STORAGE_KEY = "green-goods:admin-garden-preferences";

export function getAdminGardenScopeKey(
  address: string | null | undefined,
  chainId: number | null | undefined
): string | null {
  if (!address || !chainId) return null;
  return `${chainId}:${address.toLowerCase()}`;
}

export const useAdminStore = create<AdminState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // Chain management
        selectedChainId: DEFAULT_CHAIN_ID,
        setSelectedChainId: (chainId) => set({ selectedChainId: chainId }),

        // Garden management
        selectedGarden: null,
        setSelectedGarden: (garden) => set({ selectedGarden: garden }),
        lastGardenIdsByScope: {},
        getPersistedGardenId: (scopeKey) => {
          if (!scopeKey) return null;
          return get().lastGardenIdsByScope[scopeKey] ?? null;
        },
        setPersistedGardenId: (scopeKey, gardenId) => {
          set((state) => ({
            lastGardenIdsByScope: {
              ...state.lastGardenIdsByScope,
              [scopeKey]: gardenId,
            },
          }));
        },
        clearPersistedGardenId: (scopeKey) => {
          set((state) => {
            const { [scopeKey]: _, ...rest } = state.lastGardenIdsByScope;
            return { lastGardenIdsByScope: rest };
          });
        },

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
      }),
      {
        name: ADMIN_GARDEN_PREFERENCES_STORAGE_KEY,
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({ lastGardenIdsByScope: state.lastGardenIdsByScope }),
      }
    )
  )
);

/**
 * Resets selectedGarden when it no longer exists in either the base-list
 * gardens query OR the role-confirmed operator gardens. The operator-gardens
 * cross-check matches what `useEligibleAdminGardens` does — without it, a
 * garden recovered from a stale or errored base list (a stub injected by the
 * cross-check) would land on the canvas and then be cleared a render later
 * because the raw gardens list doesn't yet expose it. No-op while either
 * query is still loading.
 */
export function useStaleGardenGuard(): void {
  const selectedGarden = useAdminStore((s) => s.selectedGarden);
  const setSelectedGarden = useAdminStore((s) => s.setSelectedGarden);
  const { data: gardens } = useGardens();
  const { operatorGardens, loading: roleLoading } = useRole();

  const operatorGardenIdSet = useMemo(
    () => new Set(operatorGardens.map((og) => og.id.toLowerCase())),
    [operatorGardens]
  );

  useEffect(() => {
    if (gardens === undefined || roleLoading) return;
    if (selectedGarden === null) return;

    const idLower = selectedGarden.id.toLowerCase();
    const stillExists =
      gardens.some((g) => g.id.toLowerCase() === idLower) || operatorGardenIdSet.has(idLower);
    if (!stillExists) {
      setSelectedGarden(null);
    }
  }, [gardens, operatorGardenIdSet, roleLoading, selectedGarden, setSelectedGarden]);
}
