/**
 * Sendable-token registry for the client PWA "Send" flow.
 *
 * V1 sends ERC-20 tokens only (native ETH is deferred). The hero token is
 * GOODS — the Green Goods community token, staked to join a garden community —
 * whose address is resolved at runtime from `GardensModule.goodsToken()` (it is
 * not a static entry in `deployments/*.json`). The remaining tokens (USDC, DAI,
 * WETH, and GoodDollar where available) are sourced from the existing cookie-jar
 * campaign asset registry so their verified addresses live in exactly one place.
 *
 * @module config/tokens
 */

import { getCampaignCookieJarPayoutAssets } from "../utils/cookie-jar-campaign";
import { isZeroAddress } from "../utils/blockchain/address";
import type { Address } from "../types/domain";

export interface SendableToken {
  /** Token symbol, e.g. "GOODS", "USDC". */
  symbol: string;
  /** Human-readable label/name. */
  label: string;
  /** ERC-20 contract address (V1 is ERC-20 only; native ETH is deferred). */
  address: Address;
  /** Token decimals. */
  decimals: number;
  /** True for GOODS — the community token that confers conviction governance. */
  confersGovernance: boolean;
  /** False when the asset has no address on this chain (rendered disabled). */
  supported: boolean;
  /** Why the token is unavailable, when `supported === false`. */
  disabledReason?: string;
}

/**
 * Static GOODS metadata. The on-chain values are confirmed (symbol "GOODS",
 * 18 decimals); the address is resolved at runtime via `GardensModule.goodsToken()`
 * in `useSendableTokens`, so it is intentionally absent here.
 */
export const GOODS_TOKEN_META = {
  symbol: "GOODS",
  label: "Green Goods",
  decimals: 18,
  confersGovernance: true,
} as const;

/**
 * Curated ERC-20 tokens (excluding GOODS) that can be sent in V1.
 *
 * Addresses are sourced from the cookie-jar campaign asset registry and are NOT
 * re-declared here. Assets with no address on the chain (e.g. GoodDollar on
 * Arbitrum) are returned as `supported: false` with a `disabledReason`.
 */
export function getStablecoinSendableTokens(chainId: number): SendableToken[] {
  return getCampaignCookieJarPayoutAssets(chainId).map((asset) => ({
    symbol: asset.symbol,
    label: asset.label,
    // Unsupported assets carry no address; the zero placeholder is never used
    // for a read/transfer because `supported` gates those paths.
    address: (asset.address ?? "0x0000000000000000000000000000000000000000") as Address,
    decimals: asset.decimals,
    confersGovernance: false,
    supported: asset.supported,
    disabledReason: asset.disabledReason,
  }));
}

/**
 * Build the full sendable-token list given an already-resolved GOODS address.
 *
 * GOODS leads (hero token) when present and non-zero; the curated stablecoins
 * follow. Tokens with no address on this chain (e.g. GoodDollar on Arbitrum) are
 * dropped — the Send flow only offers tokens you can actually transfer. Supported
 * tokens are de-duped by lowercased address so a future address overlap can never
 * render two identical rows.
 */
export function buildSendableTokens(
  chainId: number,
  goodsAddress: Address | null | undefined
): SendableToken[] {
  const tokens: SendableToken[] = [];

  if (goodsAddress && !isZeroAddress(goodsAddress)) {
    tokens.push({ ...GOODS_TOKEN_META, address: goodsAddress, supported: true });
  }

  tokens.push(...getStablecoinSendableTokens(chainId));

  const seen = new Set<string>();
  return tokens.filter((token) => {
    if (!token.supported) return false;
    const key = token.address.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
