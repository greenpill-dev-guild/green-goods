import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as dotenv from "dotenv";
import { JsonRpcProvider, keccak256 } from "ethers";
import { formatCastFailure } from "./cast-env";
import { redactRpcUrlsInText } from "./cli-parser";
import { CHAIN_ID_MAP, NetworkManager } from "./network";
import { assertSepoliaGate } from "./release-gate";
import {
  assertStandaloneChain,
  assertStandalonePlan,
  capitalized,
  contractName,
  standaloneBytecode,
  standaloneDeploymentPlan,
  verifyStandaloneDeployment,
  type StandaloneContract,
  type StandaloneDeploymentArtifact,
  type StandaloneDeploymentPlan,
} from "./standalone-deployment";
import {
  assertStandaloneSourcesCommitted,
  beginStandaloneBroadcast,
  parseStandaloneOptions,
  promoteStandaloneDeployment,
  readStandaloneJson,
  recordStandaloneDeployment,
  redactExplorerKey,
  standaloneForgeCommand,
  standalonePaths,
  standaloneReceiptHash,
  standaloneSourceCommand,
  writeStandaloneJson,
  type StandaloneBroadcastJournal,
} from "./standalone-operation";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function productionArtifact(contract: StandaloneContract): string {
  const source = contract.target.slice(0, contract.target.indexOf(":"));
  return path.join(ROOT, ".generated/foundry/out/production", path.basename(source), `${contractName(contract)}.json`);
}

function productionBytecode(contract: StandaloneContract) {
  try {
    execFileSync("bun", ["run", "check:foundry-version"], { cwd: ROOT, stdio: "pipe" });
    execFileSync("bun", ["run", "build", "--mode", "target", "--", `script/${contract.script}.s.sol`], {
      cwd: ROOT,
      stdio: "pipe",
      env: { ...process.env, FOUNDRY_PROFILE: "production" },
    });
    return standaloneBytecode(contract, readStandaloneJson(ROOT, productionArtifact(contract), contract.noun));
  } catch (error) {
    throw formatCastFailure(error, `${capitalized(contract.noun)} production compilation`);
  }
}

function runForge(contract: StandaloneContract, plan: StandaloneDeploymentPlan, rpc: string, broadcast: boolean): void {
  const command = standaloneForgeCommand(contract, plan, rpc, broadcast);
  try {
    execFileSync(command.command, command.args, {
      cwd: ROOT,
      env: command.env,
      stdio: [broadcast ? "inherit" : "ignore", "pipe", "pipe"],
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (error) {
    const Noun = capitalized(contract.noun);
    throw formatCastFailure(
      error,
      broadcast ? `${Noun} broadcast (outcome may be unknown; verify before retry)` : `${Noun} RPC simulation`,
    );
  }
}

/**
 * Submit the source of a deployment this run has just verified to the network's explorer. The
 * local production build is known to equal the live code at that point, so the explorer receives
 * the source that produced it. No signer is involved and no transaction is sent.
 */
function publishSource(contract: StandaloneContract, network: string, deployment: StandaloneDeploymentArtifact): void {
  const verifier = new NetworkManager().getVerifierConfig(network);
  const key = verifier?.apiKey;
  if (!verifier || !key) throw new Error("Source publication needs ETHERSCAN_API_KEY from the root .env");
  const command = standaloneSourceCommand(contract, deployment, verifier.apiUrl);
  let output: string;
  try {
    output = execFileSync(command.command, command.args, {
      cwd: ROOT,
      env: command.env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 16 * 1024 * 1024,
      timeout: 300_000,
    });
  } catch (error) {
    throw new Error(
      redactExplorerKey(formatCastFailure(error, `${capitalized(contract.noun)} source publication`).message, key),
    );
  }
  const lines = redactExplorerKey(output, key)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  console.log(
    JSON.stringify(
      { state: "source_published", address: deployment.address, chainId: deployment.chainId, detail: lines.at(-1) },
      null,
      2,
    ),
  );
}

function report(value: Record<string, unknown>): void {
  console.log(JSON.stringify(value, null, 2));
}

async function main(contract: StandaloneContract, argv: string[]): Promise<void> {
  const noun = contract.noun;
  const Noun = capitalized(noun);
  const options = parseStandaloneOptions(contract, argv);
  const paths = standalonePaths(contract, ROOT, options.network, options.planPath);
  const chainId = Number(CHAIN_ID_MAP[options.network]);
  const bytecode = productionBytecode(contract);
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  if (options.mode === "preflight") {
    report({
      state: "preflight",
      network: options.network,
      chainId,
      creationCodeHash: keccak256(bytecode.creationCode),
      runtimeCodeHash: keccak256(bytecode.runtimeCode),
      runtimeBytes: (bytecode.runtimeCode.length - 2) / 2,
      authorityEnabled: false,
    });
    return;
  }
  dotenv.config({ path: path.resolve(ROOT, "../../.env"), quiet: true });
  const rpc = new NetworkManager().getRpcUrl(options.network);
  const provider = new JsonRpcProvider(rpc);
  try {
    if (options.command === "verify") {
      if (fs.existsSync(paths.artifact)) {
        const artifact = readStandaloneJson<StandaloneDeploymentArtifact>(ROOT, paths.artifact, noun);
        if (
          artifact.schemaVersion !== 1 ||
          artifact.kind !== `${contract.id}_DEPLOYMENT` ||
          artifact.network !== options.network ||
          artifact.chainId !== chainId ||
          (options.receipt && options.receipt !== artifact.transactionHash)
        )
          throw new Error(`Stored ${noun} deployment is incompatible with the requested verification`);
        const plan = standaloneDeploymentPlan(contract, {
          ...bytecode,
          network: options.network,
          chainId,
          sender: artifact.deployer,
          nonce: artifact.nonce,
          commit: artifact.commit,
        });
        if (
          artifact.address !== plan.address ||
          artifact.creationCodeHash !== plan.creationCodeHash ||
          artifact.runtimeCodeHash !== plan.runtimeCodeHash
        )
          throw new Error(`Stored ${noun} pin differs from the production artifact`);
        const verified = await verifyStandaloneDeployment(contract, provider, plan, artifact.transactionHash);
        if (verified.blockHash !== artifact.blockHash || verified.blockNumber !== artifact.blockNumber)
          throw new Error(`${Noun} deployment receipt no longer matches its recorded block`);
        const latest = promoteStandaloneDeployment(contract, ROOT, paths, verified);
        report({ state: "verified", ...verified, authorityEnabled: false, latest });
        if (options.publishSource) publishSource(contract, options.network, verified);
        return;
      }
      const journal = readStandaloneJson<StandaloneBroadcastJournal>(ROOT, paths.journal, noun);
      if (journal.schemaVersion !== 1 || journal.kind !== `${contract.id}_BROADCAST` || journal.state !== "pending")
        throw new Error(`No pending ${noun} broadcast to reconcile`);
      // Reconciliation is bound to the pending reviewed commit, even when unrelated work has advanced HEAD.
      assertStandalonePlan(contract, journal.plan, {
        network: options.network,
        chainId,
        commit: journal.plan.commit,
        bytecode,
      });
      const hash =
        options.receipt ?? standaloneReceiptHash(contract, readStandaloneJson(ROOT, paths.foundry, noun), journal.plan);
      const verified = await verifyStandaloneDeployment(contract, provider, journal.plan, hash);
      const latest = recordStandaloneDeployment(contract, ROOT, paths, journal.plan, verified);
      report({ state: "reconciled", ...verified, authorityEnabled: false, latest });
      if (options.publishSource) publishSource(contract, options.network, verified);
      return;
    }
    if (options.mode === "plan") {
      if (fs.existsSync(paths.journal) || fs.existsSync(paths.artifact))
        throw new Error(`${Noun} broadcast evidence already exists; verify it before planning another deployment`);
      const plan = standaloneDeploymentPlan(contract, {
        ...bytecode,
        network: options.network,
        chainId,
        sender: options.sender!,
        nonce: options.nonce!,
        commit,
      });
      const funding = await assertStandaloneChain(contract, provider, plan);
      writeStandaloneJson(ROOT, paths.plan, plan, noun);
      report({
        state: "planned",
        plan: path.relative(ROOT, paths.plan),
        address: plan.address,
        deployer: plan.deployer,
        nonce: plan.nonce,
        runtimeCodeHash: plan.runtimeCodeHash,
        ...funding,
        authorityEnabled: false,
      });
      return;
    }
    const plan = readStandaloneJson<StandaloneDeploymentPlan>(ROOT, paths.plan, noun);
    assertStandalonePlan(contract, plan, { network: options.network, chainId, commit, bytecode, nonce: options.nonce });
    const funding = await assertStandaloneChain(contract, provider, plan);
    if (options.mode === "simulate") {
      runForge(contract, plan, rpc, false);
      report({
        state: "simulated",
        address: plan.address,
        runtimeCodeHash: plan.runtimeCodeHash,
        ...funding,
        authorityEnabled: false,
      });
      return;
    }
    assertSepoliaGate({ network: options.network, broadcast: true });
    assertStandaloneSourcesCommitted(contract, ROOT);
    beginStandaloneBroadcast(contract, ROOT, paths, plan);
    // A pending record survives failures or cancellation; the only retry path verifies a mined receipt.
    await assertStandaloneChain(contract, provider, plan);
    runForge(contract, plan, rpc, true);
    const hash = standaloneReceiptHash(contract, readStandaloneJson(ROOT, paths.foundry, noun), plan);
    const verified = await verifyStandaloneDeployment(contract, provider, plan, hash);
    const latest = recordStandaloneDeployment(contract, ROOT, paths, plan, verified);
    report({ state: "deployed", ...verified, authorityEnabled: false, latest });
  } finally {
    provider.destroy();
  }
}

/**
 * Run one standalone contract's deploy or verify operation: offline preflight, a pinned plan, a
 * signer-free RPC simulation, a journaled broadcast, and exact receipt and runtime verification.
 */
export function runStandaloneContract(contract: StandaloneContract, argv: string[]): void {
  main(contract, argv).catch((error) => {
    console.error(
      redactRpcUrlsInText(error instanceof Error ? error.message : `${capitalized(contract.noun)} operation failed`),
    );
    process.exitCode = 1;
  });
}
