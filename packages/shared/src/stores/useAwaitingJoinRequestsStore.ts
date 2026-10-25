import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { logger } from "../modules/app/logger";
import type { GardenJoinRequestSelfRecord } from "../public-contracts/join-requests";

/** Where the installed app keeps the join requests this device sent that still wait for a steward. */
export const AWAITING_JOIN_REQUESTS_STORAGE_KEY = "green-goods:awaiting-join-requests";

/** One request this device sent: when the service lets it lapse, in milliseconds since the epoch. */
interface AwaitingJoinRequest {
  expiresAt: number;
}

type RequestsByScope = Record<string, Record<string, AwaitingJoinRequest>>;

/** The scope a record belongs to, one chain and one account; none without an account. */
export function awaitingJoinRequestScope(
  chainId: number,
  account: string | null | undefined
): string | null {
  return account ? `${chainId}:${account.toLowerCase()}` : null;
}

interface AwaitingJoinRequestsState {
  /** The requests still waiting, by scope (`awaitingJoinRequestScope`) and lowercase garden id. */
  requestsByScope: RequestsByScope;
  /**
   * Note what the service said about the account's request to join one garden: a pending request
   * is kept until it expires; one answered, lapsed or not found is forgotten. `now` is in
   * milliseconds, and every request past its expiry goes with the note.
   */
  noteRequest: (
    scope: string,
    gardenId: string,
    request: Pick<GardenJoinRequestSelfRecord, "state" | "expiresAt"> | null,
    now: number
  ) => void;
  /** Forget the account's requests to these gardens: withdrawn, or the roster lists the account. */
  forgetRequests: (scope: string, gardenIds: readonly string[]) => void;
}

/**
 * Local storage read at call time, so a refused write (a full quota, blocked storage) is logged
 * and the note lasts for this session instead of breaking the request that made it.
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
      logger.warn("Could not save the join requests awaiting review", {
        source: "useAwaitingJoinRequestsStore",
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

const isTime = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** The records without the expired requests and the scopes left empty; the same object when none go. */
function pruned(requestsByScope: RequestsByScope, now: number): RequestsByScope {
  let changed = false;
  const kept: RequestsByScope = {};
  for (const [scope, requests] of Object.entries(requestsByScope)) {
    const fresh = Object.entries(requests).filter(([, request]) => request.expiresAt > now);
    if (fresh.length === 0) {
      changed = true;
    } else if (fresh.length === Object.keys(requests).length) {
      kept[scope] = requests;
    } else {
      changed = true;
      kept[scope] = Object.fromEntries(fresh);
    }
  }
  return changed ? kept : requestsByScope;
}

/** Saved records are untrusted input: a request keeps only a garden id and a future expiry, or goes. */
function parseRequestsByScope(value: unknown, now: number): RequestsByScope {
  if (!value || typeof value !== "object") return {};
  const records: RequestsByScope = {};
  for (const [scope, requests] of Object.entries(value)) {
    if (!requests || typeof requests !== "object") continue;
    const fresh: Record<string, AwaitingJoinRequest> = {};
    for (const [gardenId, request] of Object.entries(requests)) {
      const expiresAt = (request as { expiresAt?: unknown } | null)?.expiresAt;
      if (isTime(expiresAt) && expiresAt > now) fresh[gardenId.toLowerCase()] = { expiresAt };
    }
    if (Object.keys(fresh).length > 0) records[scope] = fresh;
  }
  return records;
}

/**
 * The join requests this device sent that still wait for a steward (PWA Home decision 2, DL-123).
 * A request is not membership, and the service shows one only to the account's signature, so the
 * device keeps what it sent: Home, the switcher and Explore can mark a garden Awaiting review after
 * a relaunch without asking for a signature. It is keyed by `chainId:address`, so it stays when
 * another account signs in and is never read for one, and it holds no proof, nonce or signature,
 * only a garden id and the request's expiry. A record goes once the request is answered,
 * withdrawn, lapsed, or the garden's roster lists the account.
 */
export const useAwaitingJoinRequestsStore = create<AwaitingJoinRequestsState>()(
  persist(
    (set) => ({
      requestsByScope: {},
      noteRequest: (scope, gardenId, request, now) =>
        set((state) => {
          const id = gardenId.toLowerCase();
          const expiresAt = request?.state === "pending" ? Date.parse(request.expiresAt) : NaN;
          const current = state.requestsByScope[scope];
          let next = state.requestsByScope;
          if (isTime(expiresAt) && expiresAt > now) {
            if (current?.[id]?.expiresAt !== expiresAt) {
              next = { ...next, [scope]: { ...current, [id]: { expiresAt } } };
            }
          } else if (current && id in current) {
            next = {
              ...next,
              [scope]: Object.fromEntries(Object.entries(current).filter(([key]) => key !== id)),
            };
          }
          next = pruned(next, now);
          return next === state.requestsByScope ? state : { requestsByScope: next };
        }),
      forgetRequests: (scope, gardenIds) =>
        set((state) => {
          const current = state.requestsByScope[scope];
          if (!current) return state;
          const gone = new Set(gardenIds.map((gardenId) => gardenId.toLowerCase()));
          const kept = Object.entries(current).filter(([id]) => !gone.has(id));
          if (kept.length === Object.keys(current).length) return state;
          const next = { ...state.requestsByScope };
          if (kept.length > 0) next[scope] = Object.fromEntries(kept);
          else delete next[scope];
          return { requestsByScope: next };
        }),
    }),
    {
      name: AWAITING_JOIN_REQUESTS_STORAGE_KEY,
      storage: createJSONStorage(() => deviceStorage),
      partialize: (state) => ({ requestsByScope: state.requestsByScope }),
      merge: (persisted, current) => ({
        ...current,
        requestsByScope: parseRequestsByScope(
          (persisted as { requestsByScope?: unknown } | undefined)?.requestsByScope,
          Date.now()
        ),
      }),
    }
  )
);
