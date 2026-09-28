import { useQuery } from "@tanstack/react-query";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { actionsKeys } from "../../config/query-keys/garden";
import { GC_TIMES, STALE_TIMES } from "../../config/react-query";
import { getActions } from "../../modules/data/greengoods";
import { getActionAtWork } from "../../modules/data/historical-action";
import { buildActionId } from "../../utils/action/parsers";

function actionQueryOptions(actionUID: number, chainId: number) {
  return {
    queryKey: actionsKeys.detail(chainId, actionUID),
    queryFn: async () => {
      const actions = await getActions(undefined, {
        chainId,
        actionIds: [buildActionId(chainId, actionUID)],
      });
      return actions[0] ?? null;
    },
    staleTime: STALE_TIMES.actions,
    gcTime: GC_TIMES.baseLists,
  };
}

/** Read by identity, or pin instructions to a Work’s submission block when supplied. */
export function useAction(actionUID: number, chainId = DEFAULT_CHAIN_ID, workUID?: string) {
  return useQuery<Awaited<ReturnType<typeof getActionAtWork>>>({
    ...actionQueryOptions(actionUID, chainId),
    ...(workUID !== undefined
      ? {
          queryKey: actionsKeys.atWork(chainId, actionUID, workUID),
          queryFn: () => getActionAtWork(actionUID, workUID, chainId),
        }
      : {}),
  });
}

/** Missing or failed identities stay absent so consumers preserve the authored title. */
export function useActionsByUID(actionUIDs: readonly number[], chainId = DEFAULT_CHAIN_ID) {
  const uids = [...new Set(actionUIDs)]
    .filter((uid) => Number.isSafeInteger(uid) && uid >= 0)
    .sort((a, b) => a - b);
  const query = useQuery({
    queryKey: actionsKeys.byUIDs(chainId, uids),
    queryFn: () =>
      getActions(undefined, {
        chainId,
        actionIds: uids.map((uid) => buildActionId(chainId, uid)),
      }),
    enabled: uids.length > 0,
    staleTime: STALE_TIMES.actions,
    gcTime: GC_TIMES.baseLists,
  });
  return query.data ?? [];
}
