import fs from "node:fs";
import path from "node:path";
import { concat, Interface, JsonRpcProvider, keccak256, toQuantity, zeroPadValue } from "ethers";
import { assertIsolatedRpc, minedIsolatedReceipt, startIsolatedFork } from "./isolated-fork";
import { CONTRACTS_ROOT } from "./paths";
import { releaseRevision } from "./release-inputs";
import { materializeSourceUpgradeRuntimes, type SourceUpgradeCompilerJobs } from "./source-upgrade-runtime";
import {
  SOURCE_UPGRADE_TARGETS,
  type SourceUpgradeArtifacts,
  type SourceUpgradeManifest,
  type SourceUpgradePlan,
} from "./source-upgrade-release";
import { prepareSourceUpgradeBaseline, sourceUpgradeStateReaders } from "./source-upgrade-readback";
import { SOURCE_SAFE_EXECUTION } from "./source-upgrade-safe-execution";
import { assertSourceBatchSuccess, buildSourceSafeBatch, SOURCE_MULTISEND } from "./source-upgrade-batch";
import { assertSourceBatchState, batchCheck, batchSame } from "./source-upgrade-batch-verification";
import { voucherDigest } from "./voucher-release";

/** Only the owned loopback is mutated. Original owners approve the exact hash on the fork, never live. */
export async function simulateSourceSafeBatch(
  plan: SourceUpgradePlan,
  manifest: SourceUpgradeManifest,
  artifacts: SourceUpgradeArtifacts,
  upstream: string,
  jobs: SourceUpgradeCompilerJobs,
  toolingRevision: string,
) {
  const pinsPath = path.join(CONTRACTS_ROOT, "config/source-upgrade-safe-pins.json");
  batchCheck(releaseRevision(CONTRACTS_ROOT, pinsPath) === toolingRevision, "committed Safe pins revision");
  const runtime = materializeSourceUpgradeRuntimes(plan, manifest, artifacts, jobs);
  const fork = await startIsolatedFork(upstream, 42161);
  assertIsolatedRpc(fork.rpc);
  const provider = new JsonRpcProvider(fork.rpc, undefined, { cacheTimeout: -1, batchStallTime: 0 });
  provider.pollingInterval = 10;
  try {
    const safePins = JSON.parse(fs.readFileSync(pinsPath, "utf8"));
    const abis = Object.fromEntries(
      Object.entries(SOURCE_UPGRADE_TARGETS).map(([target, key]) => [target, new Interface(artifacts[key].abi)]),
    );
    const r = sourceUpgradeStateReaders({ provider, manifest, abis });
    const baseline = await prepareSourceUpgradeBaseline({ provider, manifest, abis, safePins });
    const context = { plan, manifest, runtime, envelope: { baseline, safePins } };
    const port = {
      getSafeState: r.getSafeState,
      getProxyState: r.getProxyState,
      getCode: (address: string, block: number | "latest") => provider.getCode(address, block),
      verifyImplementationGetters: async (
        d: (typeof plan.deployments)[number],
        _m: SourceUpgradeManifest,
        block: number,
      ) => r.implementation(d.key === SOURCE_UPGRADE_TARGETS.pooling ? "pooling" : "settlement", d.address, block),
      assertNewPeerPinsEmpty: r.assertNewPeerPinsEmpty,
    };
    await assertSourceBatchState(context, port, (await r.block("latest")).number, baseline.safe.nonce, false);
    await provider.send("anvil_impersonateAccount", [manifest.deployer]);
    await provider.send("anvil_setBalance", [manifest.deployer, toQuantity(100n * 10n ** 18n)]);
    const deployments = [];
    for (const [i, d] of plan.deployments.entries()) {
      const existing = await provider.getCode(d.address);
      if (existing !== "0x") {
        batchSame(keccak256(existing), runtime.deployments[i].runtimeHash, "existing CREATE exact runtime");
        deployments.push({
          address: d.address,
          runtimeHash: runtime.deployments[i].runtimeHash,
          alreadyDeployed: true,
        });
        continue;
      }
      batchCheck((await provider.getTransactionCount(d.from, "pending")) === d.nonce, "remaining CREATE nonce");
      const gas = await provider.estimateGas({ from: d.from, data: d.data, value: 0n });
      const hash = await provider.send("eth_sendTransaction", [
        {
          from: d.from,
          nonce: toQuantity(d.nonce),
          data: d.data,
          value: "0x0",
          gas: toQuantity((gas * 130n + 99n) / 100n),
        },
      ]);
      const receipt = await minedIsolatedReceipt(provider, hash);
      batchCheck(
        receipt.status === 1 && receipt.contractAddress?.toLowerCase() === d.address.toLowerCase(),
        "fork CREATE receipt",
      );
      batchSame(
        keccak256(await provider.getCode(d.address)),
        runtime.deployments[i].runtimeHash,
        "fork CREATE runtime",
      );
      deployments.push({
        address: d.address,
        runtimeHash: runtime.deployments[i].runtimeHash,
        transactionHash: hash,
        alreadyDeployed: false,
      });
    }
    const before = await r.block("latest"),
      safe = await r.getSafeState(before.number);
    const batch = buildSourceSafeBatch(plan, safe.nonce),
      approve = new Interface(["function approveHash(bytes32)"]);
    const owners = [...safe.owners].slice(0, 2).sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));
    for (const owner of owners) {
      await provider.send("anvil_impersonateAccount", [owner]);
      await provider.send("anvil_setBalance", [owner, toQuantity(100n * 10n ** 18n)]);
      const hash = await provider.send("eth_sendTransaction", [
        {
          from: owner,
          to: manifest.authority.address,
          data: approve.encodeFunctionData("approveHash", [batch.safeTransactionHash]),
          gas: "0x186a0",
        },
      ]);
      batchCheck((await minedIsolatedReceipt(provider, hash)).status === 1, "fork hash approval");
    }
    const signatures = concat(
      owners.map((owner) => concat([zeroPadValue(owner, 32), zeroPadValue("0x00", 32), "0x01"])),
    );
    const m = batch.message;
    const data = SOURCE_SAFE_EXECUTION.encodeFunctionData("execTransaction", [
      m.to,
      0,
      m.data,
      1,
      0,
      0,
      0,
      m.gasToken,
      m.refundReceiver,
      signatures,
    ]);
    const last = plan.deployments.find((d) => d.key === SOURCE_UPGRADE_TARGETS.settlement)!;
    const lastCode = await provider.getCode(last.address);
    await provider.send("anvil_setCode", [last.address, "0x"]);
    const send = async () => {
      const hash = await provider.send("eth_sendTransaction", [
        { from: owners[0], to: manifest.authority.address, data, value: "0x0", gas: "0x3d0900" },
      ]);
      return await minedIsolatedReceipt(provider, hash);
    };
    const failed = await send();
    batchCheck(failed.status === 0, "last-call failure must revert the entire Safe execution");
    await assertSourceBatchState(context, port, failed.blockNumber, safe.nonce, false);
    await provider.send("anvil_setCode", [last.address, lastCode]);
    const success = await send();
    batchCheck(success.status === 1, "same-hash atomic retry failed");
    assertSourceBatchSuccess(
      success.logs.map((l) => ({ address: l.address, topics: [...l.topics], data: l.data })),
      batch,
    );
    await assertSourceBatchState(context, port, success.blockNumber, safe.nonce + 1, true);
    batchCheck(releaseRevision(CONTRACTS_ROOT, pinsPath) === toolingRevision, "Safe pins changed during rehearsal");
    return {
      schemaVersion: 1,
      planHash: voucherDigest(plan),
      sourceCommit: plan.sourceCommit,
      toolingRevision,
      runtimeBindingHash: runtime.bindingHash,
      forkBlock: fork.forkBlock,
      forkBlockHash: fork.forkBlockHash,
      multiSend: SOURCE_MULTISEND,
      safeTransactionHash: batch.safeTransactionHash,
      safeNonceBefore: safe.nonce,
      safeNonceAfter: safe.nonce + 1,
      deployments,
      failedTransactionHash: failed.hash,
      transactionHash: success.hash,
      atomicFailureRollback: true,
      retrySucceeded: true,
      liveBroadcast: false,
      activationIncluded: false,
      proofClass:
        "owned fork; exact atomic MultiSendCallOnly; two original-owner approveHash calls and prevalidated signatures on fork only; no real owner signature or live broadcast",
    };
  } finally {
    provider.destroy();
    await fork.stop();
  }
}
