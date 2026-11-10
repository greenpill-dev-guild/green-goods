import { formatUnits, zeroAddress } from "viem";
import { useReadContracts } from "wagmi";
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

// Wagmi 3's useBalance reads native currency only. Keep token metadata and balance
// together so deposit callers never interpret token amounts using native decimals.
export function useErc20Balance({ address, token, chainId, query }: Erc20BalanceOptions) {
  const contracts = [
    {
      address: token ?? zeroAddress,
      abi: ERC20_BALANCE_ABI,
      functionName: "balanceOf",
      args: [address ?? zeroAddress],
      chainId,
    },
    { address: token ?? zeroAddress, abi: ERC20_DECIMALS_ABI, functionName: "decimals", chainId },
    { address: token ?? zeroAddress, abi: ERC20_SYMBOL_ABI, functionName: "symbol", chainId },
  ] as const;
  const result = useReadContracts({
    contracts,
    allowFailure: false,
    query: { ...query, enabled: query?.enabled !== false && Boolean(address && token) },
  });
  const data = result.data;
  return {
    ...result,
    data:
      data && data.length === 3
        ? {
            value: data[0],
            decimals: data[1],
            symbol: data[2],
            formatted: formatUnits(data[0], data[1]),
          }
        : undefined,
  };
}
