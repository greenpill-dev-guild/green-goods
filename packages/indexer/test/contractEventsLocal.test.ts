import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { describe, it } from "mocha";

import {
  buildLocalContractEventConfig,
  LOCAL_ARBITRUM_RPC_URL,
  LOCAL_CONTRACT_EVENT_CLEANUP_BUDGET_MS,
  LOCAL_CONTRACT_EVENT_MOCHA_TIMEOUT_MS,
  LOCAL_CONTRACT_EVENT_OPERATION_TIMEOUT_MS,
  resolvePoolingContracts,
  runAbortableOperationWithCleanup,
  runLocalContractEventIntegration,
} from "./helpers/local-contract-events";

const TEST_CONTRACTS = {
  commitmentPoolingModule: "0x6BB5b0fd70b6771B0E955Fef37f8Bd2ce911470a",
  commitmentRegistry: "0x66300dA4d3749bFc9F7326DB94e0DEb47A7a3959",
} as const;

describe("local contract event indexer config", () => {
  it("uses the local RPC as the sole sync source across the mined transaction range", () => {
    const config = buildLocalContractEventConfig({
      baseConfig: `name: Green Goods\ncontracts:\n  - name: CommitmentPoolingModule\n    events: []\nchains:\n  - id: 42161\n    start_block: 1\n  - id: 11155111\n    start_block: 1\n`,
      contracts: TEST_CONTRACTS,
      startBlock: 100n,
      endBlock: 112n,
      runId: "unit",
    });

    assert.match(config, /name: Green Goods Contract Event Integration unit/);
    assert.match(config, /start_block: 100/);
    assert.match(config, /end_block: 112/);
    assert.match(config, /url: "http:\/\/127\.0\.0\.1:3009"/);
    assert.match(config, /for: sync/);
    assert.match(config, /max_reorg_depth: 0/);
    assert.match(config, /block_lag: 0/);
    assert.match(config, /contracts:\n  - name: CommitmentPoolingModule\n    events: \[\]/);
    assert.match(config, new RegExp(`address: "${TEST_CONTRACTS.commitmentPoolingModule}"`));
    assert.match(config, new RegExp(`address: "${TEST_CONTRACTS.commitmentRegistry}"`));
    assert.doesNotMatch(config, /id: 11155111/);
  });

  it("rejects an empty or inverted mined transaction range", () => {
    const input = {
      baseConfig: "name: Green Goods\nchains:\n",
      contracts: TEST_CONTRACTS,
      startBlock: 100n,
      endBlock: 99n,
      runId: "unit",
    };

    assert.throws(
      () => buildLocalContractEventConfig(input),
      /end block 99 is before start block 100/
    );
  });

  it("pins the live config to the canonical Arbitrum deployment artifact", async () => {
    const [config, deployment] = await Promise.all([
      readFile(new URL("../config.yaml", import.meta.url), "utf8"),
      readFile(new URL("../../contracts/deployments/42161-latest.json", import.meta.url), "utf8"),
    ]);
    const contracts = resolvePoolingContracts(config, deployment);
    const generated = buildLocalContractEventConfig({
      baseConfig: config,
      contracts,
      startBlock: 100n,
      endBlock: 112n,
      runId: "canonical",
    });

    assert.ok(generated.indexOf("contracts:") < generated.indexOf("chains:"));
    assert.match(generated, /event: CommitmentCreated\(/);
    assert.match(generated, new RegExp(`address: "${contracts.commitmentPoolingModule}"`));
    assert.match(generated, new RegExp(`address: "${contracts.commitmentRegistry}"`));
  });

  it("fails closed when indexer config and deployment addresses drift", async () => {
    const [config, deploymentSource] = await Promise.all([
      readFile(new URL("../config.yaml", import.meta.url), "utf8"),
      readFile(new URL("../../contracts/deployments/42161-latest.json", import.meta.url), "utf8"),
    ]);
    const deployment = JSON.parse(deploymentSource) as Record<string, unknown>;
    deployment.commitmentRegistry = "0x0000000000000000000000000000000000000001";

    assert.throws(
      () => resolvePoolingContracts(config, JSON.stringify(deployment)),
      /pooling addresses drifted/
    );
  });

  it("resolves canonical contracts across legal YAML indentation and quoting changes", () => {
    const config = `chains:
    - id: 42161
      contracts:
          - name: CommitmentPoolingModule
            address: '${TEST_CONTRACTS.commitmentPoolingModule}'
          - name: CommitmentRegistry
            address: '${TEST_CONTRACTS.commitmentRegistry}'
`;
    const deployment = JSON.stringify(TEST_CONTRACTS);

    assert.deepEqual(resolvePoolingContracts(config, deployment), TEST_CONTRACTS);
  });

  it("pins the integration RPC to loopback", () => {
    assert.equal(LOCAL_ARBITRUM_RPC_URL, "http://127.0.0.1:3009");
  });

  it("reserves enough Mocha time for the operation deadline and teardown", async () => {
    const packageJson = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8")
    ) as { scripts?: { "test:contract-events"?: string } };
    const configuredTimeout = Number(
      packageJson.scripts?.["test:contract-events"]?.match(/--timeout (\d+)/)?.[1]
    );

    assert.equal(configuredTimeout, LOCAL_CONTRACT_EVENT_MOCHA_TIMEOUT_MS);
    assert.ok(
      LOCAL_CONTRACT_EVENT_OPERATION_TIMEOUT_MS + LOCAL_CONTRACT_EVENT_CLEANUP_BUDGET_MS <
        LOCAL_CONTRACT_EVENT_MOCHA_TIMEOUT_MS,
      "the integration must enter cleanup before Mocha can terminate the test"
    );
  });

  it("runs teardown when the internal operation deadline expires", async () => {
    let cleanupCalls = 0;

    await assert.rejects(
      runAbortableOperationWithCleanup({
        timeoutMs: 5,
        run: async (signal) => {
          await new Promise<void>((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(signal.reason), { once: true });
          });
        },
        cleanup: async () => {
          cleanupCalls += 1;
        },
      }),
      /operation exceeded its 5ms deadline/
    );
    assert.equal(cleanupCalls, 1);
  });

  it("lets the test use an isolated Docker network without changing normal dev defaults", async () => {
    const compose = await readFile(
      new URL("../docker-compose.indexer.yaml", import.meta.url),
      "utf8"
    );
    assert.match(compose, /name: \$\{INDEXER_NETWORK_NAME:-green_goods_indexer_network\}/);
  });
});

const describeIntegration =
  process.env.GG_RUN_LOCAL_CONTRACT_EVENT_INTEGRATION === "1" ? describe : describe.skip;

describeIntegration("real Commitment Pooling contract logs through local Envio", () => {
  it("indexes the mined pool, cycle, commitment, registry, and audit projections", async function () {
    this.timeout(LOCAL_CONTRACT_EVENT_MOCHA_TIMEOUT_MS);
    await runLocalContractEventIntegration();
  });
});
