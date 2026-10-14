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

/** The decimals read is authoritative; a missing symbol does not hide known units. */
export function erc20MetadataFromResults(decimals: unknown, symbol: unknown): Erc20MetadataRead {
  if (typeof decimals !== "number" || !Number.isInteger(decimals) || decimals < 0) {
    return { status: "unreadable" };
  }
  return {
    status: "ready",
    metadata: {
      decimals,
      symbol: typeof symbol === "string" && symbol.trim().length > 0 ? symbol.trim() : null,
    },
  };
}

/** Keep each token paired with its own two contract reads, even when one fails. */
export function erc20MetadataMap(
  addresses: readonly Address[],
  results: readonly ({ result?: unknown } | undefined)[] | undefined,
  loading: boolean
): ReadonlyMap<string, Erc20MetadataRead> {
  return new Map<string, Erc20MetadataRead>(
    addresses.map((address, index) => [
      address,
      loading
        ? { status: "loading" }
        : erc20MetadataFromResults(results?.[index * 2]?.result, results?.[index * 2 + 1]?.result),
    ])
  );
}

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
  const normalizedToken = token?.trim();
  const address =
    normalizedToken && isAddress(normalizedToken) ? (normalizedToken as Address) : undefined;
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
  return erc20MetadataFromResults(query.data?.[0]?.result, query.data?.[1]?.result);
}

/** Read the units of every distinct external reward token in a seed tray. */
export function useErc20MetadataMany(
  chainId: number,
  tokens: readonly string[]
): ReadonlyMap<string, Erc20MetadataRead> {
  const addresses = [...new Set(tokens.map((token) => token.trim().toLowerCase()))].filter(
    (token): token is Address => isAddress(token)
  );
  const query = useReadContracts({
    contracts: addresses.flatMap((address) => [
      { address, abi: ERC20_DECIMALS_ABI, functionName: "decimals" as const, chainId },
      { address, abi: ERC20_SYMBOL_ABI, functionName: "symbol" as const, chainId },
    ]),
    allowFailure: true,
    query: { enabled: addresses.length > 0, staleTime: STALE_TIME_MEDIUM },
  });

  return erc20MetadataMap(addresses, query.data, query.isLoading);
}
