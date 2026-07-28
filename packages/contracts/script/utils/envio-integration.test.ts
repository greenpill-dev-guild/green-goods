import { describe, expect, it } from "vitest";

import { applyDeploymentToEnvioChains } from "./envio-integration";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const ARBITRUM = 42161;
const SEPOLIA = 11155111;
const ARBITRUM_START_BLOCK = 433_713_812;

const ADDRESS = {
  actionRegistry: "0xA514eA2730b9eD401875693793BEfA9e2D51C0b4",
  gardenToken: "0xe1Da335110b1ed48e7df63209f5D424d02276593",
  gardenAccount: "0xE31cAeAc029A60AD17A49278Fdd58032eF9Cf692",
  octantModule: "0x70b25a2bAAA4f2Ae477bab315a87A03cfe89CEe9",
  octantVault: "0xac2B839acfcF01DF04E442928a40b152fC0A407f",
  yieldSplitter: "0x90896C86108528abB600Da3C48a1aa054958bDeb",
} as const;

/** Mirrors the shape config.yaml carries for a configured chain, including the dynamic vault. */
function existingArbitrumChain() {
  return {
    id: ARBITRUM,
    start_block: ARBITRUM_START_BLOCK,
    contracts: [
      { name: "ActionRegistry", address: ADDRESS.actionRegistry },
      { name: "GardenToken", address: ADDRESS.gardenToken },
      { name: "OctantModule", address: ADDRESS.octantModule },
      // Dynamically registered — intentionally address-less.
      { name: "OctantVault" },
      { name: "YieldSplitter", address: ADDRESS.yieldSplitter },
    ],
  };
}

function findContract(chains: ReturnType<typeof applyDeploymentToEnvioChains>, name: string) {
  const chain = chains.find((item) => item.id === ARBITRUM);
  return chain?.contracts.find((contract) => contract.name === name);
}

describe("applyDeploymentToEnvioChains", () => {
  it("preserves a configured start block instead of recomputing it", () => {
    const chains = applyDeploymentToEnvioChains({
      chains: [existingArbitrumChain()],
      chainId: ARBITRUM,
      deployment: { actionRegistry: ADDRESS.actionRegistry, gardenToken: ADDRESS.gardenToken },
      gardenAccountAddress: ADDRESS.gardenAccount,
      // A wrong fallback must not win over the configured value.
      fallbackStartBlock: 1,
    });

    expect(chains.find((chain) => chain.id === ARBITRUM)?.start_block).toBe(ARBITRUM_START_BLOCK);
  });

  it("keeps OctantVault address-less even when the deployment reports a vault address", () => {
    const chains = applyDeploymentToEnvioChains({
      chains: [existingArbitrumChain()],
      chainId: ARBITRUM,
      deployment: {
        actionRegistry: ADDRESS.actionRegistry,
        gardenToken: ADDRESS.gardenToken,
        octantVault: ADDRESS.octantVault,
      },
      gardenAccountAddress: ADDRESS.gardenAccount,
      fallbackStartBlock: ARBITRUM_START_BLOCK,
    });

    const vault = findContract(chains, "OctantVault");
    expect(vault).toBeDefined();
    expect(vault).not.toHaveProperty("address");
    // The literal string "undefined" is the specific corruption this guards against.
    expect(JSON.stringify(chains)).not.toContain('"address":"undefined"');
    expect(JSON.stringify(chains)).not.toContain(ADDRESS.octantVault);
  });

  it("writes the chains key and never reintroduces a networks key", () => {
    const chains = applyDeploymentToEnvioChains({
      chains: [existingArbitrumChain()],
      chainId: ARBITRUM,
      deployment: { actionRegistry: ADDRESS.actionRegistry, gardenToken: ADDRESS.gardenToken },
      gardenAccountAddress: ADDRESS.gardenAccount,
      fallbackStartBlock: ARBITRUM_START_BLOCK,
    });

    expect(Array.isArray(chains)).toBe(true);
    expect(chains.every((chain) => typeof chain.id === "number")).toBe(true);
  });

  it("preserves the canonical contract order", () => {
    const chains = applyDeploymentToEnvioChains({
      chains: [existingArbitrumChain()],
      chainId: ARBITRUM,
      deployment: {
        actionRegistry: ADDRESS.actionRegistry,
        gardenToken: ADDRESS.gardenToken,
        octantModule: ADDRESS.octantModule,
        yieldSplitter: ADDRESS.yieldSplitter,
      },
      gardenAccountAddress: ADDRESS.gardenAccount,
      fallbackStartBlock: ARBITRUM_START_BLOCK,
    });

    const names = chains.find((chain) => chain.id === ARBITRUM)?.contracts.map((c) => c.name) ?? [];
    expect(names).toEqual([
      "ActionRegistry",
      "GardenToken",
      "GardenAccount",
      "OctantModule",
      "OctantVault",
      "YieldSplitter",
    ]);
  });

  it("ignores zero addresses rather than writing placeholders", () => {
    const chains = applyDeploymentToEnvioChains({
      chains: [existingArbitrumChain()],
      chainId: ARBITRUM,
      deployment: {
        actionRegistry: ADDRESS.actionRegistry,
        gardenToken: ADDRESS.gardenToken,
        greenWill: ZERO_ADDRESS,
      },
      gardenAccountAddress: ADDRESS.gardenAccount,
      fallbackStartBlock: ARBITRUM_START_BLOCK,
    });

    expect(findContract(chains, "GreenWill")).toBeUndefined();
  });

  it("does not disturb other configured chains", () => {
    const sepolia = { id: SEPOLIA, start_block: 10_243_363, contracts: [{ name: "OctantVault" }] };

    const chains = applyDeploymentToEnvioChains({
      chains: [existingArbitrumChain(), sepolia],
      chainId: ARBITRUM,
      deployment: { actionRegistry: ADDRESS.actionRegistry, gardenToken: ADDRESS.gardenToken },
      gardenAccountAddress: ADDRESS.gardenAccount,
      fallbackStartBlock: ARBITRUM_START_BLOCK,
    });

    expect(chains.find((chain) => chain.id === SEPOLIA)).toEqual(sepolia);
  });

  it("appends an unconfigured chain using the fallback start block", () => {
    const chains = applyDeploymentToEnvioChains({
      chains: [existingArbitrumChain()],
      chainId: SEPOLIA,
      deployment: { actionRegistry: ADDRESS.actionRegistry, gardenToken: ADDRESS.gardenToken },
      gardenAccountAddress: ADDRESS.gardenAccount,
      fallbackStartBlock: 10_243_363,
    });

    const added = chains.find((chain) => chain.id === SEPOLIA);
    expect(added?.start_block).toBe(10_243_363);
    expect(chains).toHaveLength(2);
  });
});
