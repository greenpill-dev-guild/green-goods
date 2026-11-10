import { useQuery } from "@tanstack/react-query";
import { readContracts } from "@wagmi/core";
import { readContractsQueryOptions } from "@wagmi/core/query";
import { formatUnits, hexToString, trim, zeroAddress } from "viem";
import { useConfig } from "wagmi";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import type { Address } from "../../types/domain";
import {
  ERC20_BALANCE_ABI,
  ERC20_DECIMALS_ABI,
  ERC20_SYMBOL_ABI,
} from "../../utils/blockchain/abis/erc20";

interface Erc20BalanceOptions {
  address?: Address;
  token?: Address;
  chainId?: number;
  query?: { enabled?: boolean; refetchInterval?: number | false };
}

const BYTES32_SYMBOL_ABI = [
  { ...ERC20_SYMBOL_ABI[0], outputs: [{ name: "", type: "bytes32" }] },
] as const;

// Wagmi 3's useBalance reads native currency only. Keep token metadata and balance
// together so deposit callers never interpret token amounts using native decimals.
export function useErc20Balance({ address, token, chainId, query }: Erc20BalanceOptions) {
  const config = useConfig();
  const selectedChainId = chainId ?? DEFAULT_CHAIN_ID;
  const contracts = [
    {
      address: token ?? zeroAddress,
      abi: ERC20_BALANCE_ABI,
      functionName: "balanceOf",
      args: [address ?? zeroAddress],
      chainId: selectedChainId,
    },
    {
      address: token ?? zeroAddress,
      abi: ERC20_DECIMALS_ABI,
      functionName: "decimals",
      chainId: selectedChainId,
    },
    {
      address: token ?? zeroAddress,
      abi: ERC20_SYMBOL_ABI,
      functionName: "symbol",
      chainId: selectedChainId,
    },
  ] as const;
  const parameters = { contracts, allowFailure: false } as const;
  const result = useQuery({
    ...readContractsQueryOptions(config, parameters),
    ...query,
    enabled: query?.enabled !== false && Boolean(address && token),
    queryFn: async (): Promise<[bigint, number, string]> => {
      try {
        return await readContracts(config, parameters);
      } catch (error) {
        // Preserve Wagmi 2's support for older tokens whose symbol is bytes32.
        if (!(error instanceof Error) || error.name !== "ContractFunctionExecutionError")
          throw error;
        const [value, decimals, symbol] = await readContracts(config, {
          allowFailure: false,
          contracts: [contracts[0], contracts[1], { ...contracts[2], abi: BYTES32_SYMBOL_ABI }],
        });
        return [value, decimals, hexToString(trim(symbol, { dir: "right" }))];
      }
    },
  });
  const data = result.data;
  return {
    ...result,
    data: data
      ? {
          value: data[0],
          decimals: data[1],
          symbol: data[2],
          formatted: formatUnits(data[0], data[1]),
        }
      : undefined,
  };
}
