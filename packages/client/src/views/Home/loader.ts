import { defer, type LoaderFunctionArgs } from "react-router-dom";
import { getActions, getGardens, getGardeners } from "@/modules/greengoods";
import { DEFAULT_CHAIN_ID, getEASConfig } from "@/config";
import { queryClient } from "@/modules/react-query";

export async function homeLoader(_args: LoaderFunctionArgs) {
  const chainId = DEFAULT_CHAIN_ID;

  const eas = getEASConfig(chainId);
  void eas; // currently unused here but shows available config

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

  return defer({
    actions: actionsPromise,
    gardens: gardensPromise,
    gardeners: gardenersPromise,
  });
}
