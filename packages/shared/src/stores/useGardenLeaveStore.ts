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
interface GardenLeaveState extends LeaveGardenPending {
  pending: Record<string, TxResult>;
}

// Accepted submissions survive screen changes, sign-out and reload. Unknown receipts never
// authorize another send; only the same garden/account/chain can reconcile this reference.
export const useGardenLeaveStore = create<GardenLeaveState>()(
  persist(
    (set, get) => ({
      pending: {},
      load: (command) => get().pending[gardenLeaveScope(command)],
      record: (command, result) =>
        set((state) => ({ pending: { ...state.pending, [gardenLeaveScope(command)]: result } })),
      clear: (command, result) =>
        set((state) => {
          if (state.pending[gardenLeaveScope(command)]?.hash !== result.hash) return state;
          const { [gardenLeaveScope(command)]: _removed, ...pending } = state.pending;
          return { pending };
        }),
    }),
    {
      name: "green-goods:garden-leave-submissions",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ pending: state.pending }),
    }
  )
);
