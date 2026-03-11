import type { SupportedChainId } from "./chains";
import { ENV } from "varlock/env";

/**
 * Gardens V2 subgraph endpoints.
 *
 * Two access modes are supported:
 * 1. **Studio** (default) -- free, rate-limited, suitable for dev/staging
 * 2. **Gateway** -- requires VITE_GARDENS_SUBGRAPH_KEY, production-grade SLA
 *
 * The gateway URLs use The Graph's decentralized network and are preferred
 * for production deployments.
 */

// ---------------------------------------------------------------------------
// Studio endpoints (free, rate-limited)
// ---------------------------------------------------------------------------

const STUDIO_URLS: Record<SupportedChainId, string> = {
  42161: "https://api.studio.thegraph.com/query/102093/gardens-v2---arbitrum/version/latest",
  42220: "https://api.studio.thegraph.com/query/102093/gardens-v2---celo/version/latest",
  11155111: "https://api.studio.thegraph.com/query/70985/gardens-v-2-sepolia/version/latest",
};

// ---------------------------------------------------------------------------
// Gateway subgraph IDs (decentralized network)
// ---------------------------------------------------------------------------

const GATEWAY_SUBGRAPH_IDS: Partial<Record<SupportedChainId, string>> = {
  42161: "9ejruFicuLT6hfuXNTnS8UCwxTWrHz4uinesdZu1dKmk",
  42220: "BsXEnGaXdj3CkGRn95bswGcv2mQX7m8kNq7M7WBxxPx8",
};

const GATEWAY_BASE = "https://gateway.thegraph.com/api";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the Gardens V2 subgraph URL for the given chain.
 *
 * When `VITE_GARDENS_SUBGRAPH_KEY` is set and a gateway subgraph ID exists
 * for the chain, uses the decentralized gateway. Otherwise falls back to
 * the free Studio endpoint.
 */
export function getGardensSubgraphUrl(chainId: number): string {
  const apiKey = ENV.VITE_GARDENS_SUBGRAPH_KEY;

  const gatewayId = GATEWAY_SUBGRAPH_IDS[chainId as SupportedChainId];

  if (apiKey && gatewayId) {
    return `${GATEWAY_BASE}/${apiKey}/subgraphs/id/${gatewayId}`;
  }

  return STUDIO_URLS[chainId as SupportedChainId] ?? STUDIO_URLS[11155111];
}
