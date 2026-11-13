import { useQuery } from "@tanstack/react-query";
import { readContract } from "@wagmi/core";
import { getWagmiConfig } from "../../config/appkit";
import { getNetworkConfig } from "../../config/blockchain";
import { roleKeys } from "../../config/query-keys/identity";
import type { Address } from "../../types/domain";
import { HATS_MODULE_ABI } from "../../utils/blockchain/abis/hats";
import { isZeroAddress } from "../../utils/blockchain/address";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useCurrentChain } from "../blockchain/useChainConfig";

const WEARER_ABI = [
  {
    type: "function",
    name: "isWearerOfHat",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "hatId", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const NO_ROLES = { team: false, productLead: false, agents: false, deployer: false };

/** The indexer discovers configuration; Hats remains the authority for effective membership. */
async function readProtocolRoles(account: Address, chainId: number) {
  const module = getNetworkConfig(chainId).contracts.hatsModule as Address | undefined;
  if (!module || isZeroAddress(module)) return NO_ROLES;
  const config = getWagmiConfig();
  const [ids, hats] = await Promise.all([
    readContract(config, {
      address: module,
      abi: HATS_MODULE_ABI,
      functionName: "protocolRoleHats",
      chainId,
    }),
    readContract(config, { address: module, abi: HATS_MODULE_ABI, functionName: "hats", chainId }),
  ]);
  if (!Array.isArray(ids) || ids.length !== 4 || typeof hats !== "string") {
    throw new Error("Protocol Hat configuration is unavailable");
  }
  const values = await Promise.all(
    ids.map((hatId) =>
      hatId === 0n
        ? false
        : readContract(config, {
            address: hats as Address,
            abi: WEARER_ABI,
            functionName: "isWearerOfHat",
            args: [account, BigInt(hatId)],
            chainId,
          })
    )
  );
  return { team: values[0], productLead: values[1], agents: values[2], deployer: values[3] };
}

export function useProtocolRoles() {
  const account = usePrimaryAddress();
  const chainId = useCurrentChain();
  const query = useQuery({
    queryKey: roleKeys.protocolRoles(account ?? undefined, chainId),
    queryFn: () => readProtocolRoles(account as Address, chainId),
    enabled: Boolean(account),
    staleTime: 0,
    refetchOnWindowFocus: "always",
    retry: false,
  });
  // Retained data after a failed refresh never grants an operational capability.
  return {
    ...(!query.isError ? (query.data ?? NO_ROLES) : NO_ROLES),
    isLoading: Boolean(account) && query.isLoading,
    isError: query.isError,
  };
}
