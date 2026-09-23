import { isAddress } from "viem";
import { useReadContracts } from "wagmi";

import { STALE_TIME_MEDIUM } from "../../config/query-keys/constants";
import type { Address } from "../../types/domain";
import { ERC20_DECIMALS_ABI, ERC20_SYMBOL_ABI } from "../../utils/blockchain/abis/erc20";

/** What a token says about its own units. */
export interface Erc20Metadata {
  decimals: number;
  /** Null when the token does not answer `symbol()`; the units still stand. */
  symbol: string | null;
}

export type Erc20MetadataRead =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; metadata: Erc20Metadata }
  | { status: "unreadable" };

/**
 * An ERC-20's decimals and symbol on one chain. Idle until the address is a
 * valid one. A token whose decimals cannot be read is "unreadable", never
 * assumed to be 18: an amount entered in the wrong units would be recorded
 * wrong by orders of magnitude, so callers hold the amount instead.
 */
export function useErc20Metadata(
  chainId: number,
  token: string | null | undefined
): Erc20MetadataRead {
  const address = token && isAddress(token) ? (token as Address) : undefined;
  const query = useReadContracts({
    contracts: address
      ? [
          { address, abi: ERC20_DECIMALS_ABI, functionName: "decimals" as const, chainId },
          { address, abi: ERC20_SYMBOL_ABI, functionName: "symbol" as const, chainId },
        ]
      : [],
    allowFailure: true,
    query: { enabled: Boolean(address), staleTime: STALE_TIME_MEDIUM },
  });

  if (!address) return { status: "idle" };
  if (query.isLoading) return { status: "loading" };
  const decimals = query.data?.[0]?.result;
  if (typeof decimals !== "number" || !Number.isInteger(decimals) || decimals < 0) {
    return { status: "unreadable" };
  }
  const symbol = query.data?.[1]?.result;
  return {
    status: "ready",
    metadata: {
      decimals,
      symbol: typeof symbol === "string" && symbol.trim().length > 0 ? symbol.trim() : null,
    },
  };
}
