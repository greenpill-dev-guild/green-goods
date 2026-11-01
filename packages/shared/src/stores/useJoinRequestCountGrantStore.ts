import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { logger } from "../modules/app/logger";
import type { GardenJoinRequestCountGrant } from "../public-contracts/join-requests";

/** Where a steward's browser keeps the grants that read how many join requests wait. */
export const JOIN_REQUEST_COUNT_GRANTS_STORAGE_KEY = "green-goods:join-request-count-grants";

type GrantsByScope = Record<string, Record<string, GardenJoinRequestCountGrant>>;

/** The scope a grant belongs to, one chain and one account; none without an account. */
export function joinRequestCountGrantScope(
  chainId: number,
  account: string | null | undefined
): string | null {
  return account ? `${chainId}:${account.toLowerCase()}` : null;
}

interface JoinRequestCountGrantState {
  /** The grants still usable, by scope (`joinRequestCountGrantScope`) and lowercase garden id. */
  grantsByScope: GrantsByScope;
  /** Keep the grant a signed queue read returned. It replaces the garden's last one. */
  keepGrant: (scope: string, gardenId: string, grant: GardenJoinRequestCountGrant) => void;
  /** Forget a grant the service refused, unless a newer one has already replaced it. */
  forgetGrant: (scope: string, gardenId: string, token: string) => void;
  /** Forget every grant: the session ended, or another account signed in. */
  clearAll: () => void;
}

/**
 * Local storage read at call time, so a refused write (a full quota, blocked storage) is logged
 * and the grant lasts for this session instead of breaking the queue read that returned it.
 */
const deviceStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch (error) {
      logger.warn("Could not save the join-request count grant", {
        source: "useJoinRequestCountGrantStore",
        error,
      });
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      // Storage that cannot be read holds nothing to remove.
    }
  },
};

/** Saved records are untrusted input: a grant keeps only a token and a future expiry, or goes. */
function parseGrantsByScope(value: unknown, nowSeconds: number): GrantsByScope {
  if (!value || typeof value !== "object") return {};
  const records: GrantsByScope = {};
  for (const [scope, grants] of Object.entries(value)) {
    if (!grants || typeof grants !== "object") continue;
    const usable: Record<string, GardenJoinRequestCountGrant> = {};
    for (const [gardenId, grant] of Object.entries(grants)) {
      const { token, expiresAt } = (grant ?? {}) as Partial<GardenJoinRequestCountGrant>;
      if (typeof token === "string" && typeof expiresAt === "number" && expiresAt > nowSeconds) {
        usable[gardenId.toLowerCase()] = { token, expiresAt };
      }
    }
    if (Object.keys(usable).length > 0) records[scope] = usable;
  }
  return records;
}

/**
 * The grants that let this browser read how many join requests wait in a garden, for the Members
 * tab's badge (DL-134), without asking for a signature. A grant comes only from a signed queue read
 * and reads only that one number; it is the one join-request credential a browser keeps, because a
 * proof that can read names and notes must never be stored. Keyed by `chainId:address`, and cleared
 * at sign-out as well as when another account signs in.
 */
export const useJoinRequestCountGrantStore = create<JoinRequestCountGrantState>()(
  persist(
    (set, get) => ({
      grantsByScope: {},
      keepGrant: (scope, gardenId, grant) => {
        const current = get().grantsByScope;
        set({
          grantsByScope: {
            ...current,
            [scope]: { ...current[scope], [gardenId.toLowerCase()]: grant },
          },
        });
      },
      forgetGrant: (scope, gardenId, token) => {
        const current = get().grantsByScope;
        const id = gardenId.toLowerCase();
        const grants = current[scope];
        if (grants?.[id]?.token !== token) return;
        const kept = Object.entries(grants).filter(([key]) => key !== id);
        const next = { ...current };
        if (kept.length > 0) next[scope] = Object.fromEntries(kept);
        else delete next[scope];
        set({ grantsByScope: next });
      },
      clearAll: () => {
        if (Object.keys(get().grantsByScope).length > 0) set({ grantsByScope: {} });
      },
    }),
    {
      name: JOIN_REQUEST_COUNT_GRANTS_STORAGE_KEY,
      storage: createJSONStorage(() => deviceStorage),
      partialize: (state) => ({ grantsByScope: state.grantsByScope }),
      merge: (persisted, current) => ({
        ...current,
        grantsByScope: parseGrantsByScope(
          (persisted as { grantsByScope?: unknown } | undefined)?.grantsByScope,
          Math.floor(Date.now() / 1000)
        ),
      }),
    }
  )
);
