import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { Contract, getAddress, Interface, isAddress, JsonRpcProvider, keccak256, ZeroAddress } from "ethers";
import { ownershipTransferTargets } from "../release-verify";
import { buildReadOnlyCastEnv, execCastCaptured, parseCastTransactionHash } from "../utils/cast-env";
import type { ParsedOptions } from "../utils/cli-parser";
import { NetworkManager } from "../utils/network";
import { getFoundryBroadcastPath } from "../utils/paths";
import {
  mergeReleaseArtifact,
  recoverReleaseArtifact,
  simulateReleaseArtifactMerge,
  writeReleaseJsonAtomic,
} from "../utils/release-artifacts";
import { assertSepoliaGate } from "../utils/release-gate";
import {
  assertManifestMatchesNetworkDirectory,
  buildReleaseLock,
  CONTRACTS_ROOT,
  exactForgeLibraryArguments,
  loadReleaseManifest,
  type ReleaseLock,
  type ReleaseManifest,
  type ReleaseStage,
} from "../utils/release-manifest";
import {
  buildPeerTransactionPlan,
  buildStageTransactionPlan,
  type ReleaseTransactionBoundary,
} from "../utils/release-plan";
import { retryRpcAvailability } from "../utils/rpc-retry";

const LOCK_PATH = path.join(CONTRACTS_ROOT, "config/commitment-pooling-release.lock.json");
const GENERATED_ROOT = path.join(CONTRACTS_ROOT, ".generated/release");

export function ownershipBroadcastWalletArgs(account: string, passwordFile = process.env.ETH_PASSWORD): string[] {
  return ["--account", account, ...(passwordFile ? ["--password-file", passwordFile] : [])];
}

const STAGE_NETWORK: Record<ReleaseStage, "arbitrum" | "celo"> = {
  pooling: "arbitrum",
  "settlement-module": "arbitrum",
  "credit-registry": "arbitrum",
  "settlement-executor": "celo",
};

const STAGE_KEYS: Record<ReleaseStage, readonly string[]> = {
  pooling: [
    "poolingLibraries",
    "commitmentPoolingModule",
    "commitmentPoolingModuleImpl",
    "commitmentPoolingModulePaused",
    "commitmentRegistry",
    "commitmentRegistryImpl",
  ],
  "settlement-module": ["settlementLibraries", "settlementModule", "settlementModuleImpl"],
  "credit-registry": ["creditRegistry", "creditRegistryImpl"],
  "settlement-executor": ["celoSettlementExecutor", "celoSettlementExecutorImpl"],
};

const STAGE_TARGET: Record<ReleaseStage, string[]> = {
  pooling: ["CommitmentPoolingModule", "CommitmentRegistry"],
  "settlement-module": ["SettlementModule"],
  "credit-registry": ["CreditRegistry"],
  "settlement-executor": ["CeloSettlementExecutor"],
};

const STAGE_RECEIPT_KEY: Partial<Record<ReleaseStage, string>> = {
  "settlement-module": "settlementModule",
  "settlement-executor": "celoSettlementExecutor",
};

function stable(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function writeGenerated(filePath: string, value: unknown): void {
  writeReleaseJsonAtomic(filePath, value as Record<string, unknown>);
}

function readReleaseArtifactIfPresent(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

export interface ReleaseCheckpoint {
  schemaVersion: 1;
  releaseId: string;
  manifestHash: string;
  stage: ReleaseStage;
  network: "arbitrum" | "celo";
  baseSalt: string;
  lastVerifiedStep: number;
  verifiedBoundaries: Array<{
    index: number;
    label: string;
    expectedNonce: number;
    transactionHash: string;
    blockNumber: number;
    verifiedAt: string;
  }>;
}

export interface OwnershipTransferPlan {
  schemaVersion: 1;
  releaseId: string;
  manifestHash: string;
  sourceCommit: string;
  network: "arbitrum" | "celo";
  chainId: number;
  sender: string;
  finalOwner: string;
  transactions: Array<{
    index: number;
    label: string;
    to: string;
    calldata: string;
    expectedNoncePolicy: "fresh-per-boundary";
    preconditions: string[];
    resumableState: string;
    postActionVerifier: string[];
  }>;
  canonicalArtifactMutation: false;
}

export interface OwnershipCheckpoint {
  schemaVersion: 1;
  releaseId: string;
  manifestHash: string;
  network: "arbitrum" | "celo";
  completed: Array<{
    step: number;
    label: string;
    expectedNonce: number;
    transactionHash: string;
    blockNumber: number;
    verifiedAt: string;
  }>;
}

function assertBoundaryEvidence(
  evidence: { transactionHash: string; blockNumber: number; verifiedAt: string },
  label: string,
): void {
  if (!/^0x[0-9a-f]{64}$/iu.test(evidence.transactionHash)) {
    throw new Error(`${label} has no valid transaction hash`);
  }
  if (!Number.isSafeInteger(evidence.blockNumber) || evidence.blockNumber <= 0) {
    throw new Error(`${label} has no valid block number`);
  }
  if (Number.isNaN(Date.parse(evidence.verifiedAt))) throw new Error(`${label} has no valid verification time`);
}

export function assertCheckpointReceiptBlock(storedBlock: number, receiptBlock: number, label: string): void {
  if (storedBlock !== receiptBlock) {
    throw new Error(`${label} checkpoint block ${storedBlock} does not match verified receipt block ${receiptBlock}`);
  }
}

export function validateOwnershipCheckpointPrefix(
  checkpoint: OwnershipCheckpoint,
  plan: OwnershipTransferPlan,
  requestedStep: number,
): void {
  if (requestedStep < 1 || requestedStep > plan.transactions.length) {
    throw new Error(`Ownership plan has no boundary ${requestedStep}`);
  }
  const alreadyVerified = checkpoint.completed.some((entry) => entry.step === requestedStep);
  const requiredLength = alreadyVerified ? requestedStep : requestedStep - 1;
  if (checkpoint.completed.length !== requiredLength) {
    throw new Error(`Ownership boundary ${requestedStep} is not the next boundary in the verified prefix`);
  }
  for (let index = 0; index < checkpoint.completed.length; index += 1) {
    const evidence = checkpoint.completed[index];
    const boundary = plan.transactions[index];
    if (
      evidence.step !== index + 1 ||
      evidence.label !== boundary.label ||
      !Number.isSafeInteger(evidence.expectedNonce) ||
      evidence.expectedNonce < 0
    ) {
      throw new Error("Ownership checkpoint is not one contiguous reviewed prefix");
    }
    assertBoundaryEvidence(evidence, `Ownership checkpoint boundary ${evidence.step}`);
  }
}

export function validateReleaseCheckpointPrefix(
  checkpoint: ReleaseCheckpoint,
  transactions: ReadonlyArray<ReleaseTransactionBoundary>,
  requestedStep: number,
): void {
  if (requestedStep < 1 || requestedStep > transactions.length) {
    throw new Error(`Release plan has no boundary ${requestedStep}`);
  }
  if (checkpoint.lastVerifiedStep !== checkpoint.verifiedBoundaries.length) {
    throw new Error("Release checkpoint cursor differs from its receipt ledger");
  }
  const alreadyVerified = checkpoint.verifiedBoundaries.some((entry) => entry.index === requestedStep);
  const requiredLength = alreadyVerified ? requestedStep : requestedStep - 1;
  if (checkpoint.verifiedBoundaries.length !== requiredLength) {
    throw new Error(`Release boundary ${requestedStep} is not the next boundary in the verified prefix`);
  }
  for (let index = 0; index < checkpoint.verifiedBoundaries.length; index += 1) {
    const evidence = checkpoint.verifiedBoundaries[index];
    const boundary = transactions[index];
    if (
      evidence.index !== index + 1 ||
      evidence.label !== boundary.label ||
      !Number.isSafeInteger(evidence.expectedNonce) ||
      evidence.expectedNonce < 0 ||
      (boundary.nonce !== undefined && evidence.expectedNonce !== boundary.nonce)
    ) {
      throw new Error("Release checkpoint is not one contiguous reviewed prefix");
    }
    assertBoundaryEvidence(evidence, `Release checkpoint boundary ${evidence.index}`);
  }
}

export function retryPostStateVerification(
  verify: () => void,
  options: {
    attempts?: number;
    wait?: (milliseconds: number) => void;
    onRetry?: (attempt: number, error: unknown) => void;
  } = {},
): void {
  const attempts = options.attempts ?? 6;
  if (!Number.isSafeInteger(attempts) || attempts < 1) throw new Error("Post-state verifier requires an attempt");
  const wait =
    options.wait ??
    ((milliseconds: number) => {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
    });
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      verify();
      return;
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      options.onRetry?.(attempt, error);
      wait(2_000);
    }
  }
  throw lastError;
}

const ownableInterface = new Interface([
  "function owner() view returns (address)",
  "function transferOwnership(address newOwner)",
]);

function readDeployment(chainId: string): Record<string, unknown> {
  const filePath = path.join(CONTRACTS_ROOT, "deployments", `${chainId}-latest.json`);
  if (!fs.existsSync(filePath)) throw new Error(`Canonical deployment artifact not found: ${filePath}`);
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

export function releaseReceiptForIndexer(
  deployment: Record<string, unknown>,
  contract: "settlementModule" | "celoSettlementExecutor",
): { transactionHash: string; blockNumber: number } {
  const receipts = deployment.releaseReceipts;
  const receipt =
    receipts && typeof receipts === "object" && !Array.isArray(receipts)
      ? (receipts as Record<string, unknown>)[contract]
      : undefined;
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    throw new Error(`Canonical deployment artifact has no ${contract} proxy receipt`);
  }
  const { transactionHash, blockNumber } = receipt as Record<string, unknown>;
  if (
    typeof transactionHash !== "string" ||
    !/^0x[0-9a-f]{64}$/iu.test(transactionHash) ||
    typeof blockNumber !== "number" ||
    !Number.isSafeInteger(blockNumber) ||
    blockNumber <= 0
  ) {
    throw new Error(`Canonical ${contract} proxy receipt is invalid`);
  }
  return { transactionHash, blockNumber };
}

function identity(lock: ReleaseLock, name: string, kind: "implementation" | "proxy") {
  const result = lock.identities.find((candidate) => candidate.name === name && candidate.kind === kind);
  if (!result) throw new Error(`Release lock has no ${kind} identity for ${name}`);
  return result;
}

export function predictedSide(
  lock: ReleaseLock,
  stage: ReleaseStage,
  commitmentPoolingModulePaused = true,
): Record<string, unknown> {
  const targets = STAGE_TARGET[stage];
  const result: Record<string, unknown> = {};
  for (const target of targets) {
    const keyBase =
      target === "CommitmentPoolingModule" ? "commitmentPoolingModule" : target[0].toLowerCase() + target.slice(1);
    result[keyBase] = identity(lock, target, "proxy").address;
    result[`${keyBase}Impl`] = identity(lock, target, "implementation").address;
  }
  const libraries = lock.identities
    .filter((candidate) => candidate.kind === "library" && candidate.stage === stage)
    .sort((a, b) => a.name.localeCompare(b.name));
  if (libraries.length > 0) {
    result[stage === "pooling" ? "poolingLibraries" : "settlementLibraries"] = Object.fromEntries(
      libraries.map((candidate) => [candidate.name, candidate.address]),
    );
  }
  if (stage === "pooling") result.commitmentPoolingModulePaused = commitmentPoolingModulePaused;
  return result;
}

export function poolingPauseStateForRecovery(artifact: Record<string, unknown>): boolean {
  const recorded = artifact.commitmentPoolingModulePaused;
  if (typeof recorded !== "boolean") {
    throw new Error("Canonical deployment artifact must record commitmentPoolingModulePaused for Pooling recovery");
  }
  return recorded;
}

export function poolingPauseStateForStageArtifact(artifact: Record<string, unknown>): boolean {
  const recorded = artifact.commitmentPoolingModulePaused;
  return typeof recorded === "boolean" ? recorded : true;
}

function assertLockExact(expected: ReleaseLock): void {
  if (!fs.existsSync(LOCK_PATH))
    throw new Error(`Frozen release lock missing: ${LOCK_PATH}; run release-manifest --save-artifacts`);
  const actual = JSON.parse(fs.readFileSync(LOCK_PATH, "utf8")) as ReleaseLock;
  if (stable(actual) !== stable(expected)) {
    throw new Error(
      "Frozen release lock differs from current production artifacts or manifest; regenerate and review the diff",
    );
  }
}

/** Selective Phase-A/Phase-B wrapper. Phase A invokes only the non-broadcast paths. */
export class ReleaseDeployer {
  constructor(private readonly networkManager = new NetworkManager()) {}

  showHelp(): void {
    console.log(`
Commitment Pooling / Settlement / Credit release targets

  release-manifest         Validate the combined manifest and exact deterministic identity lock
  protocol-core            Print the dependency-ordered Arbitrum core preparation/finalization plan
  ownership-transfer      Plan a future owner transfer; current-manifest broadcast is disabled
  settlement-module       Deploy/plan the paused Arbitrum SettlementModule candidate
  credit-registry         Deploy/plan the paused records-only CreditRegistry and exact binding
  settlement-executor     Deploy/plan the paused Celo executor (only --network celo is supported)
  safe-plan               Validate the inert Safe/Zodiac authority plan; emits no transactions
  settlement-peer         Plan peer wiring after fresh bidirectional lane proof
  release-recover         Print the recovery command and exact expected identities
  release-verify          Run the release post-deploy verifier (read-only)
  indexer-handoff         Produce an inert PRD-722 address/start-block handoff (no hosted deploy)

Release options:
  --network <name>        Exact target network (arbitrum or celo as documented above)
  --dry-run               Run the Foundry simulation through the real script and artifact merge path
  --pure-simulation       Produce the exact RPC-free transaction/persistence plan
  --save-artifacts        With release-manifest, rewrite the reviewed lock file
  --salt <value>          Override the complete CREATE2 base salt; predictions and script both use it
  --sender <address>      Must equal the frozen deployment sender
  --stage <name>          Exact stage for recovery or scoped verification
  --step <index>          Required with --broadcast; executes exactly one transaction boundary
  --expected-nonce <n>    Required for release-stage plans, dry runs, and broadcasts
  --receipt <tx-hash>     Recover a mined boundary after local checkpoint persistence failed
  --artifact <path>       Explicit recovery artifact for verification
  --owner-phase <phase>   Verification owner phase: deployment or safe
  --broadcast             Phase B only; requires separate stage-specific human authorization
  --override-sepolia-gate Keep the repository production-chain gate explicit when authorized

Examples (Phase A, no broadcast):
  bun run release:manifest
  bun run release:core:plan:arbitrum
  bun run settlement:module:plan:arbitrum --expected-nonce <fresh-pending-nonce>
  bun run credit:registry:plan:arbitrum --expected-nonce <fresh-pending-nonce>
  bun run settlement:executor:plan:celo --expected-nonce <fresh-pending-nonce>
  bun run settlement:safe:plan:celo
  bun run release:verify:plan:arbitrum
  bun run release:indexer:handoff

Phase B boundary form (not authorized by Phase A):
  bun run settlement:module:deploy:arbitrum --step <index> --expected-nonce <n>
`);
  }

  async run(command: string, options: ParsedOptions): Promise<void> {
    const manifest = loadReleaseManifest();
    assertManifestMatchesNetworkDirectory(manifest);
    const baseSalt = options.deploymentSalt ?? `${manifest.create2.domain}:${manifest.create2.version}`;
    const lock = buildReleaseLock(manifest, baseSalt);

    if (command === "release-manifest") return this.manifest(options, manifest, lock);
    assertLockExact(buildReleaseLock(manifest));
    this.assertSender(command, options, manifest);

    switch (command) {
      case "protocol-core":
        return this.protocolCore(options, manifest, lock);
      case "ownership-transfer":
        return this.ownershipTransfer(options, manifest, lock);
      case "pooling":
      case "settlement-module":
      case "credit-registry":
      case "settlement-executor":
        return this.stage(command, options, manifest, lock, baseSalt);
      case "safe-plan":
        return this.safePlan(options, manifest, lock);
      case "settlement-peer":
        return this.peerPlan(options, manifest, lock);
      case "settlement-peer-verify":
        return this.peerVerify(options, manifest, lock);
      case "release-recover":
        return this.recoveryPlan(options, manifest, lock);
      case "release-verify":
        return this.runVerifier(options);
      case "indexer-handoff":
        return this.indexerHandoff(options, manifest, lock);
      default:
        throw new Error(`Unknown release command: ${command}`);
    }
  }

  private manifest(options: ParsedOptions, manifest: ReleaseManifest, lock: ReleaseLock): void {
    console.log(`Release manifest: ${manifest.releaseId}`);
    console.log(`Frozen implementation source: ${manifest.sourceCommit}`);
    console.log(`Deployment sender/initial owner: ${manifest.ownership.deploymentSender}`);
    console.log(`Protocol Safe/future owner: ${manifest.ownership.protocolSafe}`);
    console.log(
      manifest.ceremony.endState === "paused-safe-owned"
        ? "Current ceremony end state: paused and protocol-Safe owned (ownership transfer included)"
        : "Current ceremony end state: paused and deployment-sender owned",
    );
    console.log(`CREATE2 salt base: ${manifest.create2.domain}:${manifest.create2.version}`);
    console.log(`Deterministic identities: ${lock.identities.length} (21 libraries, 5 implementations, 5 proxies)`);
    console.log(
      `TestimonyResolver preparation: ${manifest.schemaPreparation.expected.implementation} -> ` +
        manifest.schemaPreparation.expected.proxy,
    );
    console.log(
      `Community Testimony UID: ${manifest.schemas.find((schema) => schema.identity === "community-testimony-v1")?.uid}`,
    );
    console.log(`Manifest hash: ${lock.manifestHash}`);
    if (options.saveArtifacts) {
      writeReleaseJsonAtomic(LOCK_PATH, lock);
      console.log(`Frozen release lock written: ${LOCK_PATH}`);
    } else {
      assertLockExact(lock);
      console.log(`Frozen release lock matches: ${LOCK_PATH}`);
    }
    console.log(
      manifest.safeAuthority.enabled
        ? `Safe/Zodiac authority: frozen over ${manifest.safeAuthority.gardenSafes.length} garden Safes; ` +
            "reserve funding, the Arbitrum CCIP route, and the canary remain separately gated"
        : "Safe/Zodiac authority: disabled; no value-authority transaction can be built from this manifest",
    );
    console.log("Indexer deployment: outside this lane; PRD-722 handoff generation is inert");
  }

  private protocolCore(options: ParsedOptions, manifest: ReleaseManifest, lock: ReleaseLock): void {
    if (options.network !== "arbitrum") throw new Error("protocol-core supports only --network arbitrum");
    const plan = {
      schemaVersion: 1,
      releaseId: manifest.releaseId,
      network: "arbitrum",
      sender: manifest.ownership.deploymentSender,
      stages: [
        {
          index: 1,
          command: "bun run assessment:upgrade:plan:arbitrum --expected-nonce <fresh-pending-nonce>",
          outcome:
            "actual AssessmentResolver implementation/owner/code hash, final creation-code hash, rollback calldata, and a separate canonical-v2-UID pin boundary when live v2 is zero",
          nextStageRule: "rebuild this nonce-bound plan immediately before its separately authorized stage",
        },
        {
          index: 2,
          command: "bun run pooling:schemas:plan:arbitrum --expected-nonce <fresh-pending-nonce>",
          outcome: "testimony resolver prediction plus AssessmentV3 preparation; no Community Testimony activation",
        },
        {
          index: 3,
          command: "bun run pooling:deploy:dry:arbitrum --expected-nonce <fresh-pending-nonce>",
          outcome:
            "one complete paused pooling transaction plan with explicit libraries, module/register identities, and module-side dependency/schema wiring",
        },
        {
          index: 4,
          command: "bun run pooling:finalize:plan:arbitrum --expected-nonce <fresh-pending-nonce>",
          outcome: "exact record reconciliation and final resolver activation",
        },
        {
          index: 5,
          command: "bun run settlement:module:plan:arbitrum --expected-nonce <fresh-pending-nonce>",
          outcome: "paused message-only source candidate; no peer and no value authority",
        },
        {
          index: 6,
          command: "bun run credit:registry:plan:arbitrum --expected-nonce <fresh-pending-nonce>",
          outcome: "paused records-only registry plus two-way settlement binding; G$ pool rail remains disabled",
        },
        {
          index: 7,
          command: "bun run pooling:upgrade:plan:arbitrum --expected-nonce <fresh-pending-nonce>",
          outcome:
            "KarmaGAPModule upgraded before the GardenToken and WorkApprovalResolver callers, with exact implementations/owners/code hashes, reverse wiring, and per-proxy rollback calldata while pooling stays paused",
          nextStageRule:
            "rebuild after earlier receipts; a stale sender nonce invalidates every predicted implementation",
        },
      ],
      deferredFollowUp: {
        issueRequired: manifest.ceremony.followUpIssueRequired,
        // Ownership transfer leaves this list once the ceremony includes it; backfill and unpause
        // always stay deferred here because this manifest never authorizes them.
        operations: [
          ...(manifest.ceremony.ownershipTransferIncluded ? [] : ["ownership-transfer"]),
          "18-garden-pool-backfill",
          "core-unpause",
        ],
        includedInThisCeremony: manifest.ceremony.ownershipTransferIncluded ? ["ownership-transfer"] : [],
        from: manifest.ownership.deploymentSender,
        to: manifest.ownership.protocolSafe,
        rollbackBefore: manifest.ownership.rollbackOwnerBeforeTransfer,
        rollbackAfter: manifest.ownership.rollbackOwnerAfterTransfer,
        rule: "A separately reviewed Product issue must update the manifest and prove the paused-registration increment, Safe state on each target chain, every transfer receipt, the approved 18-garden/root-token-0 backfill while the module remains paused, and a separate later unpause authorization.",
      },
      predictedCore: lock.identities
        .filter((item) => item.network === "arbitrum")
        .map(({ name, kind, address }) => ({
          name,
          kind,
          address,
        })),
      canonicalArtifactMutation: false,
    };
    const planPath = path.join(GENERATED_ROOT, manifest.releaseId, "arbitrum", "protocol-core-plan.json");
    writeGenerated(planPath, plan);
    console.log(stable(plan));
    console.log(`Plan written: ${planPath}`);
  }

  /**
   * Tier-3 destination check for any ownership handover. Ownership transfer is what moves protocol
   * authority onto a multisig, so the Safe it lands on must have code and satisfy the live
   * threshold floor on this chain. Owner membership is operationally managed and does not block
   * the release boundary.
   */
  private async assertTierThreeOwnerSafe(
    provider: JsonRpcProvider,
    manifest: ReleaseManifest,
    network: "arbitrum" | "celo",
    blockTag: number | "finalized",
  ): Promise<void> {
    const safeAddress = manifest.ownership.protocolSafe;
    const floorThreshold = BigInt(manifest.ownership.protocolSafeConfiguration.contractsGuideMinimumThreshold);
    if ((await provider.getCode(safeAddress, blockTag)) === "0x") {
      throw new Error(`Frozen protocol Safe ${safeAddress} has no code on ${network} at block ${String(blockTag)}`);
    }
    const safe = new Contract(safeAddress, ["function getThreshold() view returns (uint256)"], provider);
    const threshold = (await safe.getThreshold({ blockTag })) as bigint;
    if (threshold < floorThreshold) {
      throw new Error(
        `Tier-3 ownership transfer is blocked: protocol Safe ${safeAddress} on ${network} has threshold ` +
          `${String(threshold)}, below the repository floor of ${String(floorThreshold)}; raise it before transferring`,
      );
    }
    console.log(`  protocol Safe on ${network}: threshold ${String(threshold)}`);
  }

  private async ownershipTransfer(options: ParsedOptions, manifest: ReleaseManifest, lock: ReleaseLock): Promise<void> {
    if (options.broadcast && !manifest.ceremony.ownershipTransferIncluded) {
      throw new Error(
        "Ownership transfer is deferred to a later issue and is not included in the current paused deployer-owned ceremony",
      );
    }
    if (options.network !== "arbitrum" && options.network !== "celo") {
      throw new Error("ownership-transfer supports only --network arbitrum|celo");
    }
    const network = options.network;
    const chainId = Number(manifest.chains[network].evmChainId);
    const deployment = readDeployment(String(chainId));
    // One target list, shared with release-verify's Safe phase, so the contracts this ceremony hands
    // over and the contracts the post-state verifier checks are the same list by construction.
    const targets = ownershipTransferTargets(network, manifest, lock, deployment as Record<string, unknown>);
    const normalized = targets.map(([label, address]) => ({
      label: String(label),
      address: typeof address === "string" && isAddress(address) ? getAddress(address) : "",
    }));
    const invalid = normalized.filter((target) => !target.address || /^0x0+$/iu.test(target.address));
    if (invalid.length > 0)
      throw new Error(`Ownership plan has invalid targets: ${invalid.map((item) => item.label).join(", ")}`);
    if (new Set(normalized.map((target) => target.address.toLowerCase())).size !== normalized.length) {
      throw new Error("Ownership plan contains duplicate proxy identities");
    }
    const plan: OwnershipTransferPlan = {
      schemaVersion: 1,
      releaseId: manifest.releaseId,
      manifestHash: lock.manifestHash,
      sourceCommit: lock.sourceCommit,
      network,
      chainId,
      sender: manifest.ownership.deploymentSender,
      finalOwner: manifest.ownership.protocolSafe,
      transactions: normalized.map((target, index) => ({
        index: index + 1,
        label: `transfer ${target.label} ownership`,
        to: target.address,
        calldata: ownableInterface.encodeFunctionData("transferOwnership", [manifest.ownership.protocolSafe]),
        expectedNoncePolicy: "fresh-per-boundary" as const,
        preconditions: [
          `chainId equals ${chainId}`,
          `code exists at ${target.address}`,
          `live owner equals ${manifest.ownership.deploymentSender}`,
          "every preceding boundary has a verified receipt checkpoint in one contiguous reviewed prefix",
        ],
        resumableState:
          "The target is owned by either the reviewed deployment sender or the exact protocol Safe; every other owner is a conflict.",
        postActionVerifier: [`owner() equals ${manifest.ownership.protocolSafe}`],
      })),
      canonicalArtifactMutation: false,
    };
    const directory = path.join(GENERATED_ROOT, manifest.releaseId, network);
    const planPath = path.join(directory, "ownership-transfer-transaction-plan.json");
    const checkpointPath = path.join(directory, "ownership-transfer-checkpoint.json");
    writeGenerated(planPath, plan);
    console.log(stable(plan));
    console.log(`Exact ownership plan: ${planPath}`);

    if (options.pureSimulation) {
      console.log("PURE SIMULATION - no RPC calls and no canonical artifact mutation");
      return;
    }
    const provider = new JsonRpcProvider(this.networkManager.getRpcUrl(network), chainId, { staticNetwork: true });
    if (!options.broadcast) {
      if (!options.dryRun)
        throw new Error("ownership-transfer requires --dry-run, --pure-simulation, or authorized --broadcast");
      const finalized = await provider.getBlock("finalized");
      if (!finalized) throw new Error(`${network} RPC returned no finalized block`);
      await this.assertTierThreeOwnerSafe(provider, manifest, network, finalized.number);
      for (const target of normalized) {
        const code = await provider.getCode(target.address, finalized.number);
        if (code === "0x") {
          console.log(`  ${target.label}: deployment pending at ${target.address}`);
          continue;
        }
        const owner = getAddress(
          await new Contract(target.address, ownableInterface, provider).owner({ blockTag: finalized.number }),
        );
        if (owner !== getAddress(plan.sender) && owner !== getAddress(plan.finalOwner)) {
          throw new Error(`${target.label} has unexpected live owner ${owner}`);
        }
        console.log(`  ${target.label}: ${owner === getAddress(plan.finalOwner) ? "already transferred" : "ready"}`);
      }
      console.log(`Ownership dry-run pinned to finalized ${network} block ${finalized.number}`);
      return;
    }

    assertSepoliaGate({ network, broadcast: true, overrideSepoliaGate: options.overrideSepoliaGate });
    if (options.releaseStep === undefined || options.expectedNonce === undefined) {
      throw new Error("Ownership broadcast requires --step <index> and --expected-nonce <n>");
    }
    await this.assertTierThreeOwnerSafe(provider, manifest, network, "finalized");
    const boundary = plan.transactions[options.releaseStep - 1];
    if (!boundary || boundary.index !== options.releaseStep) {
      throw new Error(`Ownership plan has no boundary ${options.releaseStep}`);
    }
    const checkpoint: OwnershipCheckpoint = fs.existsSync(checkpointPath)
      ? (JSON.parse(fs.readFileSync(checkpointPath, "utf8")) as OwnershipCheckpoint)
      : {
          schemaVersion: 1 as const,
          releaseId: manifest.releaseId,
          manifestHash: lock.manifestHash,
          network,
          completed: [],
        };
    if (
      checkpoint.schemaVersion !== 1 ||
      checkpoint.releaseId !== manifest.releaseId ||
      checkpoint.manifestHash !== lock.manifestHash ||
      checkpoint.network !== network
    ) {
      throw new Error("Ownership checkpoint does not match the frozen release and network");
    }
    validateOwnershipCheckpointPrefix(checkpoint, plan, options.releaseStep);
    const prior = checkpoint.completed.find((item) => item.step === options.releaseStep);
    let transactionHash = prior?.transactionHash ?? options.receiptHash;
    if (!transactionHash) {
      const pendingNonce = await provider.getTransactionCount(plan.sender, "pending");
      if (pendingNonce !== options.expectedNonce) {
        throw new Error(`Nonce drift: expected ${options.expectedNonce}, live pending nonce is ${pendingNonce}`);
      }
      transactionHash = parseCastTransactionHash(
        execCastCaptured(
          [
            "send",
            boundary.to,
            boundary.calldata,
            "--chain",
            String(chainId),
            "--nonce",
            String(options.expectedNonce),
            ...ownershipBroadcastWalletArgs(manifest.ownership.deploymentKeystore),
            "--rpc-url",
            this.networkManager.getRpcUrl(network),
            "--json",
          ],
          {
            cwd: CONTRACTS_ROOT,
            env: process.env,
            inputStdio: process.env.ETH_PASSWORD ? "ignore" : "inherit",
          },
          "Bun-wrapped ownership boundary",
        ),
        "Bun-wrapped ownership boundary",
      );
    }
    const { transaction, receipt } = await retryRpcAvailability(
      async () => {
        const [transaction, receipt] = await Promise.all([
          provider.getTransaction(transactionHash),
          provider.getTransactionReceipt(transactionHash),
        ]);
        return transaction && receipt ? { transaction, receipt } : undefined;
      },
      {
        unavailableMessage: `Ownership receipt ${transactionHash} remained unavailable`,
        onRetry: (attempt) => console.warn(`Ownership receipt has not propagated; retrying after attempt ${attempt}/6`),
      },
    );
    if (receipt.status !== 1) throw new Error(`Ownership receipt ${transactionHash} failed`);
    if (
      getAddress(transaction.from) !== getAddress(plan.sender) ||
      !transaction.to ||
      getAddress(transaction.to) !== getAddress(boundary.to) ||
      transaction.data.toLowerCase() !== boundary.calldata.toLowerCase() ||
      transaction.nonce !== options.expectedNonce ||
      transaction.value !== 0n
    ) {
      throw new Error(`Ownership receipt ${transactionHash} differs from the reviewed boundary`);
    }
    if (prior) {
      assertCheckpointReceiptBlock(prior.blockNumber, receipt.blockNumber, `Ownership boundary ${options.releaseStep}`);
    }
    const liveOwner = getAddress(await new Contract(boundary.to, ownableInterface, provider).owner());
    if (liveOwner !== getAddress(plan.finalOwner)) throw new Error(`Ownership post-state mismatch at ${boundary.to}`);
    // The pre-send Safe check proves the destination was right when we looked; the Safe can change
    // between that read and mining, and again afterwards. Re-verify the exact frozen configuration
    // at the receipt block and at the current head before this boundary is allowed to checkpoint.
    await this.assertTierThreeOwnerSafe(provider, manifest, network, receipt.blockNumber);
    await this.assertTierThreeOwnerSafe(provider, manifest, network, "finalized");
    if (prior) {
      console.log(`Ownership boundary ${options.releaseStep} is already verified; no replay transaction was sent`);
      return;
    }
    checkpoint.completed.push({
      step: options.releaseStep,
      label: boundary.label,
      expectedNonce: options.expectedNonce,
      transactionHash,
      blockNumber: receipt.blockNumber,
      verifiedAt: new Date().toISOString(),
    });
    writeReleaseJsonAtomic(checkpointPath, checkpoint);
    console.log(
      `Ownership boundary ${options.releaseStep} receipt and post-state verified; checkpoint written atomically`,
    );
  }

  private async stage(
    stage: ReleaseStage,
    options: ParsedOptions,
    manifest: ReleaseManifest,
    lock: ReleaseLock,
    baseSalt: string,
  ): Promise<void> {
    const expectedNetwork = STAGE_NETWORK[stage];
    if (options.network !== expectedNetwork) {
      const detail = stage === "settlement-executor" ? "celo-sepolia is intentionally unsupported" : "wrong chain";
      throw new Error(`${stage} requires --network ${expectedNetwork} (${detail})`);
    }
    if (options.broadcast && options.releaseStep === undefined) {
      throw new Error("Broadcast requires --step <index>; one invocation may execute exactly one boundary");
    }
    if (options.broadcast && options.expectedNonce === undefined) {
      throw new Error("Broadcast requires --expected-nonce <n>; nonce drift must fail closed");
    }
    if (!options.broadcast && options.expectedNonce === undefined) {
      throw new Error("Release-stage planning and dry-run require --expected-nonce <reviewed-pending-nonce>");
    }
    if (options.broadcast && !options.dryRun) {
      assertSepoliaGate({
        network: options.network,
        broadcast: true,
        overrideSepoliaGate: options.overrideSepoliaGate,
      });
    }
    const chainId = manifest.chains[expectedNetwork].evmChainId;
    const deployment = readDeployment(chainId);
    const directory = path.join(GENERATED_ROOT, manifest.releaseId, expectedNetwork);
    const planPath = path.join(directory, `${stage}-transaction-plan.json`);
    const sidePath = path.join(directory, `${chainId}-${stage}-side.json`);
    const checkpointPath = path.join(directory, `${stage}-checkpoint.json`);
    const canonicalPath = path.join(CONTRACTS_ROOT, "deployments", `${chainId}-latest.json`);
    let plan: ReturnType<typeof buildStageTransactionPlan>;
    if (options.broadcast) {
      if (!fs.existsSync(planPath)) {
        throw new Error(`Broadcast requires the reviewed nonce-bound transaction plan: ${planPath}`);
      }
      plan = JSON.parse(fs.readFileSync(planPath, "utf8")) as ReturnType<typeof buildStageTransactionPlan>;
      if (!Number.isSafeInteger(plan.expectedNonce) || plan.expectedNonce! < 0) {
        throw new Error("Release-stage transaction plan is not bound to a reviewed starting nonce");
      }
      const canonicalPlan = buildStageTransactionPlan(manifest, lock, stage, deployment, baseSalt, plan.expectedNonce);
      if (stable(plan) !== stable(canonicalPlan)) {
        throw new Error("Release-stage transaction plan differs from the freshly derived canonical plan");
      }
    } else {
      plan = buildStageTransactionPlan(manifest, lock, stage, deployment, baseSalt, options.expectedNonce);
      writeGenerated(planPath, plan);
    }
    const stagePoolingPaused =
      stage === "pooling" ? poolingPauseStateForStageArtifact(readReleaseArtifactIfPresent(canonicalPath)) : true;
    writeGenerated(sidePath, predictedSide(lock, stage, stagePoolingPaused));
    const simulatedMerge = simulateReleaseArtifactMerge({
      canonicalPath,
      sidePath,
      ownedKeys: STAGE_KEYS[stage],
    });

    console.log(stable(plan));
    console.log(`Exact transaction plan: ${planPath}`);
    console.log(`CREATE2 base salt: ${baseSalt}`);
    console.log(`Sender/initial owner: ${manifest.ownership.deploymentSender}`);
    console.log(`Artifact dry-run preserved canonical history; would change: ${simulatedMerge.changed}`);

    if (options.pureSimulation) {
      console.log("PURE SIMULATION - no RPC calls and no canonical artifact mutation");
      return;
    }
    if (!options.dryRun && !options.broadcast) {
      throw new Error(`${stage} requires --dry-run, --pure-simulation, or a separately authorized --broadcast`);
    }
    const simulationBlock = options.broadcast
      ? undefined
      : await this.resolveSimulationBlock(expectedNetwork, manifest);
    const boundary = options.releaseStep === undefined ? undefined : plan.transactions[options.releaseStep - 1];
    if (options.releaseStep !== undefined && !boundary) {
      throw new Error(
        `${stage} transaction boundary ${options.releaseStep} does not exist; plan has ${plan.transactions.length}`,
      );
    }
    if (options.broadcast) {
      if (!boundary || options.expectedNonce === undefined) throw new Error("Broadcast boundary was not resolved");
      if (boundary.nonce !== options.expectedNonce) {
        throw new Error(
          `Boundary ${boundary.index} reviewed nonce is ${String(boundary.nonce)}, not ${options.expectedNonce}`,
        );
      }
      const checkpoint = this.readCheckpoint(checkpointPath);
      this.assertCheckpoint(
        checkpoint,
        manifest,
        lock,
        stage,
        expectedNetwork,
        baseSalt,
        boundary.index,
        plan.transactions,
      );
      if (checkpoint && checkpoint.lastVerifiedStep >= boundary.index) {
        const evidence = checkpoint.verifiedBoundaries.find((item) => item.index === boundary!.index);
        if (!evidence) throw new Error(`Boundary ${boundary.index} checkpoint has no receipt evidence`);
        const verifiedReceipt = await this.verifyReleaseReceipt(
          expectedNetwork,
          manifest,
          boundary,
          evidence.transactionHash,
          evidence.expectedNonce,
        );
        assertCheckpointReceiptBlock(
          evidence.blockNumber,
          verifiedReceipt.blockNumber,
          `Release boundary ${boundary.index}`,
        );
        this.runBoundaryVerifier(options, stage, boundary.index, sidePath, baseSalt);
        if (boundary.index === plan.transactions.length) {
          this.runStageVerifier(options, stage, sidePath, baseSalt);
          mergeReleaseArtifact({ canonicalPath, sidePath, ownedKeys: STAGE_KEYS[stage] });
          this.promoteStageReceipt(canonicalPath, directory, stage, {
            ...evidence,
            blockNumber: verifiedReceipt.blockNumber,
          });
          console.log("Final boundary artifact was promoted after full stage reverification");
        }
        console.log(`Boundary ${boundary.index} was already verified; no replay transaction was sent`);
        return;
      }
      if (!options.receiptHash) await this.assertLiveNonce(options, manifest, expectedNetwork);
      if (boundary.index > 1) this.runBoundaryVerifier(options, stage, boundary.index - 1, sidePath, baseSalt);
    }
    const transactionHash =
      options.receiptHash ??
      this.runForgeStage(stage, options, manifest, lock, baseSalt, sidePath, boundary?.label, simulationBlock);
    if (options.broadcast) {
      if (!boundary || options.expectedNonce === undefined)
        throw new Error("Internal release boundary invariant failed");
      if (!transactionHash) {
        throw new Error(
          "The selected boundary produced no transaction hash; recover an already-mined boundary with --receipt <tx-hash>",
        );
      }
      const receipt = await this.verifyReleaseReceipt(
        expectedNetwork,
        manifest,
        boundary,
        transactionHash,
        options.expectedNonce,
      );
      this.runBoundaryVerifier(options, stage, boundary.index, sidePath, baseSalt);
      const previous = this.readCheckpoint(checkpointPath);
      const checkpoint: ReleaseCheckpoint = {
        schemaVersion: 1,
        releaseId: manifest.releaseId,
        manifestHash: lock.manifestHash,
        stage,
        network: expectedNetwork,
        baseSalt,
        lastVerifiedStep: boundary.index,
        verifiedBoundaries: [
          ...(previous?.verifiedBoundaries ?? []),
          {
            index: boundary.index,
            label: boundary.label,
            expectedNonce: options.expectedNonce,
            transactionHash,
            blockNumber: receipt.blockNumber,
            verifiedAt: new Date().toISOString(),
          },
        ],
      };
      writeReleaseJsonAtomic(checkpointPath, checkpoint);
      if (boundary.index === plan.transactions.length) {
        this.runStageVerifier(options, stage, sidePath, baseSalt);
        mergeReleaseArtifact({ canonicalPath, sidePath, ownedKeys: STAGE_KEYS[stage] });
        this.promoteStageReceipt(
          canonicalPath,
          directory,
          stage,
          checkpoint.verifiedBoundaries[checkpoint.verifiedBoundaries.length - 1],
        );
        console.log("Final boundary verified; the exact stage artifact was promoted atomically");
      } else {
        console.log(`Boundary ${boundary.index} verified and checkpointed; canonical artifact remains unchanged`);
      }
    } else {
      const forgedMerge = simulateReleaseArtifactMerge({ canonicalPath, sidePath, ownedKeys: STAGE_KEYS[stage] });
      console.log(`Foundry simulation completed through artifact promotion path; would change: ${forgedMerge.changed}`);
    }
  }

  private promoteStageReceipt(
    canonicalPath: string,
    directory: string,
    stage: ReleaseStage,
    evidence: ReleaseCheckpoint["verifiedBoundaries"][number],
  ): void {
    const receiptKey = STAGE_RECEIPT_KEY[stage];
    if (!receiptKey) return;
    const sidePath = path.join(directory, `${stage}-receipt-promotion.json`);
    writeGenerated(sidePath, {
      releaseReceipts: {
        [receiptKey]: {
          transactionHash: evidence.transactionHash,
          blockNumber: evidence.blockNumber,
        },
      },
    });
    mergeReleaseArtifact({
      canonicalPath,
      sidePath,
      ownedKeys: [`releaseReceipts.${receiptKey}`],
    });
  }

  private runForgeStage(
    stage: ReleaseStage,
    options: ParsedOptions,
    manifest: ReleaseManifest,
    lock: ReleaseLock,
    baseSalt: string,
    sidePath: string,
    stepLabel?: string,
    simulationBlock?: number,
  ): string | undefined {
    const network = STAGE_NETWORK[stage];
    const chain = manifest.chains[network];
    const args = [
      "script",
      "script/DeployCommitmentRelease.s.sol:DeployCommitmentRelease",
      "--chain-id",
      chain.evmChainId,
      "--rpc-url",
      this.networkManager.getRpcUrl(network),
      ...exactForgeLibraryArguments(lock),
      "--sender",
      manifest.ownership.deploymentSender,
    ];
    if (!options.broadcast) {
      if (simulationBlock === undefined) throw new Error("Dry-run simulation requires an exact finalized fork block");
      args.push("--fork-block-number", String(simulationBlock));
    }
    if (options.broadcast && options.expectedNonce === undefined) throw new Error("Broadcast nonce was not provided");
    const proxy = (name: string) => identity(lock, name, "proxy").address;
    const assessmentV3Uid = manifest.schemas.find((schema) => schema.identity === "assessment-v3")?.uid;
    if (!assessmentV3Uid || !/^0x[0-9a-f]{64}$/iu.test(assessmentV3Uid)) {
      throw new Error("Release manifest must freeze the exact Assessment v3 schema UID");
    }
    const simulatedStage =
      !options.broadcast && stage === "settlement-module"
        ? "arbitrum-through-settlement"
        : !options.broadcast && stage === "credit-registry"
          ? "arbitrum-through-credit"
          : stage;
    const environment = {
      ...buildReadOnlyCastEnv(),
      FOUNDRY_PROFILE: "release_simulation",
      RELEASE_STAGE: simulatedStage,
      RELEASE_CREATE2_FACTORY: manifest.create2.factory,
      RELEASE_BASE_SALT: baseSalt,
      RELEASE_OWNER: manifest.ownership.deploymentSender,
      RELEASE_SENDER: manifest.ownership.deploymentSender,
      RELEASE_OUTPUT_PATH: sidePath,
      RELEASE_STEP_LABEL: stepLabel ?? "",
      RELEASE_ROUTER: chain.router,
      RELEASE_LOCAL_SELECTOR: chain.ccipSelector,
      RELEASE_REMOTE_CHAIN_ID:
        network === "arbitrum" ? manifest.chains.celo.evmChainId : manifest.chains.arbitrum.evmChainId,
      RELEASE_SOURCE_SELECTOR: manifest.chains.arbitrum.ccipSelector,
      RELEASE_PROTOCOL_VERSION: String(chain.protocolVersion),
      RELEASE_PROTOCOL_GARDEN: manifest.chains.arbitrum.protocolGarden,
      RELEASE_HATS_MODULE: manifest.chains.arbitrum.hatsModule,
      RELEASE_G_DOLLAR: manifest.chains.celo.gDollar,
      RELEASE_POOLING_MODULE: proxy("CommitmentPoolingModule"),
      RELEASE_SETTLEMENT_MODULE: proxy("SettlementModule"),
      RELEASE_ASSESSMENT_V3_SCHEMA_UID: assessmentV3Uid,
    };
    console.log(
      `Running the Bun-wrapped ${stage} ${options.broadcast ? `boundary ${options.releaseStep} preflight` : "simulation"}`,
    );
    try {
      execFileSync("forge", args, { cwd: CONTRACTS_ROOT, stdio: "inherit", env: environment });
    } catch {
      throw new Error(`Bun-wrapped ${stage} ${options.broadcast ? "boundary preflight" : "simulation"} failed`);
    }
    const written = JSON.parse(fs.readFileSync(sidePath, "utf8")) as Record<string, unknown>;
    const canonicalPath = path.join(CONTRACTS_ROOT, "deployments", `${chain.evmChainId}-latest.json`);
    const stagePoolingPaused =
      stage === "pooling" ? poolingPauseStateForStageArtifact(readReleaseArtifactIfPresent(canonicalPath)) : true;
    const expected = predictedSide(lock, stage, stagePoolingPaused);
    for (const key of STAGE_KEYS[stage].filter(
      (ownedKey) => !ownedKey.endsWith("Libraries") && ownedKey !== "commitmentPoolingModulePaused",
    )) {
      const actual = written[key];
      const predicted = expected[key];
      if (typeof actual !== "string" || typeof predicted !== "string" || getAddress(actual) !== getAddress(predicted)) {
        throw new Error(`Bun-wrapped ${stage} output disagrees with the frozen identity for ${key}`);
      }
    }
    // Composite simulations may also write prerequisite-stage keys. Persist only the exact keys
    // owned by the requested stage, and source library maps from the one reviewed lock.
    writeGenerated(sidePath, expected);
    if (!options.broadcast) return undefined;
    if (!stepLabel || options.expectedNonce === undefined) {
      throw new Error("Release boundary execution requires an exact label and nonce");
    }
    const broadcastPath = getFoundryBroadcastPath(
      "DeployCommitmentRelease.s.sol",
      chain.evmChainId,
      "dry-run",
      "run-latest.json",
    );
    if (!fs.existsSync(broadcastPath)) throw new Error(`Foundry transaction artifact not found: ${broadcastPath}`);
    const artifact = JSON.parse(fs.readFileSync(broadcastPath, "utf8")) as {
      transactions?: Array<{
        transaction?: { from?: unknown; to?: unknown; nonce?: unknown; value?: unknown; input?: unknown };
      }>;
    };
    if (artifact.transactions?.length !== 1) {
      throw new Error(`Expected one release boundary transaction, found ${artifact.transactions?.length ?? 0}`);
    }
    const transaction = artifact.transactions[0].transaction;
    if (
      typeof transaction?.from !== "string" ||
      typeof transaction.to !== "string" ||
      typeof transaction.input !== "string" ||
      !isAddress(transaction.from) ||
      !isAddress(transaction.to) ||
      !transaction.input.startsWith("0x")
    ) {
      throw new Error("Foundry release boundary transaction is incomplete");
    }
    const plannedNonce =
      typeof transaction.nonce === "string" && /^0x[0-9a-f]+$/iu.test(transaction.nonce)
        ? Number(BigInt(transaction.nonce))
        : Number(transaction.nonce);
    if (
      getAddress(transaction.from) !== getAddress(manifest.ownership.deploymentSender) ||
      plannedNonce !== options.expectedNonce ||
      BigInt(String(transaction.value ?? "0x0")) !== 0n
    ) {
      throw new Error("Foundry release boundary sender, nonce, or value differs from the reviewed boundary");
    }
    const boundary = buildStageTransactionPlan(manifest, lock, stage, readDeployment(chain.evmChainId), baseSalt)
      .transactions[options.releaseStep! - 1];
    if (!boundary || getAddress(transaction.to) !== getAddress(boundary.to)) {
      throw new Error("Foundry release boundary target differs from the reviewed plan");
    }
    if (boundary.kind === "configuration") {
      if (!boundary.calldata || transaction.input.toLowerCase() !== boundary.calldata.toLowerCase()) {
        throw new Error("Foundry release boundary calldata differs from the reviewed plan");
      }
    } else {
      const salt = `0x${transaction.input.slice(2, 66)}`;
      const initCode = `0x${transaction.input.slice(66)}`;
      if (
        !boundary.salt ||
        !boundary.creationCodeHash ||
        salt.toLowerCase() !== boundary.salt.toLowerCase() ||
        keccak256(initCode).toLowerCase() !== boundary.creationCodeHash.toLowerCase()
      ) {
        throw new Error("Foundry release boundary CREATE2 identity differs from the reviewed plan");
      }
    }
    const pendingNonce = Number(
      execCastCaptured(
        [
          "nonce",
          manifest.ownership.deploymentSender,
          "--block",
          "pending",
          "--rpc-url",
          this.networkManager.getRpcUrl(network),
        ],
        { cwd: CONTRACTS_ROOT, env: buildReadOnlyCastEnv() },
        "Cast pending nonce",
      ).trim(),
    );
    if (pendingNonce !== options.expectedNonce) {
      throw new Error(
        `Nonce drift after simulation: expected ${options.expectedNonce}, live pending nonce is ${pendingNonce}`,
      );
    }
    const transactionHash = parseCastTransactionHash(
      execCastCaptured(
        [
          "send",
          getAddress(transaction.to),
          transaction.input,
          "--chain",
          chain.evmChainId,
          "--nonce",
          String(options.expectedNonce),
          "--account",
          manifest.ownership.deploymentKeystore,
          "--rpc-url",
          this.networkManager.getRpcUrl(network),
          "--json",
        ],
        { cwd: CONTRACTS_ROOT, env: process.env, inputStdio: "inherit" },
        "Bun-wrapped release boundary",
      ),
      "Bun-wrapped release boundary",
    );
    return transactionHash;
  }

  private async verifyReleaseReceipt(
    network: "arbitrum" | "celo",
    manifest: ReleaseManifest,
    boundary: ReturnType<typeof buildStageTransactionPlan>["transactions"][number],
    transactionHash: string,
    expectedNonce: number,
  ): Promise<{ blockNumber: number }> {
    const chainId = Number(manifest.chains[network].evmChainId);
    const provider = new JsonRpcProvider(this.networkManager.getRpcUrl(network), chainId, { staticNetwork: true });
    const { transaction, receipt } = await retryRpcAvailability(
      async () => {
        const [transaction, receipt] = await Promise.all([
          provider.getTransaction(transactionHash),
          provider.getTransactionReceipt(transactionHash),
        ]);
        return transaction && receipt ? { transaction, receipt } : undefined;
      },
      {
        unavailableMessage: `Release receipt ${transactionHash} remained unavailable`,
        onRetry: (attempt) => console.warn(`Release receipt has not propagated; retrying after attempt ${attempt}/6`),
      },
    );
    if (receipt.status !== 1) {
      throw new Error(`Release receipt ${transactionHash} failed`);
    }
    if (
      getAddress(transaction.from) !== getAddress(manifest.ownership.deploymentSender) ||
      !transaction.to ||
      getAddress(transaction.to) !== getAddress(boundary.to) ||
      transaction.nonce !== expectedNonce ||
      transaction.value !== 0n
    ) {
      throw new Error(`Release receipt ${transactionHash} sender, target, or nonce differs from the reviewed boundary`);
    }
    if (boundary.kind === "configuration") {
      if (!boundary.calldata || transaction.data.toLowerCase() !== boundary.calldata.toLowerCase()) {
        throw new Error(`Release receipt ${transactionHash} calldata differs from the reviewed configuration`);
      }
    } else {
      if (!boundary.salt || !boundary.creationCodeHash) throw new Error("CREATE2 boundary is missing identity inputs");
      const actualSalt = `0x${transaction.data.slice(2, 66)}`;
      const initCode = `0x${transaction.data.slice(66)}`;
      if (
        actualSalt.toLowerCase() !== boundary.salt.toLowerCase() ||
        keccak256(initCode).toLowerCase() !== boundary.creationCodeHash.toLowerCase()
      ) {
        throw new Error(`Release receipt ${transactionHash} CREATE2 salt or init-code hash differs from the plan`);
      }
    }
    return { blockNumber: receipt.blockNumber };
  }

  private readCheckpoint(filePath: string): ReleaseCheckpoint | undefined {
    if (!fs.existsSync(filePath)) return undefined;
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as ReleaseCheckpoint;
  }

  private assertCheckpoint(
    checkpoint: ReleaseCheckpoint | undefined,
    manifest: ReleaseManifest,
    lock: ReleaseLock,
    stage: ReleaseStage,
    network: "arbitrum" | "celo",
    baseSalt: string,
    nextStep: number,
    transactions: ReadonlyArray<ReleaseTransactionBoundary>,
  ): void {
    if (!checkpoint) {
      if (nextStep !== 1) throw new Error(`Boundary ${nextStep} is blocked until boundary 1 has a verified checkpoint`);
      return;
    }
    if (
      checkpoint.schemaVersion !== 1 ||
      checkpoint.releaseId !== manifest.releaseId ||
      checkpoint.manifestHash !== lock.manifestHash ||
      checkpoint.stage !== stage ||
      checkpoint.network !== network ||
      checkpoint.baseSalt !== baseSalt
    ) {
      throw new Error("Release checkpoint does not match the exact manifest, salt, stage, or chain");
    }
    validateReleaseCheckpointPrefix(checkpoint, transactions, nextStep);
  }

  private async assertLiveNonce(
    options: ParsedOptions,
    manifest: ReleaseManifest,
    network: "arbitrum" | "celo",
  ): Promise<void> {
    if (options.expectedNonce === undefined) throw new Error("Missing expected nonce");
    const chain = manifest.chains[network];
    const provider = new JsonRpcProvider(this.networkManager.getRpcUrl(network), Number(chain.evmChainId), {
      staticNetwork: true,
    });
    const liveNetwork = await provider.getNetwork();
    if (liveNetwork.chainId.toString() !== chain.evmChainId) {
      throw new Error(`Wrong RPC chain: expected ${chain.evmChainId}, received ${liveNetwork.chainId}`);
    }
    const pendingNonce = await provider.getTransactionCount(manifest.ownership.deploymentSender, "pending");
    if (pendingNonce !== options.expectedNonce) {
      throw new Error(`Nonce drift: expected ${options.expectedNonce}, live pending nonce is ${pendingNonce}`);
    }
  }

  private async resolveSimulationBlock(network: "arbitrum" | "celo", manifest: ReleaseManifest): Promise<number> {
    const chain = manifest.chains[network];
    const provider = new JsonRpcProvider(this.networkManager.getRpcUrl(network), Number(chain.evmChainId), {
      staticNetwork: true,
    });
    const liveNetwork = await provider.getNetwork();
    if (liveNetwork.chainId.toString() !== chain.evmChainId) {
      throw new Error(`Wrong RPC chain: expected ${chain.evmChainId}, received ${liveNetwork.chainId}`);
    }
    if (network === "celo") {
      const push0Result = await provider.call({ data: "0x5f00" });
      if (push0Result !== "0x") throw new Error(`Celo RPC did not execute the EIP-3855 PUSH0 probe: ${push0Result}`);
      console.log("Celo EIP-3855 preflight passed against the selected live RPC");
    }
    const finalized = await provider.getBlock("finalized");
    if (!finalized) throw new Error(`${network} RPC did not return a finalized block for deterministic simulation`);
    console.log(`Simulation fork pinned to finalized ${network} block ${finalized.number}`);
    return finalized.number;
  }

  private runBoundaryVerifier(
    options: ParsedOptions,
    stage: ReleaseStage,
    boundaryIndex: number,
    artifactPath: string,
    baseSalt: string,
  ): void {
    retryPostStateVerification(
      () =>
        execFileSync(
          "bun",
          [
            "script/release-verify.ts",
            "--network",
            options.network,
            "--stage",
            stage,
            "--boundary-index",
            String(boundaryIndex),
            "--artifact",
            artifactPath,
            "--salt",
            baseSalt,
          ],
          { cwd: CONTRACTS_ROOT, stdio: "inherit", env: buildReadOnlyCastEnv() },
        ),
      {
        onRetry: (attempt) =>
          console.warn(`Post-state verification has not propagated; retrying after attempt ${attempt}/6`),
      },
    );
  }

  private runStageVerifier(options: ParsedOptions, stage: ReleaseStage, artifactPath: string, baseSalt: string): void {
    retryPostStateVerification(
      () =>
        execFileSync(
          "bun",
          [
            "script/release-verify.ts",
            "--network",
            options.network,
            "--stage",
            stage,
            "--artifact",
            artifactPath,
            "--salt",
            baseSalt,
          ],
          { cwd: CONTRACTS_ROOT, stdio: "inherit", env: buildReadOnlyCastEnv() },
        ),
      {
        onRetry: (attempt) =>
          console.warn(`Stage verification has not propagated; retrying after attempt ${attempt}/6`),
      },
    );
  }

  private async safePlan(options: ParsedOptions, manifest: ReleaseManifest, lock: ReleaseLock): Promise<void> {
    if (options.network !== "celo") throw new Error("safe-plan requires --network celo");
    if (options.broadcast) {
      throw new Error(
        "safe-plan only produces a reviewed plan; Safe authority broadcasts through the release operator",
      );
    }
    const executor = identity(lock, "CeloSettlementExecutor", "proxy").address;
    const liveEvidence: Record<string, unknown> = {
      inspected: false,
      protocolSafeArbitrum: null,
      protocolSafeCelo: null,
      recoverySafeCelo: null,
      safeSingletonCelo: null,
      safeFactoryCelo: null,
    };
    const liveBlockers: string[] = [];
    const approvedSafe = manifest.ownership.protocolSafeConfiguration;
    if (!options.pureSimulation) {
      const safeAbi = [
        "function getOwners() view returns (address[])",
        "function getThreshold() view returns (uint256)",
      ];
      const inspectCode = async (provider: JsonRpcProvider, label: string, address: string) => {
        const code = await provider.getCode(address, "finalized");
        const present = code !== "0x";
        if (!present) liveBlockers.push(`${label} has no code at ${address}`);
        return { address, codePresent: present, codeHash: present ? keccak256(code) : null };
      };
      const arbitrum = new JsonRpcProvider(
        this.networkManager.getRpcUrl("arbitrum"),
        Number(manifest.chains.arbitrum.evmChainId),
        { staticNetwork: true },
      );
      const celo = new JsonRpcProvider(this.networkManager.getRpcUrl("celo"), Number(manifest.chains.celo.evmChainId), {
        staticNetwork: true,
      });
      const [arbitrumNetwork, celoNetwork] = await Promise.all([arbitrum.getNetwork(), celo.getNetwork()]);
      if (arbitrumNetwork.chainId.toString() !== manifest.chains.arbitrum.evmChainId) {
        throw new Error(`Wrong Arbitrum RPC chain ${arbitrumNetwork.chainId}`);
      }
      if (celoNetwork.chainId.toString() !== manifest.chains.celo.evmChainId) {
        throw new Error(`Wrong Celo RPC chain ${celoNetwork.chainId}`);
      }
      const protocolArbitrumCode = await inspectCode(
        arbitrum,
        "protocol Safe on Arbitrum",
        manifest.ownership.protocolSafe,
      );
      let protocolArbitrum: Record<string, unknown> = protocolArbitrumCode;
      if (protocolArbitrumCode.codePresent) {
        const safe = new Contract(manifest.ownership.protocolSafe, safeAbi, arbitrum);
        const [owners, threshold] = await Promise.all([safe.getOwners(), safe.getThreshold()]);
        protocolArbitrum = {
          ...protocolArbitrumCode,
          owners: (owners as string[]).map(getAddress),
          threshold: String(threshold),
        };
        const liveOwners = new Set((owners as string[]).map((owner) => getAddress(owner).toLowerCase()));
        const approvedOwners = new Set(approvedSafe.owners.map((owner) => getAddress(owner).toLowerCase()));
        const ownerSetMatches =
          liveOwners.size === approvedOwners.size && [...approvedOwners].every((owner) => liveOwners.has(owner));
        if (BigInt(threshold) !== BigInt(approvedSafe.threshold) || !ownerSetMatches) {
          liveBlockers.push(
            `protocol Safe Arbitrum configuration is ${String(threshold)}-of-${(owners as string[]).length}, ` +
              `expected the exact approved ${approvedSafe.threshold}-of-${approvedSafe.owners.length} owner set`,
          );
        }
      }
      liveEvidence.inspected = true;
      liveEvidence.protocolSafeArbitrum = protocolArbitrum;
      liveEvidence.protocolSafeCelo = await inspectCode(celo, "protocol Safe on Celo", manifest.ownership.protocolSafe);
      liveEvidence.recoverySafeCelo = await inspectCode(
        celo,
        "garden recovery Safe on Celo",
        manifest.ownership.gardenRecoveryOwner,
      );
      liveEvidence.safeSingletonCelo = await inspectCode(
        celo,
        "Safe singleton on Celo",
        manifest.safeAuthority.safeSingleton,
      );
      liveEvidence.safeFactoryCelo = await inspectCode(
        celo,
        "Safe proxy factory on Celo",
        manifest.safeAuthority.safeFactory,
      );
    }
    const plan = {
      schemaVersion: 1,
      enabled: manifest.safeAuthority.enabled,
      executor,
      executorMustNotBeOwner: true,
      requiredRecoveryOwner: manifest.ownership.gardenRecoveryOwner,
      singleton: manifest.safeAuthority.safeSingleton,
      factory: manifest.safeAuthority.safeFactory,
      gardenSafes: manifest.safeAuthority.gardenSafes,
      zodiacRoles: manifest.safeAuthority.zodiacRoles,
      caps: manifest.safeAuthority.caps,
      feePolicy: manifest.safeAuthority.feePolicy,
      transactions: [],
      liveEvidence,
      liveBlockers,
      // Before the ceremony this listed the authority facts still to be frozen. Once the manifest
      // records them, the honest list is the activation gates that remain in front of value.
      blockedUntil: manifest.safeAuthority.enabled
        ? [
            "protocol ownership transferred to the approved Safe on each chain (tier 3)",
            "Arbitrum setCcipRoute sent by the protocol Safe and receipt-verified",
            "message-only ping/ack round trip",
            "minimum-value settlement canary",
            "separate human authorization for each step",
          ]
        : [
            "exact garden Safe owners and threshold",
            "exact recovery configuration",
            "Zodiac Roles modifier address, role key, allowance key, and condition-tree hash",
            "non-zero transfer, batch, period, and fee caps",
            "separate human authorization",
          ],
    };
    const filePath = path.join(GENERATED_ROOT, manifest.releaseId, "celo", "safe-zodiac-plan.json");
    writeGenerated(filePath, plan);
    console.log(stable(plan));
    console.log(`Inert Safe/Zodiac plan written: ${filePath}`);
    if (liveBlockers.length > 0) {
      throw new Error(`Safe/Zodiac preflight blocked: ${liveBlockers.join("; ")}`);
    }
  }

  private peerPlan(options: ParsedOptions, manifest: ReleaseManifest, lock: ReleaseLock): void {
    if (options.network !== "arbitrum" && options.network !== "celo") {
      throw new Error("settlement-peer requires --network arbitrum|celo");
    }
    // The Celo source peer was set by the executor's initializer and is a completed tier-3
    // boundary. ceremony.peerWiringIncluded authorizes only the remaining Arbitrum route, and
    // settlement-peer-verify proves only that, so a Celo plan would be executable calldata for a
    // mutation with no authorization and no receipt-backed proof path. Refuse to emit it.
    if (options.network === "celo") {
      throw new Error(
        "Celo source peer is already configured and is outside this ceremony; peer wiring authorizes only the Arbitrum route",
      );
    }
    // The authorization gate sits in front of plan generation, not only the broadcast branch: the
    // supported execution path is "send the planned calldata", so an unauthorized ceremony must not
    // be able to emit executable calldata at all.
    if (!manifest.ceremony.peerWiringIncluded) {
      throw new Error(
        "Peer wiring is not authorized by this ceremony; set ceremony.peerWiringIncluded in the reviewed manifest first",
      );
    }
    if (options.broadcast) {
      // There is deliberately no operator broadcast path for peer wiring. It is one owner-gated
      // configuration call sent by the protocol Safe, and it is proven afterwards by
      // `settlement-peer-verify` against the mined receipt rather than through a second boundary engine.
      throw new Error(
        "Peer wiring executes as one reviewed protocol Safe transaction; send the planned calldata, then run settlement-peer-verify --receipt <tx-hash>",
      );
    }
    const gas = process.env.SETTLEMENT_DESTINATION_GAS_LIMIT;
    if (!gas) throw new Error("Set SETTLEMENT_DESTINATION_GAS_LIMIT to the measured non-zero uint32 value");
    const plan = buildPeerTransactionPlan(manifest, lock, BigInt(gas), options.network);
    const filePath = path.join(GENERATED_ROOT, manifest.releaseId, options.network, "settlement-peer-plan.json");
    writeGenerated(filePath, plan);
    console.log(stable(plan));
    console.log(`Peer plan written: ${filePath}`);
  }

  /**
   * Proves a peer-wiring transaction landed exactly as reviewed, and persists that proof.
   *
   * This is the evidence half of the split described in `peerPlan`. It is receipt-bound: the mined
   * transaction must have succeeded and must contain the module's own `CcipRouteUpdated` event with
   * the reviewed values, which binds the proof to the specific write rather than to whatever the
   * route happens to read as afterwards. Because the Safe executes the call internally, the event
   * is the stable binding point whether the outer transaction came from a Safe or a bare owner.
   * The live route on Arbitrum and the live peer and pause state on Celo are then re-read, so a
   * correct write followed by a bad later mutation cannot pass either.
   */
  private async peerVerify(options: ParsedOptions, manifest: ReleaseManifest, lock: ReleaseLock): Promise<void> {
    if (options.network !== "arbitrum") throw new Error("settlement-peer-verify supports only --network arbitrum");
    if (!manifest.ceremony.peerWiringIncluded) {
      throw new Error("Peer wiring is not authorized by this ceremony; nothing to verify");
    }
    if (!options.receiptHash || !/^0x[0-9a-f]{64}$/iu.test(options.receiptHash)) {
      throw new Error("settlement-peer-verify requires --receipt <tx-hash> for the mined peer-wiring transaction");
    }
    const settlement = identity(lock, "SettlementModule", "proxy").address;
    const executor = identity(lock, "CeloSettlementExecutor", "proxy").address;
    const expectedSelector = BigInt(manifest.chains.celo.ccipSelector);
    const expectedGasLimit = BigInt(manifest.chains.arbitrum.destinationGasLimit ?? "0");
    const expectedVersion = BigInt(manifest.chains.celo.protocolVersion);
    if (expectedGasLimit === 0n) throw new Error("chains.arbitrum.destinationGasLimit must be frozen before verifying");

    const arbitrumChainId = Number(manifest.chains.arbitrum.evmChainId);
    const celoChainId = Number(manifest.chains.celo.evmChainId);
    const arbitrum = new JsonRpcProvider(this.networkManager.getRpcUrl("arbitrum"), arbitrumChainId, {
      staticNetwork: true,
    });
    const celo = new JsonRpcProvider(this.networkManager.getRpcUrl("celo"), celoChainId, { staticNetwork: true });
    const routeEvent = new Interface([
      "event CcipRouteUpdated(uint64 indexed destinationChainSelector, address indexed destinationExecutor, address indexed previousDestinationExecutor, uint64 previousPeerExpiresAt, uint32 destinationGasLimit, uint8 protocolVersion)",
    ]);
    const module_ = new Contract(
      settlement,
      [
        "function ccipRoute() view returns ((uint64 destinationChainSelector, address destinationExecutor, address previousDestinationExecutor, uint64 previousPeerExpiresAt, uint32 destinationGasLimit, uint8 protocolVersion))",
        "function paused() view returns (bool)",
      ],
      arbitrum,
    );
    const celoExecutor = new Contract(
      executor,
      [
        "function sourcePeer() view returns ((uint64 sourceChainSelector, address sourceSettlementModule, address previousSourceSettlementModule, uint64 previousPeerExpiresAt, uint8 protocolVersion))",
        "function paused() view returns (bool)",
      ],
      celo,
    );

    const receiptHash = options.receiptHash;
    // The receipt is read on its own: retryRpcAvailability retries only an undefined result, and a
    // Promise.all array is always defined, so bundling it would turn a not-yet-propagated receipt
    // into an immediate failure instead of the bounded retry the operator is promised.
    const receipt = await retryRpcAvailability(
      async () => (await arbitrum.getTransactionReceipt(receiptHash)) ?? undefined,
      { unavailableMessage: `Receipt ${receiptHash} is not mined on Arbitrum` },
    );
    const ownerAtReceipt = getAddress(
      await new Contract(settlement, ownableInterface, arbitrum).owner({ blockTag: receipt.blockNumber }),
    );
    const [route, arbitrumPaused, ownerNow, sourcePeer, celoPaused] = await retryRpcAvailability(async () =>
      Promise.all([
        module_.ccipRoute(),
        module_.paused(),
        new Contract(settlement, ownableInterface, arbitrum).owner(),
        celoExecutor.sourcePeer(),
        celoExecutor.paused(),
      ]),
    );

    // The binding event: the module itself must have announced exactly the reviewed route.
    const routeLog = receipt.logs
      .filter((log) => getAddress(log.address) === getAddress(settlement))
      .map((log) => {
        try {
          return routeEvent.parseLog({ topics: [...log.topics], data: log.data });
        } catch {
          return null;
        }
      })
      .find((parsed) => parsed?.name === "CcipRouteUpdated");
    const eventSelector = routeLog ? BigInt(routeLog.args.destinationChainSelector) : null;
    const eventExecutor = routeLog ? getAddress(String(routeLog.args.destinationExecutor)) : null;
    const eventGasLimit = routeLog ? BigInt(routeLog.args.destinationGasLimit) : null;
    const eventVersion = routeLog ? BigInt(routeLog.args.protocolVersion) : null;
    const eventGrace = routeLog ? BigInt(routeLog.args.previousPeerExpiresAt) : null;

    const checks: Array<[string, boolean, string]> = [
      ["receipt succeeded", receipt.status === 1, String(receipt.status)],
      [
        "receipt emitted CcipRouteUpdated from the module",
        routeLog !== undefined && routeLog !== null,
        routeLog ? "yes" : "no",
      ],
      ["event destination selector", eventSelector === expectedSelector, String(eventSelector)],
      ["event destination executor", eventExecutor === getAddress(executor), String(eventExecutor)],
      ["event destination gas limit", eventGasLimit === expectedGasLimit, String(eventGasLimit)],
      ["event protocol version", eventVersion === expectedVersion, String(eventVersion)],
      ["event retiring-peer grace is zero", eventGrace === 0n, String(eventGrace)],
      [
        "live destination selector",
        BigInt(route.destinationChainSelector) === expectedSelector,
        String(route.destinationChainSelector),
      ],
      [
        "live destination executor",
        getAddress(route.destinationExecutor) === getAddress(executor),
        String(route.destinationExecutor),
      ],
      [
        "live destination gas limit",
        BigInt(route.destinationGasLimit) === expectedGasLimit,
        String(route.destinationGasLimit),
      ],
      ["live protocol version", BigInt(route.protocolVersion) === expectedVersion, String(route.protocolVersion)],
      [
        "live retiring-peer grace is zero",
        BigInt(route.previousPeerExpiresAt) === 0n,
        String(route.previousPeerExpiresAt),
      ],
      ["Arbitrum module still paused", arbitrumPaused === true, String(arbitrumPaused)],
      // Tier 3 requires the protocol Safe to own the module when the route is written. Reading the
      // owner at the receipt block proves the ordering; a route wired by the deployment EOA before
      // transfer fails here even though ownership moved afterwards.
      [
        "module owned by the protocol Safe at the receipt block",
        ownerAtReceipt === getAddress(manifest.ownership.protocolSafe),
        ownerAtReceipt,
      ],
      [
        "module still owned by the protocol Safe",
        getAddress(ownerNow) === getAddress(manifest.ownership.protocolSafe),
        String(ownerNow),
      ],
      ["Celo executor still paused", celoPaused === true, String(celoPaused)],
      [
        "Celo source peer still the frozen module",
        getAddress(sourcePeer.sourceSettlementModule) === getAddress(settlement),
        String(sourcePeer.sourceSettlementModule),
      ],
      [
        "Celo source selector still Arbitrum",
        BigInt(sourcePeer.sourceChainSelector) === BigInt(manifest.chains.arbitrum.ccipSelector),
        String(sourcePeer.sourceChainSelector),
      ],
      // A retiring previous peer stays authenticated until its grace expires, so the whole struct
      // has to be clean, not just the current module.
      [
        "Celo has no retiring previous source peer",
        getAddress(sourcePeer.previousSourceSettlementModule) === ZeroAddress,
        String(sourcePeer.previousSourceSettlementModule),
      ],
      [
        "Celo previous-peer grace is zero",
        BigInt(sourcePeer.previousPeerExpiresAt) === 0n,
        String(sourcePeer.previousPeerExpiresAt),
      ],
      [
        "Celo source protocol version is frozen",
        BigInt(sourcePeer.protocolVersion) === BigInt(manifest.chains.arbitrum.protocolVersion),
        String(sourcePeer.protocolVersion),
      ],
    ];
    const failed = checks.filter(([, ok]) => !ok);
    for (const [label, ok, actual] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${label}: ${actual}`);
    if (failed.length > 0) {
      throw new Error(`Peer wiring does not match the reviewed plan: ${failed.map(([label]) => label).join(", ")}`);
    }

    // Persist the proof so the next boundary can require it instead of trusting a console line.
    const checkpointPath = path.join(GENERATED_ROOT, manifest.releaseId, "arbitrum", "settlement-peer.checkpoint.json");
    writeGenerated(checkpointPath, {
      schemaVersion: 1,
      releaseId: manifest.releaseId,
      manifestHash: lock.manifestHash,
      stage: "settlement-peer",
      network: "arbitrum",
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      from: getAddress(receipt.from),
      to: receipt.to ? getAddress(receipt.to) : null,
      moduleOwnerAtReceipt: ownerAtReceipt,
      settlementModule: getAddress(settlement),
      destinationExecutor: getAddress(executor),
      destinationChainSelector: expectedSelector.toString(),
      destinationGasLimit: expectedGasLimit.toString(),
      protocolVersion: expectedVersion.toString(),
      verifiedAt: new Date().toISOString(),
    });
    console.log(`Peer wiring verified against the frozen plan on ${manifest.releaseId}`);
    console.log(`Peer wiring checkpoint written: ${checkpointPath}`);
  }

  private recoveryPlan(options: ParsedOptions, manifest: ReleaseManifest, lock: ReleaseLock): void {
    const network = options.network === "celo" ? "celo" : "arbitrum";
    if (options.broadcast) throw new Error("Artifact recovery never broadcasts a transaction");
    const stage = options.releaseStage as ReleaseStage | undefined;
    if (stage && (!STAGE_KEYS[stage] || STAGE_NETWORK[stage] !== network)) {
      throw new Error(`Recovery stage ${stage} does not belong to --network ${network}`);
    }
    const candidates = lock.identities.filter((item) => item.network === network && (!stage || item.stage === stage));
    const plan = {
      schemaVersion: 1,
      network,
      stage: stage ?? "all",
      chainId: manifest.chains[network].evmChainId,
      readOnlyFirst: true,
      identities: candidates.map(
        ({ name, kind, address, creationCodeHash, runtimeTemplateHash, immutableRuntime }) => ({
          name,
          kind,
          address,
          creationCodeHash,
          runtimeTemplateHash,
          immutableRuntime,
        }),
      ),
      recoveryRule:
        "Reread code, proxy implementation, owner, immutables, initializer, and pause state. Reconstruct only exact owned keys; a different hash or address is a hard conflict.",
      canonicalArtifactMutation: false,
      nextCommand: stage
        ? `bun run release:recover:${network} --stage ${stage} --save-artifacts`
        : `bun run release:recover:${network} --stage <exact-stage> --dry-run`,
    };
    const filePath = path.join(GENERATED_ROOT, manifest.releaseId, network, "recovery-plan.json");
    writeGenerated(filePath, plan);
    console.log(stable(plan));
    console.log(`Recovery plan written: ${filePath}`);
    if (!stage) return;

    const chainId = manifest.chains[network].evmChainId;
    const canonicalPath = path.join(CONTRACTS_ROOT, "deployments", `${chainId}-latest.json`);
    const sidePath = path.join(GENERATED_ROOT, manifest.releaseId, network, `${chainId}-${stage}-recovery.json`);
    const canonicalArtifact = JSON.parse(fs.readFileSync(canonicalPath, "utf8")) as Record<string, unknown>;
    const recovered = predictedSide(
      lock,
      stage,
      stage === "pooling" ? poolingPauseStateForRecovery(canonicalArtifact) : true,
    );
    writeGenerated(sidePath, recovered);
    const simulated = simulateReleaseArtifactMerge({
      canonicalPath,
      sidePath,
      ownedKeys: STAGE_KEYS[stage],
    });
    console.log(`Recovery promotion simulation preserved canonical history; would change: ${simulated.changed}`);
    if (!options.saveArtifacts) return;

    this.runStageVerifier(options, stage, sidePath, `${manifest.create2.domain}:${manifest.create2.version}`);
    const promoted = recoverReleaseArtifact({ canonicalPath, sidePath, ownedKeys: STAGE_KEYS[stage] }, recovered);
    console.log(`Verified recovery promoted atomically; canonical changed: ${promoted.changed}`);
  }

  private runVerifier(options: ParsedOptions): void {
    const args = ["script/release-verify.ts", "--network", options.network];
    if (options.pureSimulation) args.push("--pure-simulation");
    if (options.releaseStage) args.push("--stage", options.releaseStage);
    if (options.releaseStep) args.push("--boundary-index", String(options.releaseStep));
    if (options.artifactPath) args.push("--artifact", options.artifactPath);
    if (options.releaseOwnerPhase) args.push("--owner-phase", options.releaseOwnerPhase);
    if (options.deploymentSalt) args.push("--salt", options.deploymentSalt);
    execFileSync("bun", args, { cwd: CONTRACTS_ROOT, stdio: "inherit", env: buildReadOnlyCastEnv() });
  }

  private indexerHandoff(options: ParsedOptions, manifest: ReleaseManifest, lock: ReleaseLock): void {
    if (options.broadcast || manifest.indexer.activationAuthorized) {
      throw new Error("Phase A indexer handoff is inert and may not activate production addresses");
    }
    const settlement = identity(lock, "SettlementModule", "proxy").address;
    const executor = identity(lock, "CeloSettlementExecutor", "proxy").address;
    const settlementReceipt = releaseReceiptForIndexer(
      readDeployment(manifest.chains.arbitrum.evmChainId),
      "settlementModule",
    );
    const executorReceipt = releaseReceiptForIndexer(
      readDeployment(manifest.chains.celo.evmChainId),
      "celoSettlementExecutor",
    );
    const plan = {
      schemaVersion: 1,
      activationAuthorized: false,
      config: "packages/indexer/config.yaml",
      boundary: "Green Goods SettlementModule and CeloSettlementExecutor events only; never raw G$ Transfer",
      diff: [
        {
          chainId: "42161",
          contract: "SettlementModule",
          address: settlement,
          startBlock: settlementReceipt.blockNumber,
          deploymentTransactionHash: settlementReceipt.transactionHash,
        },
        {
          chainId: "42220",
          contract: "CeloSettlementExecutor",
          address: executor,
          startBlock: executorReceipt.blockNumber,
          deploymentTransactionHash: executorReceipt.transactionHash,
        },
      ],
      ownerLane: manifest.indexer.ownerLane,
      handoffOnly: manifest.indexer.handoffOnly,
      productionState: "The hosted production indexer is an older release and is intentionally unchanged here.",
      nextAction:
        "PRD-722 owns config/codegen/reindex/cutover/read-back and must consume this exact address/start-block diff after contract receipts verify.",
      commands: [],
    };
    const filePath = path.join(GENERATED_ROOT, manifest.releaseId, "indexer-handoff.json");
    writeGenerated(filePath, plan);
    console.log(stable(plan));
    console.log(`Inert indexer handoff written: ${filePath}`);
  }

  private assertSender(command: string, options: ParsedOptions, manifest: ReleaseManifest): void {
    // Peer wiring is a tier-3 boundary (packages/contracts/AGENTS.md, "Mainnet Requirements by
    // Activation Risk"), so it is always sent by the protocol Safe; the deployment sender is never
    // an acceptable peer-wiring sender, even while it still happens to own the module.
    const expected =
      command === "settlement-peer" ? manifest.ownership.protocolSafe : manifest.ownership.deploymentSender;
    const sender = options.sender ?? expected;
    if (getAddress(sender) !== getAddress(expected)) {
      throw new Error(`Wrong sender: expected ${expected}, received ${sender}`);
    }
  }
}
