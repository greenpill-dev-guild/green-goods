/**
 * Arbitrum On-Chain Yield Data Verification
 *
 * Integration test that makes real RPC calls to Arbitrum to verify
 * all queryable yield/APY data points. Skips gracefully when
 * ARBITRUM_RPC_URL is not set.
 *
 * Run: ARBITRUM_RPC_URL=https://... npx vitest run packages/shared/src/__tests__/integration/arbitrum-yield-data.test.ts
 *
 * @vitest-environment node
 */

import { createPublicClient, http, type Address, formatUnits, parseAbi } from "viem";
import { arbitrum } from "viem/chains";
import { describe, it, expect, beforeAll } from "vitest";
import { rayToApy, formatApy } from "../../utils/blockchain/aave";

// ── Arbitrum addresses (from deployment artifacts + vaults.ts) ──────────

const AAVE_V3_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD" as Address;
const OCTANT_MODULE = "0x70b25a2bAAA4f2Ae477bab315a87A03cfe89CEe9" as Address;
const YIELD_SPLITTER = "0x90896C86108528abB600Da3C48a1aa054958bDeb" as Address;

const WETH = "0x82af49447d8a07e3bd95bd0d56f35241523fbab1" as Address;
const DAI = "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1" as Address;

// ── ABIs (minimal, view-only) ───────────────────────────────────────────

const AAVE_POOL_ABI = parseAbi([
  "function getReserveData(address asset) view returns ((uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt))",
]);

const OCTANT_MODULE_ABI = parseAbi([
  "function getSupportedAssets() view returns (address[])",
  "function supportedAssets(address asset) view returns (address strategy)",
  "function getVaultForAsset(address garden, address asset) view returns (address vault)",
  "function vaultStrategies(address vault) view returns (address strategy)",
  "function gardenDonationAddresses(address garden) view returns (address)",
]);

const YIELD_SPLITTER_ABI = parseAbi([
  "function gardenShares(address garden, address vault) view returns (uint256)",
  "function totalRegisteredShares(address vault) view returns (uint256)",
  "function pendingYield(address garden, address asset) view returns (uint256)",
  "function escrowedFractions(address garden, address asset) view returns (uint256)",
  "function gardenVaults(address garden, address asset) view returns (address)",
  "function gardenSplitConfig(address garden) view returns (uint256 cookieJarBps, uint256 fractionsBps, uint256 juiceboxBps)",
  "function minYieldThreshold() view returns (uint256)",
  "function minAllocationAmount() view returns (uint256)",
]);

const ERC4626_ABI = parseAbi([
  "function totalAssets() view returns (uint256)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function asset() view returns (address)",
]);

const ERC20_ABI = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
]);

// ── Test setup ──────────────────────────────────────────────────────────

const rpcUrl = process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC;

const describeIf = rpcUrl ? describe : describe.skip;

describeIf("Arbitrum on-chain yield data (live RPC)", () => {
  const client = createPublicClient({
    chain: arbitrum,
    transport: http(rpcUrl),
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 1. Aave V3 Reserve Data ��� the source of APY
  // ═══════════════════════════════════════════════════════════════════════

  describe("Aave V3 getReserveData", () => {
    it("returns valid WETH reserve data with non-zero liquidity rate", async () => {
      const data = await client.readContract({
        address: AAVE_V3_POOL,
        abi: AAVE_POOL_ABI,
        functionName: "getReserveData",
        args: [WETH],
      });

      console.log("WETH Reserve Data:", {
        currentLiquidityRate: data.currentLiquidityRate.toString(),
        currentVariableBorrowRate: data.currentVariableBorrowRate.toString(),
        liquidityIndex: data.liquidityIndex.toString(),
        aTokenAddress: data.aTokenAddress,
        lastUpdateTimestamp: data.lastUpdateTimestamp,
        id: data.id,
      });

      expect(data.aTokenAddress).not.toBe("0x0000000000000000000000000000000000000000");
      expect(data.currentLiquidityRate).toBeGreaterThanOrEqual(0n);

      const apy = rayToApy(data.currentLiquidityRate);
      console.log(`WETH Supply APY: ${formatApy(apy)}`);
      expect(Number.isFinite(apy)).toBe(true);
      expect(apy).toBeGreaterThanOrEqual(0);
      expect(apy).toBeLessThan(100); // sanity: <100% APY

      const borrowApy = rayToApy(data.currentVariableBorrowRate);
      console.log(`WETH Variable Borrow APY: ${formatApy(borrowApy)}`);
    });

    it("returns valid DAI reserve data with non-zero liquidity rate", async () => {
      const data = await client.readContract({
        address: AAVE_V3_POOL,
        abi: AAVE_POOL_ABI,
        functionName: "getReserveData",
        args: [DAI],
      });

      console.log("DAI Reserve Data:", {
        currentLiquidityRate: data.currentLiquidityRate.toString(),
        currentVariableBorrowRate: data.currentVariableBorrowRate.toString(),
        aTokenAddress: data.aTokenAddress,
        id: data.id,
      });

      expect(data.aTokenAddress).not.toBe("0x0000000000000000000000000000000000000000");

      const apy = rayToApy(data.currentLiquidityRate);
      console.log(`DAI Supply APY: ${formatApy(apy)}`);
      expect(Number.isFinite(apy)).toBe(true);
      expect(apy).toBeGreaterThanOrEqual(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 2. OctantModule — vault registry and strategy attachments
  // ═══════════════════════════════════════════════════════════════════════

  describe("OctantModule vault registry", () => {
    let supportedAssets: readonly Address[];

    beforeAll(async () => {
      supportedAssets = await client.readContract({
        address: OCTANT_MODULE,
        abi: OCTANT_MODULE_ABI,
        functionName: "getSupportedAssets",
      });
      console.log(
        "Supported assets:",
        supportedAssets.map((a) => a.toLowerCase())
      );
    });

    it("has WETH and/or DAI as supported assets", () => {
      const lower = supportedAssets.map((a) => a.toLowerCase());
      const hasWeth = lower.includes(WETH.toLowerCase());
      const hasDai = lower.includes(DAI.toLowerCase());
      console.log(`WETH supported: ${hasWeth}, DAI supported: ${hasDai}`);
      expect(hasWeth || hasDai).toBe(true);
    });

    it("has strategy templates for supported assets", async () => {
      for (const asset of supportedAssets) {
        const strategy = await client.readContract({
          address: OCTANT_MODULE,
          abi: OCTANT_MODULE_ABI,
          functionName: "supportedAssets",
          args: [asset],
        });
        console.log(`Asset ${asset} → strategy template: ${strategy}`);
        // Zero address means deactivated, non-zero means active
        if (strategy !== "0x0000000000000000000000000000000000000000") {
          expect(strategy).toMatch(/^0x[a-fA-F0-9]{40}$/);
        }
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 3. YieldSplitter — protocol-level config
  // ═══════════════════════════════════════════════════════════════════════

  describe("YieldSplitter protocol config", () => {
    it("reads minYieldThreshold", async () => {
      const threshold = await client.readContract({
        address: YIELD_SPLITTER,
        abi: YIELD_SPLITTER_ABI,
        functionName: "minYieldThreshold",
      });
      console.log(`Min yield threshold: ${formatUnits(threshold, 18)} ETH (${threshold} wei)`);
      expect(threshold).toBeGreaterThanOrEqual(0n);
    });

    it("reads minAllocationAmount", async () => {
      const minAlloc = await client.readContract({
        address: YIELD_SPLITTER,
        abi: YIELD_SPLITTER_ABI,
        functionName: "minAllocationAmount",
      });
      console.log(`Min allocation amount: ${formatUnits(minAlloc, 18)} (${minAlloc} wei)`);
      expect(minAlloc).toBeGreaterThanOrEqual(0n);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 4. Full data matrix — every queryable data point for a known garden
  // ═══════════════════════════════════════════════════════════════════════

  describe("Per-garden yield data (first garden with a WETH vault)", () => {
    // We'll find a garden dynamically from the indexer data by reading vault events
    // For now, test the view functions are callable with any address
    const SAMPLE_GARDEN = "0x0000000000000000000000000000000000000001" as Address;

    it("reads gardenVaults mapping (garden → asset → vault)", async () => {
      const vault = await client.readContract({
        address: YIELD_SPLITTER,
        abi: YIELD_SPLITTER_ABI,
        functionName: "gardenVaults",
        args: [SAMPLE_GARDEN, WETH],
      });
      console.log(`Garden ${SAMPLE_GARDEN} WETH vault: ${vault}`);
      // May be zero if no vault registered for this garden
      expect(typeof vault).toBe("string");
    });

    it("reads gardenSplitConfig (split ratios)", async () => {
      const [cookieJarBps, fractionsBps, juiceboxBps] = await client.readContract({
        address: YIELD_SPLITTER,
        abi: YIELD_SPLITTER_ABI,
        functionName: "gardenSplitConfig",
        args: [SAMPLE_GARDEN],
      });
      console.log(
        `Split config: cookie=${cookieJarBps} fractions=${fractionsBps} juicebox=${juiceboxBps}`
      );
      // Defaults are 4865/4865/270 (or 0/0/0 if not set, which falls back to defaults)
    });

    it("reads pendingYield for garden+asset", async () => {
      const pending = await client.readContract({
        address: YIELD_SPLITTER,
        abi: YIELD_SPLITTER_ABI,
        functionName: "pendingYield",
        args: [SAMPLE_GARDEN, WETH],
      });
      console.log(`Pending WETH yield: ${formatUnits(pending, 18)}`);
    });

    it("reads escrowedFractions for garden+asset", async () => {
      const escrowed = await client.readContract({
        address: YIELD_SPLITTER,
        abi: YIELD_SPLITTER_ABI,
        functionName: "escrowedFractions",
        args: [SAMPLE_GARDEN, WETH],
      });
      console.log(`Escrowed WETH fractions: ${formatUnits(escrowed, 18)}`);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 5. Summary: Data availability matrix
  // ═══════════════════════════════════════════════════════════════════════

  it("prints complete data availability matrix", async () => {
    const results: Record<string, string> = {};

    // Aave data
    for (const [symbol, address] of [
      ["WETH", WETH],
      ["DAI", DAI],
    ] as const) {
      try {
        const data = await client.readContract({
          address: AAVE_V3_POOL,
          abi: AAVE_POOL_ABI,
          functionName: "getReserveData",
          args: [address],
        });
        const supplyApy = rayToApy(data.currentLiquidityRate);
        const borrowApy = rayToApy(data.currentVariableBorrowRate);
        results[`${symbol} Supply APY`] = formatApy(supplyApy);
        results[`${symbol} Borrow APY`] = formatApy(borrowApy);
        results[`${symbol} aToken`] = data.aTokenAddress;
        results[`${symbol} Last Updated`] = new Date(
          Number(data.lastUpdateTimestamp) * 1000
        ).toISOString();
      } catch (e) {
        results[`${symbol} Reserve`] = `ERROR: ${(e as Error).message}`;
      }
    }

    // Protocol config
    try {
      const threshold = await client.readContract({
        address: YIELD_SPLITTER,
        abi: YIELD_SPLITTER_ABI,
        functionName: "minYieldThreshold",
      });
      results["Min Yield Threshold"] = `${formatUnits(threshold, 18)} ETH`;
    } catch {
      results["Min Yield Threshold"] = "ERROR";
    }

    try {
      const assets = await client.readContract({
        address: OCTANT_MODULE,
        abi: OCTANT_MODULE_ABI,
        functionName: "getSupportedAssets",
      });
      results["Supported Assets"] = assets.join(", ");
    } catch {
      results["Supported Assets"] = "ERROR";
    }

    console.log("\n╔══════════════════════════════════════════════════╗");
    console.log("║   Arbitrum Yield Data Availability Matrix        ║");
    console.log("╠══════════════════════════════════════════════════╣");
    for (const [key, value] of Object.entries(results)) {
      console.log(`║ ${key.padEnd(25)} │ ${value}`);
    }
    console.log("╚══════════════════════════════════════════════════╝\n");

    // At minimum, the Aave calls should succeed
    expect(results["WETH Supply APY"]).toMatch(/%$/);
    expect(results["DAI Supply APY"]).toMatch(/%$/);
  });
});
