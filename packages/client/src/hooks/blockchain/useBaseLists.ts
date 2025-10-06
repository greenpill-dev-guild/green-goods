import { useQuery } from "@tanstack/react-query";
import { DEFAULT_CHAIN_ID } from "@/config/blockchain";
import { getActions, getGardeners, getGardens } from "@/modules/data/greengoods";

export function useActions(chainId: number = DEFAULT_CHAIN_ID) {
  return useQuery({
    queryKey: ["actions", chainId],
    queryFn: () => getActions(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useGardens(chainId: number = DEFAULT_CHAIN_ID) {
  return useQuery({
    queryKey: ["gardens", chainId],
    queryFn: () => getGardens(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useGardeners() {
  return useQuery({
    queryKey: ["gardeners"],
    queryFn: () => getGardeners(),
    staleTime: 5 * 60 * 1000,
  });
}
