import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { logger } from "../modules/app/logger";
import {
  type GardenNotificationsSeen,
  isNotificationNew,
  markNotificationsSeen,
  type SeenNotification,
} from "../modules/garden/notifications";

/** Where the installed app keeps which garden events this device has shown. */
export const GARDEN_NOTIFICATIONS_SEEN_STORAGE_KEY = "green-goods:garden-notifications-seen";

interface GardenNotificationsSeenState {
  /** One record per chain, account and garden (`gardenNotificationsScope`). */
  seenByScope: Record<string, GardenNotificationsSeen>;
  /** Record that the member was shown these events in one scope. `now` is in seconds. */
  markSeen: (scope: string, notifications: readonly SeenNotification[], now: number) => void;
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
    const { seenThrough, seen } = record as { seenThrough?: unknown; seen?: unknown };
    if (!isTime(seenThrough) || !seen || typeof seen !== "object") continue;
    records[scope] = {
      seenThrough,
      seen: Object.fromEntries(Object.entries(seen).filter(([, at]) => isTime(at))),
    };
  }
  return records;
}

/**
 * Which of a garden's events this device has shown, per chain, account and garden (DL-130).
 * It is keyed by `chainId:address` and the garden, so it stays when another account signs in
 * and is never read for one. It holds no event, only ids and times, and trims itself to a week.
 */
export const useGardenNotificationsSeenStore = create<GardenNotificationsSeenState>()(
  persist(
    (set) => ({
      seenByScope: {},
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
    }),
    {
      name: GARDEN_NOTIFICATIONS_SEEN_STORAGE_KEY,
      storage: createJSONStorage(() => deviceStorage),
      partialize: (state) => ({ seenByScope: state.seenByScope }),
      merge: (persisted, current) => ({
        ...current,
        seenByScope: parseSeenByScope(
          (persisted as { seenByScope?: unknown } | undefined)?.seenByScope
        ),
      }),
    }
  )
);
