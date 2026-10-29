#!/usr/bin/env bun
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { Contract, Interface, JsonRpcProvider } from "ethers";
import { validateStewardExecutionMode } from "../cli/operations.mjs";
import { execCastCaptured, parseCastTransactionHash } from "../utils/cast-env";
import { redactRpcUrlsInText } from "../utils/cli-parser";
import { withKeystorePassword } from "../utils/keystore-session";
import { NetworkManager } from "../utils/network";
import { CONTRACTS_ROOT, getFoundryOutDir } from "../utils/paths";
import { writeReleaseJsonAtomic } from "../utils/release-artifacts";
import { releaseJsonPath, releaseRevision } from "../utils/release-inputs";
import {
  positiveStewardUint,
  stewardCreateArgs,
  stewardExecutionStore,
  validateStewardExecution,
  validateStewardReceipt,
  validateStewardRehearsal,
  type StewardExecution,
  type StewardRehearsal,
} from "../utils/steward-safe-execution";
import { checkStewardPeer, readStewardDeployment } from "../utils/steward-safe-readback";
import { readStewardActivation, withStewardActivationRoster } from "../utils/steward-safe-activation";
import {
  inspectStewardManifest,
  loadStewardArtifacts,
  stewardContracts,
  validateStewardPlan,
  type StewardNetwork,
} from "../utils/steward-safe-release";
import { voucherDigest } from "../utils/voucher-release";

const directory = path.join(CONTRACTS_ROOT, ".generated/steward-safe");
async function main() {
  const { values: o } = parseArgs({
    strict: true,
    allowPositionals: false,
    options: Object.fromEntries(
      [
        "mode",
        "manifest",
        "plan",
        "rehearsal",
        "envelope",
        "target-chain",
        "max-fee-wei",
        "max-cost-wei",
        "receipt",
        "output",
        "roster",
      ].map((name) => [name, { type: "string" as const }]),
    ),
  });
  const required = (name: string) => {
    if (!o[name]) throw new Error(`Missing --${name}`);
    return o[name]!;
  };
  validateStewardExecutionMode(o);
  const mode = required("mode");
  const manifestPath = releaseJsonPath(path.join(CONTRACTS_ROOT, "config"), required("manifest"));
  const commit = releaseRevision(CONTRACTS_ROOT, manifestPath);
  const { manifest } = inspectStewardManifest(JSON.parse(readFileSync(manifestPath, "utf8")));
  if (manifest.schemaVersion !== 2) throw new Error("Execution requires the dual-Safe manifest without bootstrap");
  execFileSync("bun", ["run", "check:foundry-version"], { cwd: CONTRACTS_ROOT, stdio: "pipe" });
  execFileSync(
    "bun",
    ["run", "build", "--mode", "target", "--", ...stewardContracts(manifest).map((n) => `src/accounts/${n}.sol`)],
    {
      cwd: CONTRACTS_ROOT,
      env: { ...process.env, FOUNDRY_PROFILE: "production" },
      stdio: "pipe",
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  const artifacts = loadStewardArtifacts(getFoundryOutDir("production"), true);
  const load = (name: string) => JSON.parse(readFileSync(releaseJsonPath(directory, required(name)), "utf8"));
  const plan: unknown = load("plan");
  validateStewardPlan(plan, manifest, artifacts, commit);
  const rehearsal = load("rehearsal") as StewardRehearsal;
  validateStewardRehearsal(plan, rehearsal);
  const activationManifest = o.roster ? withStewardActivationRoster(manifest, load("roster")) : manifest;
  const unchanged = () => {
    if (releaseRevision(CONTRACTS_ROOT, manifestPath) !== commit) throw new Error("Steward release revision changed");
    validateStewardPlan(
      plan,
      JSON.parse(readFileSync(manifestPath, "utf8")),
      loadStewardArtifacts(getFoundryOutDir("production"), true),
      commit,
    );
  };
  unchanged();
  const output = () => {
    const result = releaseJsonPath(directory, required("output"));
    if (
      path.basename(result).startsWith("create-") ||
      ["plan", "rehearsal", "envelope", "roster"].some(
        (key) => o[key] && result === releaseJsonPath(directory, o[key]!),
      )
    )
      throw new Error("Output cannot overwrite reviewed inputs or journals");
    return result;
  };
  if (mode === "verify") {
    const providers = {
      arbitrum: new JsonRpcProvider(new NetworkManager().getRpcUrl("arbitrum"), undefined, { cacheTimeout: -1 }),
      gnosis: new JsonRpcProvider(new NetworkManager().getRpcUrl("gnosis"), undefined, { cacheTimeout: -1 }),
    };
    try {
      const result = await readStewardActivation(plan, activationManifest, artifacts, providers);
      for (const safe of result.safes)
        if (safe.runtimeHash !== rehearsal.rows.find((row) => row.network === safe.network)!.runtimeHash)
          throw new Error("Live runtime differs from exact rehearsal");
      unchanged();
      writeReleaseJsonAtomic(output(), result);
      console.log(
        JSON.stringify({ state: result.state, pending: result.pending, output: o.output, liveBroadcast: false }),
      );
      if (result.pending.length) process.exitCode = 1;
      return;
    } finally {
      providers.arbitrum.destroy();
      providers.gnosis.destroy();
    }
  }
  if (mode === "activation") {
    const provider = new JsonRpcProvider(new NetworkManager().getRpcUrl("arbitrum"), undefined, { cacheTimeout: -1 });
    try {
      if ((await provider.getNetwork()).chainId !== 42161n) throw new Error("Wrong source chain");
      const block = await provider.getBlock("latest");
      if (!block?.hash) throw new Error("Missing canonical source block");
      const hats = new Contract(
        manifest.hatsModule!,
        [
          "function owner() view returns(address)",
          "function stewardObserver(address) view returns(address)",
          "function isStewardOf(address,address) view returns(bool)",
          "function getGardenHatIds(address) view returns(uint256,uint256,uint256,uint256,uint256,uint256,uint256,bool)",
        ],
        provider,
      );
      const at = { blockTag: block.number },
        ids = await hats.getGardenHatIds(manifest.garden, at);
      if (String(ids[1]) !== manifest.stewardHat || !ids[7]) throw new Error("Canonical steward Hat changed");
      const stewards = [];
      for (const account of activationManifest.confirmedStewards) {
        if (!(await hats.isStewardOf(manifest.garden, account, at)))
          throw new Error("Manifest contains a former steward");
        stewards.push(account);
      }
      const source = plan.transactions[0].address;
      const observer = await hats.stewardObserver(manifest.garden, at);
      if (BigInt(observer) !== 0n && observer.toLowerCase() !== source.toLowerCase())
        throw new Error("Existing garden observer requires an explicit migration");
      const sync = new Interface(["function syncSteward(address)"]);
      const result = {
        state: "activation-draft",
        planHash: voucherDigest(plan),
        rehearsalHash: voucherDigest(rehearsal),
        rosterHash: voucherDigest(activationManifest.confirmedStewards),
        observedAt: { blockNumber: block.number, blockHash: block.hash },
        predictedSafes: rehearsal.rows.map((row) => ({ network: row.network, ...row.safe })),
        observerRegistration: {
          ...plan.observerRegistration,
          authority: await hats.owner(at),
          currentObserver: observer,
        },
        initialRefresh: stewards.map((account) => ({
          account,
          chainId: 42161,
          to: source,
          value: "0",
          data: sync.encodeFunctionData("syncSteward", [account]),
        })),
        requirements: [
          "Adopt and verify both canonical deployment receipts before registering the observer",
          "Confirm the complete current steward roster and prove two usable signers on each chain",
          "Quote initial refreshes on the deployed publisher; review and fund a finite native CCIP budget",
          "Register the observer, refresh every current steward, then wait for CCIP delivery",
          "Verify all source/dispatched/destination revisions, owners, valid signers and threshold on both chains",
          "Review issuer, earned-reward terms, reserve and booking authority separately before granting value authority",
        ],
        authorityEnabled: false,
        liveBroadcast: false,
      };
      unchanged();
      writeReleaseJsonAtomic(output(), result);
      console.log(JSON.stringify({ state: result.state, output: o.output, liveBroadcast: false }));
      return;
    } finally {
      provider.destroy();
    }
  }
  let execution = mode === "prepare" ? undefined : (load("envelope") as StewardExecution);
  const network = (execution?.network ?? required("target-chain")) as StewardNetwork;
  if (!["arbitrum", "gnosis"].includes(network)) throw new Error("Choose arbitrum or gnosis");
  const tx = plan.transactions.find((row) => row.network === network)!;
  const rpc = new NetworkManager().getRpcUrl(network);
  const provider = new JsonRpcProvider(rpc, undefined, { cacheTimeout: -1, batchStallTime: 0 });
  try {
    if ((await provider.getNetwork()).chainId !== BigInt(tx.chainId)) throw new Error("Wrong deployment chain");
    const unspent = async () => {
      const peerNetwork = network === "arbitrum" ? "gnosis" : "arbitrum";
      const peerProvider = new JsonRpcProvider(new NetworkManager().getRpcUrl(peerNetwork), undefined, {
        cacheTimeout: -1,
        batchStallTime: 0,
      });
      try {
        await checkStewardPeer(
          plan,
          manifest,
          artifacts,
          peerNetwork,
          peerProvider,
          rehearsal.rows.find((row) => row.network === peerNetwork)!.runtimeHash,
        );
      } finally {
        peerProvider.destroy();
      }
      for (const tag of ["latest", "pending"])
        if (Number(await provider.send("eth_getTransactionCount", [tx.from, tag])) !== tx.nonce)
          throw new Error("Deployer nonce changed");
      if ((await provider.getCode(tx.address)) !== "0x")
        throw new Error("CREATE address is already occupied; adopt its receipt");
      if (network === "arbitrum") {
        const hats = new Contract(
          manifest.hatsModule!,
          [
            "function getGardenHatIds(address) view returns(uint256,uint256,uint256,uint256,uint256,uint256,uint256,bool)",
          ],
          provider,
        );
        const ids = await hats.getGardenHatIds(manifest.garden);
        if (!ids[7] || String(ids[1]) !== manifest.stewardHat) throw new Error("Canonical steward authority changed");
      }
      // Re-estimating the exact constructor also checks pinned dependencies and the next Hats root.
      return await provider.estimateGas({ from: tx.from, data: tx.data, value: 0n, nonce: tx.nonce });
    };
    if (mode === "prepare") {
      const gas = ((await unspent()) * 130n + 99n) / 100n;
      const fee = positiveStewardUint(required("max-fee-wei"));
      const quotedFees = await provider.getFeeData();
      if (quotedFees.maxPriorityFeePerGas === null) throw new Error("Cannot quote a bounded priority fee");
      const priority = quotedFees.maxPriorityFeePerGas * 2n;
      if (priority > fee) throw new Error("Priority fee quote exceeds the approved total fee cap");
      if (gas * fee > positiveStewardUint(required("max-cost-wei")))
        throw new Error("CREATE exceeds the approved maximum cost");
      execution = {
        schemaVersion: 1,
        planHash: voucherDigest(plan),
        rehearsalHash: voucherDigest(rehearsal),
        network,
        gasLimit: String(gas),
        maxFeeWei: String(fee),
        maxPriorityFeeWei: String(priority),
        maximumCostWei: String(gas * fee),
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      };
      validateStewardExecution(plan, rehearsal, execution);
      stewardCreateArgs(plan, execution, rpc);
      unchanged();
      writeReleaseJsonAtomic(output(), execution);
      console.log(
        JSON.stringify({
          state: "execution-prepared",
          output: o.output,
          maximumCostWei: execution.maximumCostWei,
          liveBroadcast: false,
        }),
      );
      return;
    }
    validateStewardExecution(plan, rehearsal, execution!, mode === "broadcast");
    const store = stewardExecutionStore(directory, plan, execution!);
    let hash = o.receipt;
    if (mode === "broadcast") {
      if (store.read()) throw new Error("Existing deployment intent; adopt the receipt instead of resubmitting");
      hash = await withKeystorePassword(async (environment, signal) => {
        signal.throwIfAborted();
        unchanged();
        validateStewardExecution(plan, rehearsal, execution!);
        if ((await unspent()) > BigInt(execution!.gasLimit))
          throw new Error("Current gas estimate exceeds reviewed limit");
        if ((await provider.getBalance(tx.from, "pending")) < BigInt(execution!.maximumCostWei))
          throw new Error("Insufficient native deployment balance");
        const fee = await provider.getFeeData();
        if ((fee.gasPrice ?? 0n) > BigInt(execution!.maxFeeWei)) throw new Error("Current fee exceeds reviewed cap");
        if (fee.maxPriorityFeePerGas === null || fee.maxPriorityFeePerGas > BigInt(execution!.maxPriorityFeeWei))
          throw new Error("Current priority fee exceeds reviewed cap; prepare a fresh envelope");
        signal.throwIfAborted();
        store.claim();
        const sent = parseCastTransactionHash(
          execCastCaptured(
            stewardCreateArgs(plan, execution!, rpc),
            { cwd: CONTRACTS_ROOT, env: environment },
            "Steward deployment",
          ),
          "Steward deployment",
        );
        store.record(sent);
        return sent;
      });
      // Do not keep credentials open or poll indefinitely while a receipt is pending.
    }
    if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error("A canonical receipt hash is required");
    const receipt = await provider.getTransactionReceipt(hash),
      transaction = await provider.getTransaction(hash);
    if (!receipt || !transaction)
      throw new Error("Receipt is pending; run adopt with the same envelope and transaction hash");
    const block = await provider.getBlock(receipt.blockNumber);
    validateStewardReceipt(plan, execution!, transaction, receipt, block?.hash ?? null);
    const readback = await readStewardDeployment(
      plan,
      manifest,
      artifacts,
      network,
      provider,
      // Permissionless steward claims may follow CREATE in the same block. The exact rehearsal
      // proves empty constructor state; receipt adoption must not become unrecoverable after a claim.
      false,
      receipt.blockNumber,
    );
    if (readback.runtimeHash !== rehearsal.rows.find((row) => row.network === network)!.runtimeHash)
      throw new Error("Deployed runtime differs from the exact rehearsed runtime");
    unchanged();
    if (!store.read()) store.claim();
    store.record(hash, { receiptBlock: receipt.blockNumber, receiptBlockHash: receipt.blockHash, readback });
    console.log(
      JSON.stringify({
        state: "deployment-verified",
        network,
        hash,
        safe: readback.safe,
        liveBroadcast: mode === "broadcast",
        activationIncluded: false,
      }),
    );
  } finally {
    provider.destroy();
  }
}
if (import.meta.main)
  main().catch((error) => {
    console.error(redactRpcUrlsInText(error instanceof Error ? error.message : "Steward execution failed"));
    process.exitCode = 1;
  });
