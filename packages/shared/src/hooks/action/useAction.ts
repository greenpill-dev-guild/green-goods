import { useQuery } from "@tanstack/react-query";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { actionsKeys } from "../../config/query-keys/garden";
import { GC_TIMES, STALE_TIMES } from "../../config/react-query";
import { getActions } from "../../modules/data/greengoods";
import { buildActionId } from "../../utils/action/parsers";

/** Read an action by identity even when it has aged out of the recent catalog. */
export function useAction(actionUID: number, chainId = DEFAULT_CHAIN_ID) {
  return useQuery({
    queryKey: actionsKeys.detail(chainId, actionUID),
    queryFn: async () => {
      const actions = await getActions(undefined, {
        chainId,
        actionId: buildActionId(chainId, actionUID),
      });
      return actions[0] ?? null;
    },
    staleTime: STALE_TIMES.actions,
    gcTime: GC_TIMES.baseLists,
  });
}
