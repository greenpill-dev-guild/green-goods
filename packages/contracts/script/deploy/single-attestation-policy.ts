#!/usr/bin/env bun
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as dotenv from "dotenv";
import { JsonRpcProvider, keccak256 } from "ethers";
import { formatCastFailure } from "../utils/cast-env";
import { redactRpcUrlsInText } from "../utils/cli-parser";
import { CHAIN_ID_MAP, NetworkManager } from "../utils/network";
import { assertSepoliaGate } from "../utils/release-gate";
import {
  assertPolicyChain,
  assertPolicyPlan,
  policyBytecode,
  policyDeploymentPlan,
  verifyPolicyDeployment,
  type PolicyDeploymentArtifact,
  type PolicyDeploymentPlan,
} from "../utils/single-attestation-deployment";
import {
  assertPolicySourcesCommitted,
  beginPolicyBroadcast,
  parsePolicyOptions,
  policyForgeCommand,
  policyPaths,
  policyReceiptHash,
  policySourceCommand,
  readPolicyJson,
  recordPolicyDeployment,
  redactExplorerKey,
  writePolicyJson,
  type PolicyBroadcastJournal,
} from "../utils/single-attestation-operation";

const ROOT = path.resolve(import.meta.dir, "../..");
const ARTIFACT = path.join(
  ROOT,
  ".generated/foundry/out/production/SingleAttestationPolicy.sol/SingleAttestationPolicy.json",
);

function productionBytecode() {
  try {
    execFileSync("bun", ["run", "check:foundry-version"], { cwd: ROOT, stdio: "pipe" });
    execFileSync("bun", ["run", "build", "--mode", "target", "--", "script/DeploySingleAttestationPolicy.s.sol"], {
      cwd: ROOT,
      stdio: "pipe",
      env: { ...process.env, FOUNDRY_PROFILE: "production" },
    });
    return policyBytecode(readPolicyJson(ROOT, ARTIFACT));
  } catch (error) {
    throw formatCastFailure(error, "Policy production compilation");
  }
}

function runForge(plan: PolicyDeploymentPlan, rpc: string, broadcast: boolean): void {
  const command = policyForgeCommand(plan, rpc, broadcast);
  try {
    execFileSync("forge", command.args, {
      cwd: ROOT,
      env: command.env,
      stdio: [broadcast ? "inherit" : "ignore", "pipe", "pipe"],
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (error) {
    throw formatCastFailure(
      error,
      broadcast ? "Policy broadcast (outcome may be unknown; verify before retry)" : "Policy RPC simulation",
    );
  }
}

/**
 * Submit the source of a deployment this run has just verified to the network's explorer. The
 * local production build is known to equal the live code at that point, so the explorer receives
 * the source that produced it. No signer is involved and no transaction is sent.
 */
function publishPolicySource(network: string, deployment: PolicyDeploymentArtifact): void {
  const verifier = new NetworkManager().getVerifierConfig(network);
  const key = verifier?.apiKey;
  if (!verifier || !key) throw new Error("Source publication needs ETHERSCAN_API_KEY from the root .env");
  const command = policySourceCommand(deployment, verifier.apiUrl);
  let output: string;
  try {
    output = execFileSync("forge", command.args, {
      cwd: ROOT,
      env: command.env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 16 * 1024 * 1024,
      timeout: 300_000,
    });
  } catch (error) {
    throw new Error(redactExplorerKey(formatCastFailure(error, "Policy source publication").message, key));
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

async function main(): Promise<void> {
  const options = parsePolicyOptions(process.argv.slice(2));
  const paths = policyPaths(ROOT, options.network, options.planPath);
  const chainId = Number(CHAIN_ID_MAP[options.network]);
  const bytecode = productionBytecode();
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  if (options.mode === "preflight") {
    console.log(
      JSON.stringify(
        {
          state: "preflight",
          network: options.network,
          chainId,
          creationCodeHash: keccak256(bytecode.creationCode),
          runtimeCodeHash: keccak256(bytecode.runtimeCode),
          runtimeBytes: (bytecode.runtimeCode.length - 2) / 2,
          authorityEnabled: false,
        },
        null,
        2,
      ),
    );
    return;
  }
  dotenv.config({ path: path.resolve(ROOT, "../../.env"), quiet: true });
  const rpc = new NetworkManager().getRpcUrl(options.network);
  const provider = new JsonRpcProvider(rpc);
  try {
    if (options.command === "verify") {
      if (fs.existsSync(paths.artifact)) {
        const artifact = readPolicyJson<PolicyDeploymentArtifact>(ROOT, paths.artifact);
        if (
          artifact.schemaVersion !== 1 ||
          artifact.kind !== "SINGLE_ATTESTATION_POLICY_DEPLOYMENT" ||
          artifact.network !== options.network ||
          artifact.chainId !== chainId ||
          (options.receipt && options.receipt !== artifact.transactionHash)
        )
          throw new Error("Stored policy deployment is incompatible with the requested verification");
        const plan = policyDeploymentPlan({
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
          throw new Error("Stored policy pin differs from the production artifact");
        const verified = await verifyPolicyDeployment(provider, plan, artifact.transactionHash);
        if (verified.blockHash !== artifact.blockHash || verified.blockNumber !== artifact.blockNumber)
          throw new Error("Policy deployment receipt no longer matches its recorded block");
        console.log(JSON.stringify({ state: "verified", ...verified, authorityEnabled: false }, null, 2));
        if (options.publishSource) publishPolicySource(options.network, verified);
        return;
      }
      const journal = readPolicyJson<PolicyBroadcastJournal>(ROOT, paths.journal);
      if (
        journal.schemaVersion !== 1 ||
        journal.kind !== "SINGLE_ATTESTATION_POLICY_BROADCAST" ||
        journal.state !== "pending"
      )
        throw new Error("No pending policy broadcast to reconcile");
      // Reconciliation is bound to the pending reviewed commit, even when unrelated work has advanced HEAD.
      assertPolicyPlan(journal.plan, { network: options.network, chainId, commit: journal.plan.commit, bytecode });
      const hash = options.receipt ?? policyReceiptHash(readPolicyJson(ROOT, paths.foundry), journal.plan);
      const verified = await verifyPolicyDeployment(provider, journal.plan, hash);
      recordPolicyDeployment(ROOT, paths, journal.plan, verified);
      console.log(JSON.stringify({ state: "reconciled", ...verified, authorityEnabled: false }, null, 2));
      if (options.publishSource) publishPolicySource(options.network, verified);
      return;
    }
    if (options.mode === "plan") {
      if (fs.existsSync(paths.journal) || fs.existsSync(paths.artifact))
        throw new Error("Policy broadcast evidence already exists; verify it before planning another deployment");
      const plan = policyDeploymentPlan({
        ...bytecode,
        network: options.network,
        chainId,
        sender: options.sender!,
        nonce: options.nonce!,
        commit,
      });
      const funding = await assertPolicyChain(provider, plan);
      writePolicyJson(ROOT, paths.plan, plan);
      console.log(
        JSON.stringify(
          {
            state: "planned",
            plan: path.relative(ROOT, paths.plan),
            address: plan.address,
            deployer: plan.deployer,
            nonce: plan.nonce,
            runtimeCodeHash: plan.runtimeCodeHash,
            ...funding,
            authorityEnabled: false,
          },
          null,
          2,
        ),
      );
      return;
    }
    const plan = readPolicyJson<PolicyDeploymentPlan>(ROOT, paths.plan);
    assertPolicyPlan(plan, { network: options.network, chainId, commit, bytecode, nonce: options.nonce });
    const funding = await assertPolicyChain(provider, plan);
    if (options.mode === "simulate") {
      runForge(plan, rpc, false);
      console.log(
        JSON.stringify(
          {
            state: "simulated",
            address: plan.address,
            runtimeCodeHash: plan.runtimeCodeHash,
            ...funding,
            authorityEnabled: false,
          },
          null,
          2,
        ),
      );
      return;
    }
    assertSepoliaGate({ network: options.network, broadcast: true });
    assertPolicySourcesCommitted(ROOT);
    beginPolicyBroadcast(ROOT, paths, plan);
    // A pending record survives failures or cancellation; the only retry path verifies a mined receipt.
    await assertPolicyChain(provider, plan);
    runForge(plan, rpc, true);
    const hash = policyReceiptHash(readPolicyJson(ROOT, paths.foundry), plan);
    const verified = await verifyPolicyDeployment(provider, plan, hash);
    recordPolicyDeployment(ROOT, paths, plan, verified);
    console.log(JSON.stringify({ state: "deployed", ...verified, authorityEnabled: false }, null, 2));
  } finally {
    provider.destroy();
  }
}

if (import.meta.main)
  main().catch((error) => {
    console.error(redactRpcUrlsInText(error instanceof Error ? error.message : "Policy operation failed"));
    process.exitCode = 1;
  });
