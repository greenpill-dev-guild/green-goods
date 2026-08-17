import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { describe, it } from "mocha";

import {
  buildLocalContractEventConfig,
  LOCAL_ARBITRUM_RPC_URL,
  runLocalContractEventIntegration,
} from "./helpers/local-contract-events";

describe("local contract event indexer config", () => {
  it("uses the local RPC as the sole sync source across the mined transaction range", () => {
    const config = buildLocalContractEventConfig({
      baseConfig: `name: Green Goods\ncontracts:\n  - name: CommitmentPoolingModule\n    events: []\nchains:\n  - id: 42161\n    start_block: 1\n  - id: 11155111\n    start_block: 1\n`,
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
    assert.doesNotMatch(config, /id: 11155111/);
  });

  it("rejects an empty or inverted mined transaction range", () => {
    const input = {
      baseConfig: "name: Green Goods\nchains:\n",
      startBlock: 100n,
      endBlock: 99n,
      runId: "unit",
    };

    assert.throws(
      () => buildLocalContractEventConfig(input),
      /end block 99 is before start block 100/
    );
  });

  it("pins the integration RPC to loopback", () => {
    assert.equal(LOCAL_ARBITRUM_RPC_URL, "http://127.0.0.1:3009");
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
    this.timeout(240_000);
    await runLocalContractEventIntegration();
  });
});
