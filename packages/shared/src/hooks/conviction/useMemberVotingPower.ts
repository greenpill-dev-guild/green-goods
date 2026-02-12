import { useQuery } from "@tanstack/react-query";
import { readContract } from "@wagmi/core";
import type { Address } from "../../types/domain";
import type { MemberPower, VoterAllocation } from "../../types/conviction";
import { wagmiConfig } from "../../config/appkit";
import { HYPERCERT_SIGNAL_POOL_ABI } from "../../utils/blockchain/abis";
import { normalizeAddress } from "../../utils/blockchain/address";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { queryKeys, STALE_TIME_MEDIUM } from "../query-keys";

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
    queryKey: queryKeys.conviction.memberPower(
      normalizedPool ?? "",
      normalizedVoter ?? "",
      chainId
    ),
    queryFn: async (): Promise<MemberPower> => {
      if (!normalizedPool || !normalizedVoter) {
        return { totalStake: 0n, pointsBudget: 0n, isEligible: false, allocations: [] };
      }

      const poolAddr = normalizedPool;
      const voterAddr = normalizedVoter;

      const [isEligible, totalStake, pointsBudget, allocationsResult] = await Promise.all([
        readContract(wagmiConfig, {
          address: poolAddr,
          abi: HYPERCERT_SIGNAL_POOL_ABI,
          functionName: "isEligibleVoter",
          args: [voterAddr],
          chainId,
        }),
        readContract(wagmiConfig, {
          address: poolAddr,
          abi: HYPERCERT_SIGNAL_POOL_ABI,
          functionName: "voterTotalStake",
          args: [voterAddr],
          chainId,
        }),
        readContract(wagmiConfig, {
          address: poolAddr,
          abi: HYPERCERT_SIGNAL_POOL_ABI,
          functionName: "pointsPerVoter",
          chainId,
        }),
        readContract(wagmiConfig, {
          address: poolAddr,
          abi: HYPERCERT_SIGNAL_POOL_ABI,
          functionName: "getVoterAllocations",
          args: [voterAddr],
          chainId,
        }),
      ]);

      const [ids, amounts] = allocationsResult as [bigint[], bigint[]];
      const allocations: VoterAllocation[] = ids.map((id, i) => ({
        hypercertId: id,
        amount: amounts[i],
      }));

      return {
        totalStake: totalStake as bigint,
        pointsBudget: pointsBudget as bigint,
        isEligible: isEligible as boolean,
        allocations,
      };
    },
    enabled: enabled && Boolean(normalizedPool) && Boolean(normalizedVoter),
    staleTime: STALE_TIME_MEDIUM,
  });

  return {
    ...query,
    power: query.data ?? { totalStake: 0n, pointsBudget: 0n, isEligible: false, allocations: [] },
  };
}
