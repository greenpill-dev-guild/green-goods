/**
 * Yearn V3 yield-source adapter.
 *
 * The pilot Octant YDS strategies deposit into a standard Yearn V3 vault whose
 * net APR is published by Yearn's yDaemon. We surface that `apr.netAPR` as the
 * strategy's gross/donation-funding rate. By YDS design the depositor's own
 * price-per-share stays flat (profit is donated), so this is explicitly NOT a
 * depositor return.
 *
 * yDaemon is a public read-only API consumed cross-origin by many frontends; a
 * blocked/failed request simply throws and the caller renders an unavailable
 * state.
 *
 * @module utils/blockchain/yield-sources/yearn-v3-adapter
 */
import type { YieldSourceAdapter, YieldSourceApyParams, YieldSourceApyResult } from "./index";

const YDAEMON_BASE_URL = "https://ydaemon.yearn.fi";

interface YDaemonVaultAprResponse {
  apr?: { netAPR?: number | null } | null;
}

export const yearnV3Adapter: YieldSourceAdapter = {
  kind: "yearn-v3",
  matches: (kind) => kind === "yearn-v3",
  async readApy({ sourceAddress, chainId }: YieldSourceApyParams): Promise<YieldSourceApyResult> {
    const url = `${YDAEMON_BASE_URL}/${chainId}/vaults/${sourceAddress}`;
    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`yDaemon returned ${response.status} for ${sourceAddress}`);
    }

    const data = (await response.json()) as YDaemonVaultAprResponse;
    const netApr = data.apr?.netAPR;
    if (typeof netApr !== "number" || !Number.isFinite(netApr)) {
      throw new Error(`yDaemon response missing apr.netAPR for ${sourceAddress}`);
    }

    // yDaemon reports APR as a fraction (e.g. 0.0143 = 1.43%).
    const percentage = netApr * 100;
    return { apy: percentage, apr: percentage, kind: "yearn-v3" };
  },
};
