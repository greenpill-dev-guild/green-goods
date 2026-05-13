import { describe, expect, it } from "vitest";

import {
  buildMarketplaceConfigurationCalls,
  MARKETPLACE_STRATEGY_ID,
  validateIndexerDeploymentCoverage,
  validateMarketplaceReadiness,
  ZERO_ADDRESS,
} from "./marketplace-readiness";

const ADDRESS = {
  actionRegistry: "0x0000000000000000000000000000000000001000",
  adapter: "0x0000000000000000000000000000000000001001",
  module: "0x0000000000000000000000000000000000001002",
  exchange: "0x0000000000000000000000000000000000001003",
  minter: "0x0000000000000000000000000000000000001004",
  transferManager: "0x0000000000000000000000000000000000001005",
  strategy: "0x0000000000000000000000000000000000001006",
  owner: "0x0000000000000000000000000000000000001007",
  other: "0x0000000000000000000000000000000000001008",
  yieldSplitter: "0x0000000000000000000000000000000000001009",
  gardensModule: "0x0000000000000000000000000000000000001010",
};

function completeDeployment(overrides: Record<string, unknown> = {}) {
  return {
    actionRegistry: ADDRESS.actionRegistry,
    marketplaceAdapter: ADDRESS.adapter,
    hypercertsModule: ADDRESS.module,
    hypercertExchange: ADDRESS.exchange,
    hypercertMinter: ADDRESS.minter,
    transferManager: ADDRESS.transferManager,
    strategyHypercertFractionOffer: ADDRESS.strategy,
    ...overrides,
  };
}

function readyState(overrides: Record<string, unknown> = {}) {
  return {
    adapter: {
      address: ADDRESS.adapter,
      hasCode: true,
      paused: false,
      owner: ADDRESS.owner,
      exchange: ADDRESS.exchange,
      hypercertMinter: ADDRESS.minter,
      authorizedModule: true,
    },
    module: {
      address: ADDRESS.module,
      hasCode: true,
      paused: false,
      owner: ADDRESS.owner,
      marketplaceAdapter: ADDRESS.adapter,
      hypercertMinter: ADDRESS.minter,
    },
    exchange: {
      address: ADDRESS.exchange,
      hasCode: true,
      transferManager: ADDRESS.transferManager,
      strategy: {
        id: MARKETPLACE_STRATEGY_ID,
        isActive: true,
        implementation: ADDRESS.strategy,
      },
    },
    hypercertMinter: { address: ADDRESS.minter, hasCode: true },
    transferManager: { address: ADDRESS.transferManager, hasCode: true },
    strategyHypercertFractionOffer: { address: ADDRESS.strategy, hasCode: true },
    ...overrides,
  };
}

describe("marketplace readiness policy", () => {
  it("fails closed when Hypercert exchange, minter, transfer manager, or strategy config is missing", () => {
    const result = validateMarketplaceReadiness(
      completeDeployment({
        hypercertExchange: ZERO_ADDRESS,
        hypercertMinter: undefined,
        transferManager: ZERO_ADDRESS,
        strategyHypercertFractionOffer: undefined,
      }),
      readyState(),
    );

    expect(result.failures).toEqual(
      expect.arrayContaining([
        "deployment.hypercertExchange is zero or missing",
        "deployment.hypercertMinter is zero or missing",
        "deployment.transferManager is zero or missing",
        "deployment.strategyHypercertFractionOffer is zero or missing",
      ]),
    );
  });

  it("detects adapter and module Hypercert minter mismatches", () => {
    const result = validateMarketplaceReadiness(
      completeDeployment(),
      readyState({
        adapter: {
          ...readyState().adapter,
          hypercertMinter: ADDRESS.other,
        },
        module: {
          ...readyState().module,
          hypercertMinter: ADDRESS.other,
        },
      }),
    );

    expect(result.failures).toEqual(
      expect.arrayContaining([
        `marketplaceAdapter.hypercertMinter mismatch: expected ${ADDRESS.minter}, got ${ADDRESS.other}`,
        `hypercertsModule.hypercertMinter mismatch: expected ${ADDRESS.minter}, got ${ADDRESS.other}`,
      ]),
    );
  });

  it("detects paused adapter state", () => {
    const result = validateMarketplaceReadiness(
      completeDeployment(),
      readyState({
        adapter: {
          ...readyState().adapter,
          paused: true,
        },
      }),
    );

    expect(result.failures).toContain("marketplaceAdapter is paused");
  });

  it("checks adapter and module owner only when an expected owner is declared", () => {
    const result = validateMarketplaceReadiness(
      completeDeployment(),
      readyState({
        adapter: {
          ...readyState().adapter,
          owner: ADDRESS.other,
        },
        module: {
          ...readyState().module,
          owner: ADDRESS.other,
        },
      }),
      { expectedOwner: ADDRESS.owner },
    );

    expect(result.failures).toEqual(
      expect.arrayContaining([
        `marketplaceAdapter.owner mismatch: expected ${ADDRESS.owner}, got ${ADDRESS.other}`,
        `hypercertsModule.owner mismatch: expected ${ADDRESS.owner}, got ${ADDRESS.other}`,
      ]),
    );
  });

  it("detects unauthorized module state", () => {
    const result = validateMarketplaceReadiness(
      completeDeployment(),
      readyState({
        adapter: {
          ...readyState().adapter,
          authorizedModule: false,
        },
      }),
    );

    expect(result.failures).toContain(`marketplaceAdapter.authorizedModules(${ADDRESS.module}) is false`);
  });

  it("detects wrong exchange transfer manager and unsupported strategy id", () => {
    const result = validateMarketplaceReadiness(
      completeDeployment(),
      readyState({
        exchange: {
          ...readyState().exchange,
          transferManager: ADDRESS.other,
          strategy: {
            id: 2n,
            isActive: false,
            implementation: ADDRESS.other,
          },
        },
      }),
    );

    expect(result.failures).toEqual(
      expect.arrayContaining([
        `hypercertExchange.transferManager mismatch: expected ${ADDRESS.transferManager}, got ${ADDRESS.other}`,
        "hypercertExchange strategy id expected 1, got 2",
        "hypercertExchange strategy 1 is not active",
        `hypercertExchange strategy 1 implementation mismatch: expected ${ADDRESS.strategy}, got ${ADDRESS.other}`,
      ]),
    );
  });

  it("prepares only the needed owner calls and never touches YieldSplitter marketplace wiring", () => {
    const calls = buildMarketplaceConfigurationCalls(
      completeDeployment(),
      readyState({
        adapter: {
          ...readyState().adapter,
          exchange: ZERO_ADDRESS,
          hypercertMinter: ZERO_ADDRESS,
          authorizedModule: false,
        },
        module: {
          ...readyState().module,
          hypercertMinter: ZERO_ADDRESS,
        },
      }),
    );

    expect(calls.map((call) => call.signature)).toEqual([
      "setExchange(address)",
      "setHypercertMinter(address)",
      "setHypercertMinter(address)",
      "setAuthorizedModule(address,bool)",
    ]);
    expect(calls.map((call) => call.target)).toEqual([
      ADDRESS.adapter,
      ADDRESS.adapter,
      ADDRESS.module,
      ADDRESS.adapter,
    ]);
    expect(calls.some((call) => call.signature.includes("setHypercertMarketplace"))).toBe(false);
  });
});

describe("indexer readiness policy", () => {
  it("requires only deployment contracts that Envio currently defines", () => {
    const result = validateIndexerDeploymentCoverage(
      "42161",
      {
        contracts: [{ name: "ActionRegistry" }, { name: "YieldSplitter" }],
        networks: [
          {
            id: 42161,
            contracts: [{ name: "ActionRegistry", address: ADDRESS.actionRegistry }],
          },
        ],
      },
      {
        actionRegistry: ADDRESS.actionRegistry,
        yieldSplitter: ADDRESS.yieldSplitter,
        marketplaceAdapter: ADDRESS.adapter,
        gardensModule: ADDRESS.gardensModule,
      },
    );

    expect(result.failures).toContain("Indexer address missing for YieldSplitter");
    expect(result.failures.some((failure) => failure.includes("HypercertMarketplaceAdapter"))).toBe(false);
    expect(result.failures.some((failure) => failure.includes("GardensModule"))).toBe(false);
    expect(result.skipped).toEqual(expect.arrayContaining(["HypercertMarketplaceAdapter", "GardensModule"]));
  });
});
