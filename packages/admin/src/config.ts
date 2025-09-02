import { arbitrum, baseSepolia, celo } from "viem/chains";

export const DEFAULT_CHAIN_ID = Number(import.meta.env.VITE_DEFAULT_CHAIN_ID) || arbitrum.id;

export const APP_TITLE = "Green Goods Admin";
export const APP_DESCRIPTION = "Administrative dashboard for Green Goods platform";

export const ADMIN_ALLOWLIST: string[] = [
  "0x2aa64E6d80390F5C017F0313cB908051BE2FD35e",
  "0x04D60647836bcA09c37B379550038BdaaFD82503",
];

export const SUPPORTED_CHAINS = [arbitrum, celo, baseSepolia];

export function getDefaultChain() {
  return SUPPORTED_CHAINS.find(chain => chain.id === DEFAULT_CHAIN_ID) || arbitrum;
}

export const INDEXER_URL = import.meta.env.VITE_INDEXER_URL || "https://indexer.dev.hyperindex.xyz/2e23bea/v1/graphql";