import { useQuery } from "@tanstack/react-query";
import { getMemberPowerFromSubgraph } from "../../modules/data/gardens";
import type { MemberPower } from "../../types/conviction";
import type { Address } from "../../types/domain";
import { normalizeAddress } from "../../utils/blockchain/address";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { STALE_TIME_MEDIUM } from "../../config/query-keys/constants";
import { convictionKeys } from "../../config/query-keys/hypercert";

const EMPTY_POWER: MemberPower = {
  totalStake: 0n,
  pointsBudget: 0n,
  isEligible: false,
  allocations: [],
};

interface UseMemberVotingPowerOptions {
  enabled?: boolean;
}

export function useMemberVotingPower(
  poolAddress?: Address,
  voterAddress?: Address,
  options: UseMemberVotingPowerOptions = {}
) {
  const chainId = useCurrentChain();
  const enabled = options.enabled ?? true;
  const normalizedPool = poolAddress ? normalizeAddress(poolAddress) : undefined;
  const normalizedVoter = voterAddress ? normalizeAddress(voterAddress) : undefined;

  const query = useQuery({
    queryKey: convictionKeys.memberPower(normalizedPool ?? "", normalizedVoter ?? "", chainId),
    queryFn: async (): Promise<MemberPower> => {
      if (!normalizedPool || !normalizedVoter) return EMPTY_POWER;
      return getMemberPowerFromSubgraph(normalizedPool, normalizedVoter, chainId);
    },
    enabled: enabled && Boolean(normalizedPool) && Boolean(normalizedVoter),
    staleTime: STALE_TIME_MEDIUM,
  });

  return {
    ...query,
    power: query.data ?? EMPTY_POWER,
  };
}
