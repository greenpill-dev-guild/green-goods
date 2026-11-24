import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { logger } from "../modules/app/logger";

/** Where the installed app keeps each account's active garden on this device. */
export const ACTIVE_GARDEN_STORAGE_KEY = "green-goods:active-garden";

interface ActiveGardenState {
  /** The garden picked last on this device, one per chain and account (`activeGardenScope`). */
  gardenIdsByScope: Record<string, string>;
  /**
   * The gardens this device has seen each chain and account hold, lowercased, so a garden the
   * account is added to later can be announced once (`gardensAddedSince`).
   */
  seenGardenIdsByScope: Record<string, string[]>;
  /** Remember a garden for one chain and account; the next open starts there. */
  rememberGarden: (scope: string, gardenId: string) => void;
  /** Note gardens the account holds as seen on this device. Seen gardens are never forgotten. */
  markGardensSeen: (scope: string, gardenIds: readonly string[]) => void;
}

/**
 * Local storage read at call time, so a refused write (a full quota, blocked storage) is logged
 * and the choice lasts for this session instead of breaking the screen that made it.
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
      logger.warn("Could not save the active garden", { source: "useActiveGardenStore", error });
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

/** Saved choices are untrusted input: only a garden id string per scope survives. */
function parseGardenIdsByScope(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0
    )
  );
}

/** Saved gardens are untrusted input too: only a list of garden id strings per scope survives. */
function parseSeenGardenIdsByScope(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([scope, gardenIds]) =>
      Array.isArray(gardenIds)
        ? [[scope, gardenIds.filter((id): id is string => typeof id === "string" && id.length > 0)]]
        : []
    )
  );
}

/**
 * The active garden, a device preference per chain and account (PWA Home decision 8). It is
 * keyed by `chainId:address`, so it stays when another account signs in and is never read for
 * one. The UI store and the Hub keep their own keys; the Hub's candidate set differs.
 * Nothing here forgets a garden: a choice the account can no longer hold simply stops winning,
 * and a garden seen once stays seen, so leaving it and coming back is not announced as new.
 */
export const useActiveGardenStore = create<ActiveGardenState>()(
  persist(
    (set) => ({
      gardenIdsByScope: {},
      seenGardenIdsByScope: {},
      rememberGarden: (scope, gardenId) =>
        set((state) =>
          state.gardenIdsByScope[scope] === gardenId
            ? state
            : { gardenIdsByScope: { ...state.gardenIdsByScope, [scope]: gardenId } }
        ),
      markGardensSeen: (scope, gardenIds) =>
        set((state) => {
          const seen = state.seenGardenIdsByScope[scope];
          const known = new Set((seen ?? []).map((id) => id.toLowerCase()));
          const unseen = gardenIds.map((id) => id.toLowerCase()).filter((id) => !known.has(id));
          // A first read is recorded even when it holds no garden, so later gardens are new.
          if (seen && unseen.length === 0) return state;
          return {
            seenGardenIdsByScope: {
              ...state.seenGardenIdsByScope,
              [scope]: [...(seen ?? []), ...new Set(unseen)],
            },
          };
        }),
    }),
    {
      name: ACTIVE_GARDEN_STORAGE_KEY,
      storage: createJSONStorage(() => deviceStorage),
      partialize: (state) => ({
        gardenIdsByScope: state.gardenIdsByScope,
        seenGardenIdsByScope: state.seenGardenIdsByScope,
      }),
      merge: (persisted, current) => {
        const stored = persisted as
          | { gardenIdsByScope?: unknown; seenGardenIdsByScope?: unknown }
          | undefined;
        return {
          ...current,
          gardenIdsByScope: parseGardenIdsByScope(stored?.gardenIdsByScope),
          seenGardenIdsByScope: parseSeenGardenIdsByScope(stored?.seenGardenIdsByScope),
        };
      },
    }
  )
);
