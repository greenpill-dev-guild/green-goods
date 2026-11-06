import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  LeaveGardenCommand,
  LeaveGardenPending,
} from "../modules/garden/leave-garden-command";
import { getTransactionScopeKey, type TxResult } from "../modules/transactions/types";

export function gardenLeaveScope(command: LeaveGardenCommand) {
  return `${getTransactionScopeKey(command.userAddress, command.chainId)}:${command.gardenAddress.toLowerCase()}`;
}
const STORAGE_KEY = "green-goods:garden-leave-submissions";
type PendingDeparture = TxResult & { submittedAt?: number };
interface GardenLeaveState extends LeaveGardenPending {
  pending: Record<string, PendingDeparture>;
  load(command: LeaveGardenCommand): PendingDeparture | undefined;
}

// Accepted submissions survive screen changes, sign-out and reload. Unknown receipts never
// authorize another send; only the same garden/account/chain can reconcile this reference.
export const useGardenLeaveStore = create<GardenLeaveState>()(
  persist(
    (set, get) => ({
      pending: {},
      load: (command) => get().pending[gardenLeaveScope(command)],
      record: (command, result) =>
        set((state) => {
          const key = gardenLeaveScope(command);
          return {
            pending: {
              ...state.pending,
              [key]: { ...result, submittedAt: state.pending[key]?.submittedAt ?? Date.now() },
            },
          };
        }),
      clear: (command, result) =>
        set((state) => {
          if (state.pending[gardenLeaveScope(command)]?.hash !== result.hash) return state;
          const { [gardenLeaveScope(command)]: _removed, ...pending } = state.pending;
          return { pending };
        }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ pending: state.pending }),
      merge: (saved, current) => ({
        ...current,
        pending: (saved as Partial<GardenLeaveState> | undefined)?.pending ?? {},
      }),
    }
  )
);

const reloadSubmissions = () => useGardenLeaveStore.persist?.rehydrate();

function onSubmissionStorage(event: StorageEvent) {
  if (event.key === STORAGE_KEY || event.key === null) void reloadSubmissions();
}

/** Keep the Profile and open sheet up to date when another tab checkpoints a departure. */
export function subscribeToGardenLeaveStorage() {
  // Each mounted caller needs its own listener identity for independent cleanup.
  const onStorage = (event: StorageEvent) => onSubmissionStorage(event);
  window.addEventListener("storage", onStorage);
  void reloadSubmissions();
  return () => window.removeEventListener("storage", onStorage);
}

/** Serialize checkpoint updates and signing across tabs that share the submission store. */
export async function withGardenLeaveLock<T>(run: () => Promise<T>): Promise<T> {
  const loadAndRun = async () => {
    await reloadSubmissions();
    return run();
  };
  if (!navigator.locks) return loadAndRun();
  return navigator.locks.request(STORAGE_KEY, { ifAvailable: true }, (lock) => {
    if (!lock) throw new Error("A garden departure is already being checked in another tab");
    return loadAndRun();
  });
}
