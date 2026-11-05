import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  LeaveGardenCommand,
  LeaveGardenPending,
} from "../modules/garden/leave-garden-command";
import { getTransactionScopeKey, type TxResult } from "../modules/transactions/types";

function scope(command: LeaveGardenCommand) {
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
      load: (command) => get().pending[scope(command)],
      record: (command, result) =>
        set((state) => ({ pending: { ...state.pending, [scope(command)]: result } })),
      clear: (command, result) =>
        set((state) => {
          if (state.pending[scope(command)]?.hash !== result.hash) return state;
          const { [scope(command)]: _removed, ...pending } = state.pending;
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
