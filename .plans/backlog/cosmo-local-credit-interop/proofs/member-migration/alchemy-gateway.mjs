// Disposable read-only bridge between the selected Alchemy connector and an owned Anvil fork.
// No API key, transaction submission, signature or account mutation crosses this bridge.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { configs, previous, v } from "./fixture.mjs";

const directory = "/private/tmp/green-goods-helper-failure-20261022/gateway";
const network = process.argv[2];
assert.ok(configs[network]);
const pin = previous.pins[configs[network].network];
const candidates = JSON.parse(readFileSync(path.join(directory, "candidates.json"), "utf8"));
const methods = new Set([
  "eth_chainId",
  "eth_blockNumber",
  "eth_getBlockByNumber",
  "eth_getBlockByHash",
  "eth_getBalance",
  "eth_getTransactionCount",
  "eth_getCode",
  "eth_getStorageAt",
  "eth_getTransactionReceipt",
  "eth_getTransactionByHash",
]);

function validateRead(request) {
  assert.equal(request.jsonrpc, "2.0");
  assert.ok(methods.has(request.method), "Only selected read methods are allowed");
  const params = request.params ?? [];
  if (["eth_getBalance", "eth_getTransactionCount", "eth_getCode"].includes(request.method)) {
    assert.equal(params[1], pin.number);
  } else if (request.method === "eth_getStorageAt") {
    assert.equal(params[2], pin.number);
  } else if (request.method === "eth_getBlockByNumber") {
    assert.equal(params[0], pin.number);
  } else if (request.method === "eth_getBlockByHash") {
    assert.equal(params[0], pin.hash);
  }
}

function completeCode(result) {
  const code = result.code ?? candidates[result.codeHash]?.code;
  assert.ok(typeof code === "string", "No complete bytecode for Alchemy code hash");
  if (result.codeHash === v.zeroHash) {
    // Arbitrum returns a zero-hash sentinel for an absent account. Require its separate
    // eth_getCode result and all empty-account fields; this is not keccak256(empty code).
    assert.equal(code, "0x");
    assert.equal(result.emptyAccount?.balance, "0x0");
    assert.equal(result.emptyAccount?.nonce, "0x0");
    assert.equal(result.emptyAccount?.storageHash, v.zeroHash);
  } else {
    assert.equal(
      v.keccak256(code),
      result.codeHash,
      "Bytecode does not match pinned Alchemy code hash"
    );
  }
  return code;
}

const empty = {
  codeHash: v.zeroHash,
  code: "0x",
  emptyAccount: { balance: "0x0", nonce: "0x0", storageHash: v.zeroHash },
};
assert.equal(completeCode(empty), "0x");
assert.throws(() => completeCode({ ...empty, code: "0x00" }));
assert.throws(() =>
  completeCode({ ...empty, emptyAccount: { ...empty.emptyAccount, balance: "0x1" } })
);
assert.throws(() => completeCode({ codeHash: v.keccak256("0x01"), code: "0x02" }));

for (const request of [
  { method: "eth_sendRawTransaction", params: [] },
  { method: "eth_getCode", params: ["0x0000000000000000000000000000000000000001", "latest"] },
  {
    method: "eth_getStorageAt",
    params: ["0x0000000000000000000000000000000000000001", "0x0", "latest"],
  },
])
  assert.throws(() => validateRead({ jsonrpc: "2.0", ...request }));

mkdirSync(directory, { recursive: true });
let sequence = 0;
const readCache = new Map();
async function answer(request) {
  validateRead(request);
  const cacheable = ![
    "eth_blockNumber",
    "eth_getTransactionByHash",
    "eth_getTransactionReceipt",
  ].includes(request.method);
  const key = JSON.stringify([request.method, request.params ?? []]);
  if (cacheable && readCache.has(key))
    return { jsonrpc: "2.0", id: request.id, result: readCache.get(key) };
  const name = `${network}-${++sequence}`;
  const target = path.join(directory, name);
  writeFileSync(
    `${target}.request.json`,
    JSON.stringify({ network: configs[network].network, pin, request })
  );
  const deadline = Date.now() + 120_000;
  while (!existsSync(`${target}.response.json`)) {
    assert.ok(Date.now() < deadline, "Alchemy connector read timed out");
    await Bun.sleep(25);
  }
  const response = JSON.parse(readFileSync(`${target}.response.json`, "utf8"));
  if (response.error) return { jsonrpc: "2.0", id: request.id, error: response.error };
  let result = response.result;
  if (request.method === "eth_getCode") {
    result = completeCode(result);
  }
  if (cacheable) readCache.set(key, result);
  return { jsonrpc: "2.0", id: request.id, result };
}
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    try {
      assert.equal(request.method, "POST");
      const input = await request.json();
      const result = Array.isArray(input)
        ? await Promise.all(input.map(answer))
        : await answer(input);
      return Response.json(result);
    } catch (error) {
      return Response.json({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32600, message: error.message },
      });
    }
  },
});
writeFileSync(
  path.join(directory, `${network}-endpoint.json`),
  JSON.stringify({ url: server.url.href, pid: process.pid, network, pin })
);
process.stdout.write(
  `Read-only Alchemy bridge listening on owned loopback for ${network} at ${pin.number}\n`
);
