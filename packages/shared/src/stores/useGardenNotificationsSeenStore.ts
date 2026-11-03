import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { logger } from "../modules/app/logger";
import {
  clearNotifications,
  type GardenNotificationsSeen,
  isNotificationNew,
  type JoinRequestsRead,
  markNotificationsSeen,
  noteJoinRequestsWaiting,
  type SeenNotification,
} from "../modules/garden/notifications";

/** Where the installed app keeps which garden events this device has shown. */
export const GARDEN_NOTIFICATIONS_SEEN_STORAGE_KEY = "green-goods:garden-notifications-seen";

interface GardenNotificationsSeenState {
  /** One record per chain, account and garden (`gardenNotificationsScope`). */
  seenByScope: Record<string, GardenNotificationsSeen>;
  /** Record that the member was shown these events in one scope. `now` is in seconds. */
  markSeen: (scope: string, notifications: readonly SeenNotification[], now: number) => void;
  /** Record that the member cleared these events from the sheet in one scope (DL-133). */
  clearAll: (scope: string, notifications: readonly SeenNotification[], now: number) => void;
  /** Each garden's join-request queue as this device last read its count, by the same scope. */
  joinRequestsByScope: Record<string, JoinRequestsRead>;
  /** Record a read of the garden's join-request count in one scope. `now` is in seconds. */
  noteJoinRequests: (scope: string, waiting: number, now: number) => void;
}

/**
 * Local storage read at call time, so a refused write (a full quota, blocked storage) is logged
 * and the marks last for this session instead of breaking the sheet that made them.
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
      logger.warn("Could not save which garden notifications were seen", {
        source: "useGardenNotificationsSeenStore",
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

/** Saved records are untrusted input: a record keeps only its well-formed marks, or goes. */
function parseSeenByScope(value: unknown): Record<string, GardenNotificationsSeen> {
  if (!value || typeof value !== "object") return {};
  const records: Record<string, GardenNotificationsSeen> = {};
  for (const [scope, record] of Object.entries(value)) {
    if (!record || typeof record !== "object") continue;
    const { seenThrough, seen, cleared } = record as {
      seenThrough?: unknown;
      seen?: unknown;
      cleared?: unknown;
    };
    if (!isTime(seenThrough) || !seen || typeof seen !== "object") continue;
    records[scope] = {
      seenThrough,
      seen: Object.fromEntries(Object.entries(seen).filter(([, at]) => isTime(at))),
      ...(cleared && typeof cleared === "object"
        ? { cleared: Object.fromEntries(Object.entries(cleared).filter(([, at]) => isTime(at))) }
        : {}),
    };
  }
  return records;
}

/** Saved queue records are untrusted too: each keeps a positive count and a time, or goes. */
function parseJoinRequestsByScope(value: unknown): Record<string, JoinRequestsRead> {
  if (!value || typeof value !== "object") return {};
  const records: Record<string, JoinRequestsRead> = {};
  for (const [scope, record] of Object.entries(value)) {
    const { waiting, since } = (record ?? {}) as { waiting?: unknown; since?: unknown };
    if (typeof waiting === "number" && Number.isSafeInteger(waiting) && waiting > 0) {
      if (isTime(since)) records[scope] = { waiting, since };
    }
  }
  return records;
}

/**
 * Which of a garden's events this device has shown, per chain, account and garden (DL-130), and
 * how many join requests it last read waiting there and since when (PRD-1381), which the bell's
 * join-request event is built from. It is keyed by `chainId:address` and the garden, so it stays
 * when another account signs in and is never read for one. It holds no event, only ids, counts
 * and times; the marks trim themselves to a week, and a queue's record goes once none wait or
 * once this browser holds no grant to read the queue with.
 */
export const useGardenNotificationsSeenStore = create<GardenNotificationsSeenState>()(
  persist(
    (set, get) => ({
      seenByScope: {},
      joinRequestsByScope: {},
      // With nothing new among the events, nothing changes: a sheet that marks on every render
      // settles instead of re-rendering itself.
      markSeen: (scope, notifications, now) =>
        set((state) => {
          const record = state.seenByScope[scope];
          if (!notifications.some((notification) => isNotificationNew(notification, record, now))) {
            return state;
          }
          return {
            seenByScope: {
              ...state.seenByScope,
              [scope]: markNotificationsSeen(record, notifications, now),
            },
          };
        }),
      clearAll: (scope, notifications, now) =>
        set((state) => {
          if (notifications.length === 0) return state;
          return {
            seenByScope: {
              ...state.seenByScope,
              [scope]: clearNotifications(state.seenByScope[scope], notifications, now),
            },
          };
        }),
      // Read on every answer of the count, so a read that moves nothing returns before `set`:
      // the persist layer writes storage on every `set`, changed or not.
      noteJoinRequests: (scope, waiting, now) => {
        const current = get().joinRequestsByScope;
        const record = noteJoinRequestsWaiting(current[scope], waiting, now);
        if (record === current[scope]) return;
        const next = { ...current };
        if (record) next[scope] = record;
        else delete next[scope];
        set({ joinRequestsByScope: next });
      },
    }),
    {
      name: GARDEN_NOTIFICATIONS_SEEN_STORAGE_KEY,
      storage: createJSONStorage(() => deviceStorage),
      partialize: (state) => ({
        seenByScope: state.seenByScope,
        joinRequestsByScope: state.joinRequestsByScope,
      }),
      merge: (persisted, current) => {
        const saved = persisted as
          | { seenByScope?: unknown; joinRequestsByScope?: unknown }
          | undefined;
        return {
          ...current,
          seenByScope: parseSeenByScope(saved?.seenByScope),
          joinRequestsByScope: parseJoinRequestsByScope(saved?.joinRequestsByScope),
        };
      },
    }
  )
);
