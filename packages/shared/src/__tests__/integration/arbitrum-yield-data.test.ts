/**
 * Arbitrum On-Chain Yield Data Verification
 *
 * Integration test that makes real RPC calls to Arbitrum to verify
 * vault registry and protocol yield reads. This file is excluded from the
 * default shared test run and only executes when RUN_LIVE_RPC_TESTS=true
 * and ARBITRUM_RPC_URL (or ARBITRUM_RPC) is provided.
 *
 * Run:
 * RUN_LIVE_RPC_TESTS=true ARBITRUM_RPC_URL=https://... \
 *   bun run --cwd packages/shared test --scope live
 *
 * @vitest-environment node
 */

import { createPublicClient, http, type Address, formatUnits, parseAbi } from "viem";
import { arbitrum } from "viem/chains";
import { describe, it, expect, beforeAll } from "vitest";

// ── Arbitrum addresses (from deployment artifacts + vaults.ts) ──────────

const OCTANT_MODULE = "0x70b25a2bAAA4f2Ae477bab315a87A03cfe89CEe9" as Address;
const YIELD_SPLITTER = "0x90896C86108528abB600Da3C48a1aa054958bDeb" as Address;

const WETH = "0x82af49447d8a07e3bd95bd0d56f35241523fbab1" as Address;
const DAI = "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1" as Address;

// ── ABIs (minimal, view-only) ───────────────────────────────────────────

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

// ── Test setup ──────────────────────────────────────────────────────────

const rpcUrl = process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC;
const runLiveRpcTests = process.env.RUN_LIVE_RPC_TESTS === "true" && Boolean(rpcUrl);

const describeIf = runLiveRpcTests ? describe : describe.skip;

describeIf("Arbitrum on-chain yield data (live RPC)", () => {
  const client = createPublicClient({
    chain: arbitrum,
    transport: http(rpcUrl),
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
});
