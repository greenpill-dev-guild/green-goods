import { queryClient } from "@/modules/react-query";
import { getActions, getGardens, getGardeners } from "@/modules/greengoods";
import { DEFAULT_CHAIN_ID } from "@/config";

export function ensureBaseLists(chainId: number = DEFAULT_CHAIN_ID) {
  const actionsPromise = queryClient.ensureQueryData({
    queryKey: ["actions", chainId],
    queryFn: () => getActions(),
  });
  const gardensPromise = queryClient.ensureQueryData({
    queryKey: ["gardens", chainId],
    queryFn: () => getGardens(),
  });
  const gardenersPromise = queryClient.ensureQueryData({
    queryKey: ["gardeners"],
    queryFn: () => getGardeners(),
  });

  return { actionsPromise, gardensPromise, gardenersPromise };
}

export async function ensureHomeData(chainId: number = DEFAULT_CHAIN_ID) {
  const { actionsPromise, gardensPromise, gardenersPromise } = ensureBaseLists(chainId);
  const [actions, gardens, gardeners] = await Promise.all([
    actionsPromise,
    gardensPromise,
    gardenersPromise,
  ]);
  return { actions, gardens, gardeners };
}
