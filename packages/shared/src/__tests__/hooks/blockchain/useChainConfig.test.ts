/**
 * Chain Configuration Hook Tests
 * @vitest-environment jsdom
 *
 * Tests the pure function wrappers in useChainConfig.ts.
 * These hooks delegate to config/blockchain.ts, so we mock that module
 * and verify the wiring.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================
// Mock the blockchain config module
// vi.mock factories are hoisted — no external references allowed.
// ============================================

vi.mock("../../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
  getEASConfig: vi.fn().mockReturnValue({
    ASSESSMENT: { uid: "0xassessment", schema: "uint256 actionUID" },
    WORK: { uid: "0xwork", schema: "uint256 actionUID,string title" },
    WORK_APPROVAL: { uid: "0xapproval", schema: "uint256 actionUID,bytes32 workUID" },
    EAS: { address: "0xEAS" },
    SCHEMA_REGISTRY: { address: "0xSchemaRegistry" },
  }),
  getNetworkConfig: vi.fn().mockReturnValue({
    chainId: 11155111,
    name: "Sepolia",
    rpcUrl: "https://eth-sepolia.g.alchemy.com/v2/demo",
    blockExplorer: "https://sepolia.etherscan.io",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    contracts: {
      gardenToken: "0xGardenToken",
      actionRegistry: "0xActionRegistry",
    },
  }),
}));

import {
  getCurrentChain,
  getEASConfigForChain,
  getNetworkConfigForChain,
  useCurrentChain,
  useEASConfig,
  useNetworkConfig,
  useChainConfig,
} from "../../../hooks/blockchain/useChainConfig";
import { getEASConfig, getNetworkConfig } from "../../../config/blockchain";

// Reference values obtained from the mocked functions (safe to call after imports)
const EXPECTED_CHAIN_ID = 11155111;

describe("useChainConfig module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ------------------------------------------
  // Pure functions
  // ------------------------------------------

  describe("getCurrentChain", () => {
    it("returns DEFAULT_CHAIN_ID", () => {
      expect(getCurrentChain()).toBe(EXPECTED_CHAIN_ID);
    });
  });

  describe("getEASConfigForChain", () => {
    it("delegates to getEASConfig with the provided chain ID", () => {
      const result = getEASConfigForChain(42161);
      expect(getEASConfig).toHaveBeenCalledWith(42161);
      // Verify the return structure has expected shape
      expect(result).toHaveProperty("ASSESSMENT.uid");
      expect(result).toHaveProperty("WORK.uid");
      expect(result).toHaveProperty("WORK_APPROVAL.uid");
      expect(result).toHaveProperty("EAS.address");
      expect(result).toHaveProperty("SCHEMA_REGISTRY.address");
    });
  });

  describe("getNetworkConfigForChain", () => {
    it("delegates to getNetworkConfig with the provided chain ID", () => {
      const result = getNetworkConfigForChain(42161);
      expect(getNetworkConfig).toHaveBeenCalledWith(42161);
      // Verify the return structure has expected shape
      expect(result).toHaveProperty("chainId");
      expect(result).toHaveProperty("name");
      expect(result).toHaveProperty("rpcUrl");
      expect(result).toHaveProperty("nativeCurrency");
      expect(result).toHaveProperty("contracts");
    });
  });

  // ------------------------------------------
  // Hook wrappers
  // ------------------------------------------

  describe("useCurrentChain", () => {
    it("returns the same value as getCurrentChain", () => {
      expect(useCurrentChain()).toBe(getCurrentChain());
    });
  });

  describe("useEASConfig", () => {
    it("returns EAS config for the current chain", () => {
      const result = useEASConfig();
      expect(getEASConfig).toHaveBeenCalledWith(EXPECTED_CHAIN_ID);
      expect(result.EAS.address).toBe("0xEAS");
      expect(result.WORK.uid).toBe("0xwork");
    });
  });

  describe("useNetworkConfig", () => {
    it("returns network config for the current chain", () => {
      const result = useNetworkConfig();
      expect(getNetworkConfig).toHaveBeenCalledWith(EXPECTED_CHAIN_ID);
      expect(result.name).toBe("Sepolia");
      expect(result.chainId).toBe(EXPECTED_CHAIN_ID);
    });
  });

  describe("useChainConfig", () => {
    it("returns combined chainId, eas, and network configuration", () => {
      const result = useChainConfig();
      expect(result.chainId).toBe(EXPECTED_CHAIN_ID);
      expect(result.eas).toHaveProperty("WORK.uid");
      expect(result.eas).toHaveProperty("EAS.address");
      expect(result.network).toHaveProperty("name", "Sepolia");
      expect(result.network).toHaveProperty("rpcUrl");
    });

    it("calls config functions with the default chain ID", () => {
      useChainConfig();
      expect(getEASConfig).toHaveBeenCalledWith(EXPECTED_CHAIN_ID);
      expect(getNetworkConfig).toHaveBeenCalledWith(EXPECTED_CHAIN_ID);
    });
  });
});
