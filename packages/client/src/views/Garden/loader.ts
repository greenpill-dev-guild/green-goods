import type { LoaderFunctionArgs } from "react-router-dom";
// import { queryClient } from "@/modules/react-query";
import { ensureBaseLists } from "@/hooks/prefetch";

export async function gardenSubmitLoader(_args: LoaderFunctionArgs) {
  const { actionsPromise, gardensPromise, gardenersPromise } = ensureBaseLists();
  // Streaming: return promises for non-critical data (no defer needed)
  return {
    actions: actionsPromise,
    gardens: gardensPromise,
    gardeners: gardenersPromise,
  } as const;
}
