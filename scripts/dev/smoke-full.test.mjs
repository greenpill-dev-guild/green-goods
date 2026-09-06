import assert from "node:assert/strict";
import test from "node:test";
import { checkChain, checkIndexerLag, checkStackProfiles } from "./smoke-full.js";

const requestFrom = (values) => async (method) => {
  assert.ok(method in values, `Unexpected RPC method ${method}`);
  return values[method];
};

test("live smoke rejects Anvil even when its chain ID is 42161", async () => {
  const result = await checkChain({
    fork: false,
    request: requestFrom({ eth_chainId: "0xa4b1", web3_clientVersion: "anvil/v1.0" }),
  });
  assert.equal(result.ready, false);
  assert.match(result.detail, /local fork RPC/);
});

test("live smoke accepts an Arbitrum node and records its head", async () => {
  const result = await checkChain({
    fork: false,
    request: requestFrom({ eth_chainId: "0xa4b1", web3_clientVersion: "Arbitrum Nitro", eth_blockNumber: "0x1000" }),
  });
  assert.equal(result.ready, true);
  assert.equal(result.headBlock, 4096);
});

test("fork smoke rejects a live node and a wrong-chain node", async () => {
  for (const values of [
    { eth_chainId: "0xa4b1", web3_clientVersion: "Arbitrum Nitro" },
    { eth_chainId: "0x1" },
  ]) {
    assert.equal((await checkChain({ fork: true, request: requestFrom(values) })).ready, false);
  }
});

test("an indexer's stale source block cannot hide its lag behind live Arbitrum", () => {
  const indexer = { progressBlock: 100, sourceBlock: 110 };
  assert.equal(checkIndexerLag(indexer, undefined, 20).ready, true);
  assert.equal(checkIndexerLag(indexer, 200, 20).ready, false);
});


test("live smoke refuses legacy fork processes even with a healthy public RPC", () => {
  const services = { 3001: "client", 3002: "admin", 3005: "agent" };
  for (const profile of ["local", "fork", "local-live"]) {
    const result = checkStackProfiles({
      fork: false,
      inspect: ({ port }) => ({ claim: { compatibilityKey: `${services[port]}:${profile}` } }),
    });
    assert.equal(result.ready, profile === "local-live");
  }
  assert.equal(checkStackProfiles({ inspect: () => ({}) }).ready, false);
});
