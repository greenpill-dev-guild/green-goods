import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Block, getCreateAddress, Interface, JsonRpcProvider, keccak256 } from "ethers";
import { vi } from "vitest";
import { sourceSafeSigningFixture } from "./source-upgrade-safe-signing.fixtures";
import { SOURCE_UPGRADE_TARGETS } from "./source-upgrade-release";
import { SOURCE_EXECUTION_FILES } from "./source-upgrade-execution-store";
import { buildSourceSafeBatch, SOURCE_MULTISEND } from "./source-upgrade-batch";
import { SOURCE_SAFE_EXECUTION } from "./source-upgrade-safe-execution";
import * as readback from "./source-upgrade-readback";
import { voucherDigest } from "./voucher-release";
import { CONTRACTS_ROOT } from "./paths";
import type { SourcePublicReceipt } from "./source-upgrade-execution-types";

/** Public read-port fixture; it is not a chain rehearsal or a real-owner signing assertion. */
export async function sourceBatchOperatorFixture(
  runSourceBatchOperator: typeof import("./source-upgrade-batch-operator").runSourceBatchOperator,
) {
  const f = await sourceSafeSigningFixture(),
    c = f.context;
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "source-batch-adoption-")));
  const hash = (n: number) => "0x" + n.toString(16).padStart(64, "0");
  const codeHash = keccak256("0x6000");
  c.manifest.authority.nonce = 33;
  c.manifest.pooling.implementationCodeHash = codeHash;
  c.manifest.settlement = {
    proxy: "0x1000000000000000000000000000000000000060",
    implementation: "0x1000000000000000000000000000000000000031",
    implementationCodeHash: codeHash,
    router: "0x1000000000000000000000000000000000000090",
    sourceSelector: "1",
    destinationChainId: "100",
  };
  c.plan.deployments = Array.from({ length: 23 }, (_, i) => ({
    ...c.plan.deployments[0],
    key: i === 21 ? SOURCE_UPGRADE_TARGETS.pooling : i === 22 ? SOURCE_UPGRADE_TARGETS.settlement : "library-" + i,
    kind: i >= 21 ? ("implementation" as const) : ("library" as const),
    nonce: 1039 + i,
    address: getCreateAddress({ from: c.manifest.deployer!, nonce: 1039 + i }),
  }));
  const abi = new Interface(["function setPaused(bool)", "function upgradeTo(address)"]);
  c.plan.ownerCalls = ["pooling", "settlement"]
    .flatMap((target, i) => [
      {
        target,
        action: "pause",
        to: c.manifest[target as "pooling" | "settlement"]!.proxy,
        data: abi.encodeFunctionData("setPaused", [true]),
      },
      {
        target,
        action: "upgrade",
        to: c.manifest[target as "pooling" | "settlement"]!.proxy,
        data: abi.encodeFunctionData("upgradeTo", [c.plan.deployments[21 + i].address]),
      },
    ])
    .map((row, i) => ({
      ...row,
      from: c.manifest.authority.address,
      value: "0",
      operation: 0,
      safeNonce: 33 + i,
    })) as typeof c.plan.ownerCalls;
  c.plan.manifestHash = voucherDigest(c.manifest);
  c.plan.artifactHashes = Object.fromEntries(c.plan.deployments.map((d) => [d.key, codeHash]));
  c.runtime.deployments = c.plan.deployments.map((d) => ({
    key: d.key,
    address: d.address,
    runtimeHash: codeHash,
    compilerJobHash: hash(4),
  }));
  c.rehearsal = {
    ...c.rehearsal,
    planHash: voucherDigest(c.plan),
    manifestHash: c.plan.manifestHash,
    deployments: c.runtime.deployments,
  };
  Object.assign(c.envelope, {
    planHash: voucherDigest(c.plan),
    manifestHash: c.plan.manifestHash,
    artifactHashes: c.plan.artifactHashes,
    rehearsalHash: voucherDigest(c.rehearsal),
    compilerJobHashes: Object.fromEntries(c.runtime.deployments.map((d) => [d.key, d.compilerJobHash])),
  });
  c.envelope.baseline.safe.nonce = 33;
  c.envelope.baseline.sources.settlement = {
    ...c.envelope.baseline.sources.pooling!,
    implementation: c.manifest.settlement.implementation,
  };
  c.envelope.boundaries = [
    ...c.plan.deployments.map((d, i) => ({
      step: i + 1,
      kind: "create" as const,
      from: d.from,
      nonce: d.nonce,
      gasLimit: "100000",
      maxFeeWei: "50000000",
      priorityFeeWei: "0" as const,
      runtimeHash: codeHash,
    })),
    ...c.plan.ownerCalls.map((call, i) => ({
      step: i + 24,
      kind: "safe" as const,
      from: c.manifest.deployer!,
      outerNonce: 1062 + i,
      safeNonce: call.safeNonce,
      gasLimit: "2000000",
      maxFeeWei: "50000000",
      priorityFeeWei: "0" as const,
      safeTxGas: "0" as const,
      baseGas: "0" as const,
    })),
  ];
  f.journal.planHash = voucherDigest(c.plan);
  f.journal.envelopeHash = voucherDigest(c.envelope);
  f.journal.completed = c.plan.deployments.map((_, i) => ({
    step: i + 1,
    transactionHash: hash(i + 1),
    blockNumber: 101 + i,
    blockHash: hash(101 + i),
    actualCostWei: "100000",
    runtimeHash: codeHash,
  }));
  f.journal.attempts = Object.fromEntries(
    f.journal.completed.map((e) => [
      e.transactionHash,
      {
        transactionHash: e.transactionHash,
        blockNumber: e.blockNumber,
        blockHash: e.blockHash,
        actualCostWei: e.actualCostWei,
        status: 1 as const,
      },
    ]),
  );
  const originalCreates = JSON.stringify(f.journal);
  fs.writeFileSync(path.join(directory, SOURCE_EXECUTION_FILES.journal), originalCreates);
  const batch = buildSourceSafeBatch(c.plan, 33),
    txHash = hash(500);
  const events = new Interface([
    "event ExecutionSuccess(bytes32 indexed txHash,uint256 payment)",
    "event ExecutionFailure(bytes32 indexed txHash,uint256 payment)",
  ]);
  const event = (name: string) => ({
    address: c.manifest.authority.address,
    ...events.encodeEventLog(events.getEvent(name)!, [batch.safeTransactionHash, 0]),
  });
  let successful = false,
    latest = 300,
    throwAfterCharge = false;
  const batchReceipt: SourcePublicReceipt = {
    hash: txHash,
    status: 1,
    blockNumber: 400,
    blockHash: hash(400),
    gasUsed: 200000n,
    gasPrice: 25000000n,
    contractAddress: null,
    logs: [event("ExecutionSuccess")],
  };
  const batchTx = {
    hash: txHash,
    chainId: 42161n,
    from: f.wallets[3].address,
    to: c.manifest.authority.address,
    nonce: 7,
    data: SOURCE_SAFE_EXECUTION.encodeFunctionData("execTransaction", [
      batch.message.to,
      0,
      batch.message.data,
      1,
      0,
      0,
      0,
      batch.message.gasToken,
      batch.message.refundReceiver,
      "0x1234",
    ]),
    value: 0n,
    gasLimit: 1000000n,
    maxFeePerGas: 100000000n,
    maxPriorityFeePerGas: 5000000n,
    blockNumber: 400,
    blockHash: hash(400),
  };
  const runtime = JSON.parse(
    fs.readFileSync(path.join(CONTRACTS_ROOT, "test/fixtures/source-safe-batch-runtimes.json"), "utf8"),
  );
  const port = {
    ...f.port,
    getBlock: async (n: number) => ({ hash: hash(n) }),
    getCode: async (address: string, _block: number | "latest") =>
      address === SOURCE_MULTISEND.address ? runtime.multiSend : "0x6000",
    getSafeState: async (block: number) => ({
      ...c.envelope.baseline.safe,
      nonce: successful && block >= 400 ? 34 : 33,
    }),
    getProxyState: async (target: "pooling" | "settlement", block: number) => {
      if (throwAfterCharge && block >= 400) {
        throwAfterCharge = false;
        throw Error("temporary post-receipt read failure");
      }
      return {
        ...c.envelope.baseline.sources[target]!,
        ...(successful && block >= 400
          ? { implementation: c.plan.deployments[target === "pooling" ? 21 : 22].address, paused: true }
          : {}),
      };
    },
    getTransaction: async (h: string) => {
      if (h === txHash) return { ...batchTx };
      const i = Number(BigInt(h)) - 1,
        d = c.plan.deployments[i];
      return {
        ...batchTx,
        hash: h,
        from: d.from,
        to: null,
        nonce: d.nonce,
        data: d.data,
        gasLimit: 100000n,
        maxFeePerGas: 50000000n,
        maxPriorityFeePerGas: 0n,
        blockNumber: 101 + i,
        blockHash: hash(101 + i),
      };
    },
    getReceipt: async (h: string) => {
      if (h === txHash) return { ...batchReceipt };
      const i = Number(BigInt(h)) - 1;
      return {
        ...batchReceipt,
        status: 1 as const,
        hash: h,
        blockNumber: 101 + i,
        blockHash: hash(101 + i),
        gasUsed: 100n,
        gasPrice: 1000n,
        contractAddress: c.plan.deployments[i].address,
        logs: [],
      };
    },
  };
  vi.spyOn(readback, "createSourceUpgradeReadback").mockReturnValue(port);
  const provider = new JsonRpcProvider("http://127.0.0.1:1");
  vi.spyOn(provider, "getBlock").mockImplementation(async (tag) => {
    const n = tag === "latest" ? latest : Number(tag);
    return { number: n, hash: hash(n) } as Block;
  });
  vi.spyOn(provider, "call").mockResolvedValue(batch.safeTransactionHash);
  const rehearsalPath = path.join(directory, "atomic-rehearsal.json");
  const proof = {
    planHash: voucherDigest(c.plan),
    runtimeBindingHash: c.runtime.bindingHash,
    toolingRevision: c.plan.sourceCommit,
    safeTransactionHash: batch.safeTransactionHash,
    multiSend: SOURCE_MULTISEND,
    atomicFailureRollback: true,
    retrySucceeded: true,
    safeNonceAfter: 34,
    liveBroadcast: false,
  };
  fs.writeFileSync(rehearsalPath, JSON.stringify(proof));
  const run = (options: Record<string, string | boolean>) =>
    runSourceBatchOperator({
      context: c,
      directory,
      provider,
      abis: {},
      revision: c.plan.sourceCommit,
      regenerateBindings: async () => ({ plan: c.plan, runtime: c.runtime }),
      options,
    });
  const reviewPath = path.join(directory, c.plan.releaseId + ".safe-batch.review.json");
  return {
    ...f,
    directory,
    context: c,
    port,
    batch,
    batchReceipt,
    batchTx,
    txHash,
    proof,
    rehearsalPath,
    reviewPath,
    event,
    originalCreates,
    export: async () => {
      const result = await run({ mode: "export-safe-batch", "batch-rehearsal": rehearsalPath });
      if (!("output" in result)) throw Error("Wrong export result");
      return result;
    },
    adopt: async (recover = false, receipt = txHash) => {
      const result = await run({
        mode: "adopt-safe-batch",
        batch: reviewPath,
        receipt,
        ...(recover ? { "recover-lock": true } : {}),
      });
      if (!("externalPayer" in result)) throw Error("Wrong adoption result");
      return result;
    },
    afterSuccess: () => {
      successful = true;
      latest = 500;
    },
    failReadOnce: () => {
      throwAfterCharge = true;
    },
    journal: () => JSON.parse(fs.readFileSync(path.join(directory, "42161-source-safe-batch-execution.json"), "utf8")),
    cleanup: () => {
      provider.destroy();
      fs.rmSync(directory, { recursive: true, force: true });
    },
  };
}
