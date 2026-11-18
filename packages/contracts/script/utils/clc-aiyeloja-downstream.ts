import fs from "node:fs";
import path from "node:path";
import { JsonRpcProvider, Contract, ZeroAddress } from "ethers";
import { type GardenDownstreamOptions, assertGardenLiveRpc } from "./clc-garden-downstream";
import {
  type CLCAiyelojaPlan,
  inspectCLCAiyelojaManifest,
  validateCLCAiyelojaPlan,
  aiyelojaSafeUpload,
} from "./clc-aiyeloja-release";
import {
  verifyAiyelojaDependencies,
  verifyAiyelojaAuthority,
  verifyAiyelojaDeployment,
  aiyelojaProductionSnapshot,
  aiyelojaEqual as equal,
} from "./clc-aiyeloja-readback";
import { simulateCLCAiyelojaPlan } from "./clc-aiyeloja-simulation";
import {
  gardenExecutionJournal,
  validateGardenExecutionJournal,
  recoverGardenExecutionJournal,
  verifyGardenExecutionReceipts,
  GARDEN_MAX_FEE,
  GARDEN_PRIORITY_FEE,
} from "./clc-garden-execution";
import { CLC_DEPENDENCIES, CLC_FACTORY_ABI } from "./clc-release";
import { CONFIG_ROOT, CONTRACTS_ROOT } from "./paths";
import { releaseJsonPath, releaseRevision } from "./release-inputs";
import { writeReleaseJsonAtomic } from "./release-artifacts";
import { NetworkManager } from "./network";
import { withKeystorePassword } from "./keystore-session";
import { execCastCaptured, parseCastTransactionHash } from "./cast-env";
import { voucherDigest } from "./voucher-release";

const NATIVE_BUDGET = 10_000_000_000_000_000n; // 0.01 xDAI; deployment only, no value transfers.
export function aiyelojaGasEnvelope(evidence: unknown, plan: CLCAiyelojaPlan): Record<string, bigint> {
  const e = evidence as Awaited<ReturnType<typeof simulateCLCAiyelojaPlan>>;
  if (
    !e ||
    e.kind !== "AIYELOJA_TEST_POOL_REHEARSAL" ||
    e.evidence !== "isolated-fork" ||
    e.liveBroadcast !== false ||
    e.planHash !== voucherDigest(plan) ||
    e.chainId !== 100 ||
    !Number.isSafeInteger(e.forkBlock) ||
    !/^0x[0-9a-f]{64}$/.test(e.forkBlockHash) ||
    e.deployments.length !== plan.transactions.length ||
    e.batches.length !== plan.batches.length ||
    e.swaps.length !== 2 ||
    e.unauthorizedDirectMintRejected !== true ||
    e.rejectedPrematureFunding.status !== 0 ||
    e.rejectedHoldingCap.status !== 0 ||
    e.unauthorizedProxyAdminRejected !== true
  )
    throw new Error("Complete exact-plan Aiyeloja fork evidence required before deployment");
  const result: Record<string, bigint> = {};
  for (const [i, tx] of plan.transactions.entries()) {
    const row = e.deployments[i];
    if (row.component !== tx.component || row.address !== tx.address || !/^[1-9][0-9]*$/.test(row.gasLimit))
      throw new Error("Invalid rehearsed deployment gas binding");
    result[tx.component] = BigInt(row.gasLimit);
  }
  if (Object.values(result).reduce((sum, gas) => sum + gas * GARDEN_MAX_FEE, 0n) > NATIVE_BUDGET)
    throw new Error("Aiyeloja deployment exceeds 0.01 xDAI cap");
  return result;
}
/** All live writes are exact factory calls. Owner activation remains in separately reviewed Safe uploads. */
export async function runCLCAiyelojaDownstream(options: GardenDownstreamOptions) {
  if (!options.manifest || !options.plan || (options.broadcast && options.verify))
    throw new Error("Aiyeloja requires manifest, plan and one mode");
  if (options["recover-lock"] && !options.verify) throw new Error("Lock recovery requires verify mode");
  const directory = path.join(CONTRACTS_ROOT, ".generated/clc-release"),
    read = (file: string): unknown => JSON.parse(fs.readFileSync(file, "utf8"));
  const manifestPath = releaseJsonPath(CONFIG_ROOT, options.manifest),
    planPath = releaseJsonPath(directory, options.plan);
  const manifest = inspectCLCAiyelojaManifest(read(manifestPath)),
    revision = releaseRevision(CONTRACTS_ROOT, manifestPath);
  const plan: unknown = read(planPath);
  validateCLCAiyelojaPlan(plan, manifest, revision);
  const bound = plan as CLCAiyelojaPlan;
  const output = (suffix: string) =>
    releaseJsonPath(directory, `.generated/clc-release/${bound.releaseId}.${suffix}.json`);
  const receiptPath = options.receipts ? releaseJsonPath(directory, options.receipts) : null;
  const outputs = [
    output("execution"),
    output("simulation"),
    output("deployment"),
    output("readback"),
    ...bound.batches.map((b) => output(b.name)),
  ];
  if (outputs.some((file) => [manifestPath, planPath, receiptPath].includes(file)))
    throw new Error("Aiyeloja output cannot overwrite its inputs");
  const assertBindings = () => {
    equal(releaseRevision(CONTRACTS_ROOT, manifestPath), revision, "committed source binding");
    equal(voucherDigest(read(manifestPath)), voucherDigest(manifest), "manifest binding");
    equal(voucherDigest(read(planPath)), voucherDigest(bound), "plan binding");
  };
  const rpc = new NetworkManager().getRpcUrl("gnosis");
  if (!options.broadcast && !options.verify) {
    const evidence = await simulateCLCAiyelojaPlan(bound, manifest, rpc, receiptPath ? read(receiptPath) : undefined);
    assertBindings();
    writeReleaseJsonAtomic(output("simulation"), evidence);
    for (const batch of bound.batches) writeReleaseJsonAtomic(output(batch.name), aiyelojaSafeUpload(batch));
    console.log("Aiyeloja deployment and all three Safe batches rehearsed; no live broadcast or app activation.");
    return;
  }
  const provider = new JsonRpcProvider(rpc, undefined, { cacheTimeout: -1, batchStallTime: 0 });
  const journalPath = output("execution"),
    lockPath = `${journalPath}.lock`;
  let lock: number | undefined;
  try {
    await assertGardenLiveRpc(provider, rpc);
    await verifyAiyelojaDependencies(provider);
    fs.mkdirSync(directory, { recursive: true });
    if (options["recover-lock"] && fs.existsSync(lockPath)) {
      const stale = JSON.parse(fs.readFileSync(lockPath, "utf8"));
      if (!Number.isSafeInteger(stale.pid) || stale.pid < 1 || stale.planHash !== voucherDigest(bound))
        throw new Error("Unbound execution lock");
      let absent = false;
      try {
        process.kill(stale.pid, 0);
      } catch (e) {
        absent = (e as NodeJS.ErrnoException).code === "ESRCH";
      }
      if (!absent) throw new Error("Execution lock owner may still be live");
      fs.unlinkSync(lockPath);
    }
    lock = fs.openSync(lockPath, "wx", 0o600);
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, planHash: voucherDigest(bound) }));
    const value: unknown = fs.existsSync(journalPath) ? read(journalPath) : gardenExecutionJournal(bound);
    validateGardenExecutionJournal(value, bound);
    const journal = value,
      save = () => writeReleaseJsonAtomic(journalPath, journal);
    Object.assign(
      journal,
      await recoverGardenExecutionJournal(provider, bound, journal, receiptPath ? read(receiptPath) : undefined),
    );
    save(); // Also proves durable write access before asking for a password.
    const evidencePath = output("simulation"),
      evidence = read(evidencePath),
      gas = aiyelojaGasEnvelope(evidence, bound);
    const evidenceHash = voucherDigest(evidence);
    const assertAllBindings = () => {
      assertBindings();
      equal(voucherDigest(read(evidencePath)), evidenceHash, "rehearsal binding");
    };
    const e = evidence as Awaited<ReturnType<typeof simulateCLCAiyelojaPlan>>;
    equal((await provider.getBlock(e.forkBlock))?.hash, e.forkBlockHash, "canonical proof block");
    let receipts = await verifyGardenExecutionReceipts(provider, bound, journal);
    const remaining = bound.transactions.slice(receipts.length);
    const authority = await verifyAiyelojaAuthority(provider, bound, remaining.length > 0);
    const before = await aiyelojaProductionSnapshot(provider, bound);
    const factory = new Contract(CLC_DEPENDENCIES.factory.address, CLC_FACTORY_ABI, provider);
    const preflight = async () => {
      assertAllBindings();
      const next = bound.transactions[Object.keys(journal.transactions).length];
      if (!next) return;
      for (const tag of ["latest", "pending"])
        equal(await provider.getTransactionCount(next.from, tag), next.nonce, `${tag} deployer nonce`);
      equal(await provider.getCode(next.from), "0x", "dedicated EOA deployer");
      const cost =
        receipts.reduce((sum, row) => sum + BigInt(row.actualCostWei), 0n) +
        bound.transactions.slice(receipts.length).reduce((sum, tx) => sum + gas[tx.component] * GARDEN_MAX_FEE, 0n);
      if (cost > NATIVE_BUDGET || (await provider.getBalance(next.from)) < cost)
        throw new Error("Insufficient xDAI or deployment cap exceeded");
      const fees = await provider.getFeeData();
      if (fees.maxFeePerGas !== null && fees.maxFeePerGas > GARDEN_MAX_FEE)
        throw new Error("Live gas exceeds reviewed 2 gwei fee cap");
      await verifyAiyelojaAuthority(provider, bound, true);
      for (const tx of bound.transactions.slice(receipts.length)) {
        equal(await provider.getCode(tx.address), "0x", "unused CREATE2 address");
        equal(await factory.adminOf(tx.address), ZeroAddress, "unused proxy admin");
        equal(await factory.predictDeterministicAddress(tx.salt), tx.address, "factory prediction");
      }
    };
    await preflight();
    if (remaining.length && !options.broadcast)
      throw new Error("Deployment incomplete; recovered receipts saved without signing");
    if (remaining.length)
      await withKeystorePassword(async (env, signal) => {
        const account = "green-goods-deployer";
        equal(
          execCastCaptured(
            ["wallet", "address", "--account", account],
            { cwd: CONTRACTS_ROOT, env },
            "Aiyeloja unlock",
          ).trim(),
          manifest.deployer,
          "deployer signer",
        );
        for (const tx of remaining) {
          signal.throwIfAborted();
          await preflight();
          const limit = gas[tx.component];
          if (
            (await provider.estimateGas({ from: tx.from, to: tx.to, data: tx.data, value: 0n, nonce: tx.nonce })) >
            limit
          )
            throw new Error("Live gas exceeds rehearsed limit");
          journal.pending = { component: tx.component, nonce: tx.nonce, transactionHash: null };
          save();
          const hash = parseCastTransactionHash(
            execCastCaptured(
              [
                "send",
                "--rpc-url",
                rpc,
                "--account",
                account,
                "--from",
                tx.from,
                "--nonce",
                String(tx.nonce),
                "--gas-limit",
                String(limit),
                "--gas-price",
                String(GARDEN_MAX_FEE),
                "--priority-gas-price",
                String(GARDEN_PRIORITY_FEE),
                "--value",
                "0",
                "--async",
                "--json",
                tx.to,
                tx.data,
              ],
              { cwd: CONTRACTS_ROOT, env },
              "Aiyeloja pool deployment",
            ),
            "Aiyeloja pool deployment",
          );
          journal.pending.transactionHash = hash;
          save();
          const receipt = await provider.waitForTransaction(hash, 1, 180000);
          if (!receipt || receipt.status !== 1)
            throw new Error("Uncertain or failed send; reconcile the pending receipt before any further send");
          const candidate = {
            ...journal,
            transactions: { ...journal.transactions, [tx.component]: hash },
            pending: null,
          };
          receipts = await verifyGardenExecutionReceipts(provider, bound, candidate);
          Object.assign(journal, candidate);
          save();
        }
      });
    assertAllBindings();
    await verifyAiyelojaDeployment(provider, bound, remaining.length > 0);
    equal((await aiyelojaProductionSnapshot(provider, bound)).hash, before.hash, "production state preserved");
    equal(
      voucherDigest(await verifyAiyelojaAuthority(provider, bound)),
      voucherDigest(authority),
      "test Safe policy preserved",
    );
    const observed = await provider.getBlock("latest");
    if (!observed?.hash) throw new Error("Missing canonical readback block");
    writeReleaseJsonAtomic(output("deployment"), {
      schemaVersion: 4,
      kind: "AIYELOJA_TEST_POOL_DEPLOYED",
      evidence: "canonical-live",
      chainId: 100,
      sourceCommit: revision,
      planHash: voucherDigest(bound),
      safe: bound.safe,
      garden: bound.garden,
      addresses: bound.addresses,
      assets: bound.assets,
      receipts,
      observedSafeNonce: authority.nonce,
      ownerActivationVerification: "verify exact Safe receipts and activation state separately",
      appActivationIncluded: false,
    });
    writeReleaseJsonAtomic(output("readback"), {
      blockNumber: observed.number,
      blockHash: observed.hash,
      authority,
      productionSnapshot: before,
    });
    console.log(
      `All factory receipts and Safe custody verified. Observed Safe nonce ${authority.nonce}. Review unexecuted Safe batches in order; do not reupload completed batches. App pins remain deferred.`,
    );
  } finally {
    provider.destroy();
    if (lock !== undefined) {
      fs.closeSync(lock);
      fs.unlinkSync(lockPath);
    }
  }
}
