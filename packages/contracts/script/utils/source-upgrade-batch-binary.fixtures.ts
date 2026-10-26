import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { Interface, JsonRpcProvider, keccak256, Wallet, zeroPadValue, concat } from "ethers";
import { CONTRACTS_ROOT } from "./paths";
import { assertIsolatedRpc, minedIsolatedReceipt } from "./isolated-fork";
import { buildSourceSafeBatch, assertSourceBatchSuccess, SOURCE_MULTISEND } from "./source-upgrade-batch";
import { SOURCE_SAFE_EXECUTION } from "./source-upgrade-safe-execution";
import type { SourceUpgradePlan } from "./source-upgrade-release";

/** Small EVM receiver fixture: Safe-only writes, pause before upgrade, reject an implementation without code. */
function targetRuntime(safe: string) {
  const bytes: string[] = [],
    labels = new Map<string, number>(),
    jumps: Array<{ index: number; name: string }> = [];
  let offset = 0;
  const emit = (hex: string) => {
    bytes.push(hex);
    offset += hex.length / 2;
  };
  const jump = (name: string) => {
    emit("61");
    jumps.push({ index: bytes.length, name });
    emit("0000");
    emit("57");
  };
  const label = (name: string) => {
    labels.set(name, offset);
    emit("5b");
  };
  emit("3373" + safe.slice(2).toLowerCase() + "14");
  jump("owner");
  emit("5f5ffd");
  label("owner");
  emit("5f3560e01c6316c38b3c14");
  jump("pause");
  emit("600435803b15");
  jump("fail");
  emit("5f5415");
  jump("fail");
  emit("60015500");
  label("pause");
  emit("6004355f5500");
  label("fail");
  emit("5f5ffd");
  for (const j of jumps) bytes[j.index] = labels.get(j.name)!.toString(16).padStart(4, "0");
  return "0x" + bytes.join("");
}
/** Real Safe/MultiSend binary behavior, synthetic target storage and keys; never calls a public RPC. */
export async function sourceBatchBinaryFixture() {
  const runtime = JSON.parse(
    fs.readFileSync(path.join(CONTRACTS_ROOT, "test/fixtures/source-safe-batch-runtimes.json"), "utf8"),
  );
  const pins = JSON.parse(fs.readFileSync(path.join(CONTRACTS_ROOT, "config/source-upgrade-safe-pins.json"), "utf8"));
  if (
    keccak256(runtime.singleton) !== pins.singletonRuntimeHash ||
    keccak256(runtime.multiSend) !== SOURCE_MULTISEND.runtimeHash
  )
    throw Error("Binary fixture pin mismatch");
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as net.AddressInfo).port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  const child = spawn(
    "anvil",
    ["--host", "127.0.0.1", "--port", String(port), "--chain-id", "42161", "--base-fee", "0", "--silent"],
    { stdio: "ignore" },
  );
  const rpc = `http://127.0.0.1:${port}`;
  assertIsolatedRpc(rpc);
  const provider = new JsonRpcProvider(rpc, undefined, { cacheTimeout: -1, batchStallTime: 0 });
  provider.pollingInterval = 10;
  try {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try {
        await provider.send("eth_chainId", []);
        ready = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
    if (!ready) throw Error("Owned binary-fixture Anvil unavailable");
    const owners = [1, 2, 3, 4, 5].map((n) => new Wallet(zeroPadValue("0x" + n.toString(16).padStart(2, "0"), 32)));
    const safe = "0x1000000000000000000000000000000000000012",
      a = "0x1000000000000000000000000000000000000050",
      b = "0x1000000000000000000000000000000000000060",
      ia = "0x1000000000000000000000000000000000000070",
      ib = "0x1000000000000000000000000000000000000080";
    await provider.send("anvil_setCode", [pins.singleton, runtime.singleton]);
    await provider.send("anvil_setCode", [
      safe,
      "0x363d3d373d3d3d363d73" + pins.singleton.slice(2) + "5af43d82803e903d91602b57fd5bf3",
    ]);
    await provider.send("anvil_setStorageAt", [safe, zeroPadValue("0x00", 32), zeroPadValue(pins.singleton, 32)]);
    await provider.send("anvil_setCode", [SOURCE_MULTISEND.address, runtime.multiSend]);
    for (const address of [a, b]) await provider.send("anvil_setCode", [address, targetRuntime(safe)]);
    await provider.send("anvil_setCode", [ia, "0x60006000f3"]);
    const abi = new Interface([
      "function setup(address[],uint256,address,bytes,address,address,uint256,address)",
      "function nonce() view returns(uint256)",
    ]);
    const zero = "0x0000000000000000000000000000000000000000",
      sender = await provider.getSigner(0);
    await (
      await sender.sendTransaction({
        to: safe,
        data: abi.encodeFunctionData("setup", [owners.map((o) => o.address), 2, zero, "0x", zero, zero, 0, zero]),
        gasLimit: 2000000,
      })
    ).wait();
    const ownerAbi = new Interface(["function setPaused(bool)", "function upgradeTo(address)"]);
    const plan = {
      chainId: 42161,
      ownerCalls: [
        { target: "pooling", action: "pause", to: a, data: ownerAbi.encodeFunctionData("setPaused", [true]) },
        { target: "pooling", action: "upgrade", to: a, data: ownerAbi.encodeFunctionData("upgradeTo", [ia]) },
        { target: "settlement", action: "pause", to: b, data: ownerAbi.encodeFunctionData("setPaused", [true]) },
        { target: "settlement", action: "upgrade", to: b, data: ownerAbi.encodeFunctionData("upgradeTo", [ib]) },
      ].map((c, i) => ({ ...c, from: safe, value: "0", operation: 0, safeNonce: i })),
    } as SourceUpgradePlan;
    const batch = buildSourceSafeBatch(plan, 0);
    const signatures = await Promise.all(
      owners
        .slice(0, 2)
        .sort((a, b) => (BigInt(a.address) < BigInt(b.address) ? -1 : 1))
        .map((o) => o.signTypedData(batch.domain, { SafeTx: batch.types.SafeTx }, batch.message)),
    );
    const m = batch.message,
      data = SOURCE_SAFE_EXECUTION.encodeFunctionData("execTransaction", [
        m.to,
        0,
        m.data,
        1,
        0,
        0,
        0,
        zero,
        zero,
        concat(signatures),
      ]);
    const send = async () =>
      minedIsolatedReceipt(
        provider,
        await provider.send("eth_sendTransaction", [
          { from: await sender.getAddress(), to: safe, data, gas: "0x3d0900" },
        ]),
      );
    const failed = await send();
    if (failed.status !== 0) throw Error("Missing last implementation did not atomically revert");
    for (const address of [a, b])
      for (const slot of [0, 1])
        if (BigInt(await provider.getStorage(address, slot)) !== 0n)
          throw Error("Partial batch storage escaped rollback");
    const nonce = async () =>
      BigInt(
        abi.decodeFunctionResult("nonce", await provider.call({ to: safe, data: abi.encodeFunctionData("nonce") }))[0],
      );
    if ((await nonce()) !== 0n) throw Error("Failed zero-refund execution consumed nonce");
    await provider.send("anvil_setCode", [ib, "0x60006000f3"]);
    const receipt = await send();
    if (receipt.status !== 1 || (await nonce()) !== 1n) throw Error("Atomic retry failed");
    assertSourceBatchSuccess(
      receipt.logs.map((l) => ({ address: l.address, topics: [...l.topics], data: l.data })),
      batch,
    );
    for (const [address, impl] of [
      [a, ia],
      [b, ib],
    ])
      if (
        BigInt(await provider.getStorage(address, 0)) !== 1n ||
        BigInt(await provider.getStorage(address, 1)) !== BigInt(impl)
      )
        throw Error("Wrong batch end state");
    const replay = await send();
    if (replay.status !== 0 || (await nonce()) !== 1n) throw Error("Stale batch replay succeeded");
    return {
      atomicRollback: true,
      retrySucceeded: true,
      replayRejected: true,
      safeNonceAfter: 1,
      syntheticOwnerSignatures: 2,
      canonicalSingletonHash: pins.singletonRuntimeHash,
      canonicalMultiSendHash: SOURCE_MULTISEND.runtimeHash,
      liveBroadcast: false,
    };
  } finally {
    provider.destroy();
    child.kill("SIGTERM");
    await new Promise<void>((resolve) => (child.exitCode !== null ? resolve() : child.once("exit", () => resolve())));
  }
}
