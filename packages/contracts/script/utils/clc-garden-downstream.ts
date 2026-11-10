import fs from "node:fs";
import path from "node:path";
import { JsonRpcProvider } from "ethers";
import { type CLCGardenPlan, inspectCLCGardenManifest, validateCLCGardenPlan } from "./clc-garden-release";
import { simulateCLCGardenPlan } from "./clc-garden-simulation";
import {
  gardenExecutionJournal,
  validateGardenExecutionJournal,
  recoverGardenExecutionJournal,
  executeGardenDeployment,
  GARDEN_MAX_FEE,
  GARDEN_PRIORITY_FEE,
} from "./clc-garden-execution";
import { withKeystorePassword } from "./keystore-session";
import { execCastCaptured, parseCastTransactionHash } from "./cast-env";
import { NetworkManager } from "./network";
import { CONFIG_ROOT, CONTRACTS_ROOT } from "./paths";
import { releaseJsonPath, releaseRevision } from "./release-inputs";
import { writeReleaseJsonAtomic } from "./release-artifacts";
import { voucherDigest } from "./voucher-release";

export interface GardenDownstreamOptions {
  manifest?: string;
  plan?: string;
  receipts?: string;
  broadcast?: boolean;
  verify?: boolean;
  "recover-lock"?: boolean;
}
/** Refuse a fork endpoint when publishing live deployment pins. Simulations use their own loopback process. */
export async function assertGardenLiveRpc(provider: JsonRpcProvider, rpc: string) {
  const url = new URL(rpc);
  if (!["https:", "http:"].includes(url.protocol) || /^(localhost|127\.|0\.0\.0\.0$|\[::1\]$)/i.test(url.hostname))
    throw new Error("Live garden receipts require a non-loopback Gnosis RPC");
  if ((await provider.getNetwork()).chainId !== 100n) throw new Error("Garden downstream requires Gnosis chain 100");
  let fork = false;
  for (const method of ["anvil_nodeInfo", "hardhat_metadata"]) {
    try {
      await provider.send(method, []);
      fork = true;
    } catch {
      /* Production nodes do not expose local-fork methods. */
    }
  }
  if (fork) throw new Error("Fork evidence cannot publish live garden registrations");
}
export async function runGardenDownstream(options: GardenDownstreamOptions) {
  if (!options.manifest || !options.plan || (options.broadcast && options.verify))
    throw new Error("Garden downstream requires one mode and its manifest and plan");
  if (options["recover-lock"] && !options.verify) throw new Error("Garden lock recovery requires verify mode");
  const directory = path.join(CONTRACTS_ROOT, ".generated/clc-release");
  const manifestPath = releaseJsonPath(CONFIG_ROOT, options.manifest);
  const planPath = releaseJsonPath(directory, options.plan);
  const receiptPath = options.receipts ? releaseJsonPath(directory, options.receipts) : null;
  const read = (file: string): unknown => JSON.parse(fs.readFileSync(file, "utf8"));
  const revision = releaseRevision(CONTRACTS_ROOT, manifestPath);
  const manifest = inspectCLCGardenManifest(read(manifestPath)).manifest;
  const plan: unknown = read(planPath);
  validateCLCGardenPlan(plan, manifest, revision);
  const assertBindings = () => {
    if (
      releaseRevision(CONTRACTS_ROOT, manifestPath) !== revision ||
      voucherDigest(read(manifestPath)) !== voucherDigest(manifest) ||
      voucherDigest(read(planPath)) !== voucherDigest(plan)
    )
      throw new Error("Garden downstream inputs changed during execution");
  };
  const output = (file: string, owner = directory) => {
    const resolved = releaseJsonPath(owner, path.relative(CONTRACTS_ROOT, file));
    if ([manifestPath, planPath, receiptPath].includes(resolved))
      throw new Error("Garden output cannot overwrite input");
    return resolved;
  };
  const journalPath = output(path.join(directory, `${plan.releaseId}.execution.json`));
  const simulationPath = output(path.join(directory, `${plan.releaseId}.downstream-simulation.json`));
  const readbackPath = output(path.join(directory, `${plan.releaseId}.readback.json`));
  const registrationPath = output(path.join(directory, `${plan.releaseId}.registration.json`));
  const artifactPath = output(
    path.join(CONTRACTS_ROOT, "deployments/100-garden-exchanges.json"),
    path.join(CONTRACTS_ROOT, "deployments"),
  );
  const rpc = new NetworkManager().getRpcUrl("gnosis");
  if (!options.broadcast && !options.verify) {
    const result = await simulateCLCGardenPlan(plan, manifest, rpc, receiptPath ? read(receiptPath) : undefined);
    assertBindings();
    writeReleaseJsonAtomic(simulationPath, result);
    console.log("Garden deployment rehearsed on an isolated fork; no live registration or broadcast.");
    return;
  }
  const provider = new JsonRpcProvider(rpc, undefined, { cacheTimeout: -1, batchStallTime: 0 });
  let lock: number | undefined;
  const lockPath = `${journalPath}.lock`;
  try {
    await assertGardenLiveRpc(provider, rpc);
    fs.mkdirSync(directory, { recursive: true });
    if (options["recover-lock"] && fs.existsSync(lockPath)) {
      const stale = JSON.parse(fs.readFileSync(lockPath, "utf8")) as { pid: number; planHash: string };
      if (!Number.isSafeInteger(stale.pid) || stale.pid <= 0 || stale.planHash !== voucherDigest(plan))
        throw new Error("Unbound garden execution lock");
      let absent = false;
      try {
        process.kill(stale.pid, 0);
      } catch (error) {
        absent = (error as NodeJS.ErrnoException).code === "ESRCH";
      }
      if (!absent) throw new Error("Garden execution lock may still have a live owner");
      fs.unlinkSync(lockPath);
    }
    lock = fs.openSync(lockPath, "wx", 0o600);
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, planHash: voucherDigest(plan) }));
    const journal: unknown = fs.existsSync(journalPath) ? read(journalPath) : gardenExecutionJournal(plan);
    validateGardenExecutionJournal(journal, plan);
    const save = () => writeReleaseJsonAtomic(journalPath, journal);
    // Recover an ambiguous send only from a submitted hash or an explicitly supplied canonical receipt.
    const recovered = await recoverGardenExecutionJournal(
      provider,
      plan,
      journal,
      receiptPath ? read(receiptPath) : undefined,
    );
    Object.assign(journal, recovered);
    save();
    let gasLimits: Record<string, string> = {};
    if (options.broadcast && Object.keys(journal.transactions).length < plan.transactions.length) {
      const simulation = await simulateCLCGardenPlan(plan, manifest, rpc, { transactions: journal.transactions });
      gasLimits = Object.fromEntries(
        simulation.receipts.filter((row) => row.gasLimit).map((row) => [row.component, row.gasLimit!]),
      );
      assertBindings();
    }
    const finish = async (send?: Parameters<typeof executeGardenDeployment>[0]["send"]) =>
      executeGardenDeployment({ provider, plan, manifest, revision, journal, save, assertBindings, gasLimits, send });
    // The deployment record leaves the unlock session through `result`, never as the session's
    // return value. CodeQL's password heuristic reads whatever `withKeystorePassword` returns as
    // secret material, so a record returned this way would be flagged when it is digested below.
    let result: Awaited<ReturnType<typeof finish>> | undefined;
    if (options.broadcast && Object.keys(journal.transactions).length < plan.transactions.length) {
      await withKeystorePassword(async (env, signal) => {
        const account = "green-goods-deployer";
        const signer = execCastCaptured(
          ["wallet", "address", "--account", account],
          { cwd: CONTRACTS_ROOT, env },
          "Garden deployer unlock",
        ).trim();
        if (signer.toLowerCase() !== plan.transactions[0].from.toLowerCase())
          throw new Error("Garden deployment signer differs from reviewed plan");
        result = await finish(async (tx: CLCGardenPlan["transactions"][number], gasLimit: bigint) => {
          signal.throwIfAborted();
          assertBindings();
          return parseCastTransactionHash(
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
                String(gasLimit),
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
              "Garden pool deployment",
            ),
            "Garden pool deployment",
          );
        });
      });
    } else result = await finish();
    if (!result) throw new Error("Garden deployment finished without a result");
    assertBindings();
    persistGardenDeploymentEvidence(artifactPath, readbackPath, result);
    const artifact = result.deployment;
    writeReleaseJsonAtomic(registrationPath, {
      evidence: "canonical-live",
      deploymentArtifact: "deployments/100-garden-exchanges.json",
      planHash: artifact.planHash,
      indexer: artifact.indexerRegistration,
      application: artifact.appRegistration,
    });
    console.log(
      "Garden pool live receipts and initialization verified; deployment and registration artifacts saved. Owner activation remains pending.",
    );
  } finally {
    provider.destroy();
    if (lock !== undefined) {
      fs.closeSync(lock);
      fs.unlinkSync(lockPath);
    }
  }
}

/** Immutable deployment identities are kept separate from changing live balances and authority observations. */
export function persistGardenDeploymentEvidence(
  artifactPath: string,
  readbackPath: string,
  result: { deployment: Awaited<ReturnType<typeof executeGardenDeployment>>["deployment"]; readback: unknown },
) {
  if (fs.existsSync(artifactPath)) {
    if (voucherDigest(JSON.parse(fs.readFileSync(artifactPath, "utf8"))) !== voucherDigest(result.deployment))
      throw new Error("Existing garden deployment identity differs; retain journal and review before promotion");
  } else writeReleaseJsonAtomic(artifactPath, result.deployment);
  writeReleaseJsonAtomic(readbackPath, result.readback);
}
