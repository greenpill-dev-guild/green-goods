import { useQuery } from "@tanstack/react-query";
import { readContract } from "@wagmi/core";
import { getWagmiConfig } from "../../config/appkit";
import { getDefaultChain } from "../../config/blockchain";
import { agentReportingKeys } from "../../config/query-keys/agent-reporting";
import { getGardens } from "../../modules/data/greengoods";
import type { Address } from "../../types/domain";
import { GardenAccountABI } from "../../utils/blockchain/contracts";

/** One fail-closed read for the link flow. An account in any garden gets no invitation. */
export function useCommunityGardenJoin(purpose: string | null, account: Address | null) {
  const chain = getDefaultChain();
  const community = chain.rootGarden?.address ?? null;
  const chainId = chain.chainId;
  return useQuery({
    queryKey: agentReportingKeys.communityJoin(chainId, account ?? ""),
    enabled: purpose === "link_account" && account !== null && community !== null,
    retry: false,
    gcTime: 0,
    queryFn: async () => {
      if (!account || !community) return null;
      try {
        const gardens = await getGardens();
        if (
          gardens.some((garden) =>
            [...garden.gardeners, ...garden.stewards, ...garden.owners].some(
              (member) => member.toLowerCase() === account.toLowerCase()
            )
          )
        )
          return null;
        const garden = gardens.find((item) => item.id.toLowerCase() === community.toLowerCase());
        if (!garden?.openJoining) return null;
        const isGardener = await readContract(getWagmiConfig(), {
          address: community,
          abi: GardenAccountABI,
          functionName: "isGardener",
          args: [account],
          chainId,
        });
        return isGardener ? null : { address: community, name: garden.name, chainId };
      } catch {
        return null;
      }
    },
  });
}
