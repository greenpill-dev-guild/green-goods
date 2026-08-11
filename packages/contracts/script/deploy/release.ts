import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { Contract, getAddress, Interface, isAddress, JsonRpcProvider, keccak256 } from "ethers";
import type { ParsedOptions } from "../utils/cli-parser";
import {
  mergeReleaseArtifact,
  recoverReleaseArtifact,
  simulateReleaseArtifactMerge,
  writeReleaseJsonAtomic,
} from "../utils/release-artifacts";
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
import { buildPeerTransactionPlan, buildStageTransactionPlan } from "../utils/release-plan";
import { NetworkManager } from "../utils/network";
import { getFoundryBroadcastPath } from "../utils/paths";
import { assertSepoliaGate } from "../utils/release-gate";

const LOCK_PATH = path.join(CONTRACTS_ROOT, "config/commitment-pooling-release.lock.json");
const GENERATED_ROOT = path.join(CONTRACTS_ROOT, ".generated/release");

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

function stable(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function writeGenerated(filePath: string, value: unknown): void {
  writeReleaseJsonAtomic(filePath, value as Record<string, unknown>);
}

interface ReleaseCheckpoint {
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

interface OwnershipTransferPlan {
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

interface OwnershipCheckpoint {
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

const ownableInterface = new Interface([
  "function owner() view returns (address)",
  "function transferOwnership(address newOwner)",
]);

function readDeployment(chainId: string): Record<string, unknown> {
  const filePath = path.join(CONTRACTS_ROOT, "deployments", `${chainId}-latest.json`);
  if (!fs.existsSync(filePath)) throw new Error(`Canonical deployment artifact not found: ${filePath}`);
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

function identity(lock: ReleaseLock, name: string, kind: "implementation" | "proxy") {
  const result = lock.identities.find((candidate) => candidate.name === name && candidate.kind === kind);
  if (!result) throw new Error(`Release lock has no ${kind} identity for ${name}`);
  return result;
}

function predictedSide(lock: ReleaseLock, stage: ReleaseStage): Record<string, unknown> {
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
  return result;
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
  ownership-transfer      Plan/execute one owner transfer boundary to the frozen protocol Safe
  settlement-module       Deploy/plan the paused Arbitrum SettlementModule candidate
  credit-registry         Deploy/plan the paused records-only CreditRegistry and exact binding
  settlement-executor     Deploy/plan the paused Celo executor (only --network celo is supported)
  safe-plan               Validate the inert Safe/Zodiac authority plan; emits no transactions
  settlement-peer         Plan peer wiring after fresh bidirectional lane proof
  release-recover         Print the recovery command and exact expected identities
  release-verify          Run the release post-deploy verifier (read-only)
  indexer-handoff         Produce an inert Envio address/start-block activation plan

Release options:
  --network <name>        Exact target network (arbitrum or celo as documented above)
  --dry-run               Run the Foundry simulation through the real script and artifact merge path
  --pure-simulation       Produce the exact RPC-free transaction/persistence plan
  --save-artifacts        With release-manifest, rewrite the reviewed lock file
  --salt <value>          Override the complete CREATE2 base salt; predictions and script both use it
  --sender <address>      Must equal the frozen deployment sender
  --stage <name>          Exact stage for recovery or scoped verification
  --step <index>          Required with --broadcast; executes exactly one transaction boundary
  --expected-nonce <n>    Required with --broadcast; fails closed on pending nonce drift
  --receipt <tx-hash>     Recover a mined boundary after local checkpoint persistence failed
  --artifact <path>       Explicit recovery artifact for verification
  --owner-phase <phase>   Verification owner phase: deployment or safe
  --broadcast             Phase B only; requires separate stage-specific human authorization
  --override-sepolia-gate Keep the repository production-chain gate explicit when authorized

Examples (Phase A, no broadcast):
  bun run release:manifest
  bun run release:core:plan:arbitrum
  bun run settlement:module:plan:arbitrum
  bun run credit:registry:plan:arbitrum
  bun run settlement:executor:plan:celo
  bun run settlement:safe:plan:celo
  bun run release:ownership:plan:arbitrum
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
    console.log(`Protocol Safe/final owner: ${manifest.ownership.protocolSafe}`);
    console.log(`CREATE2 salt base: ${manifest.create2.domain}:${manifest.create2.version}`);
    console.log(`Deterministic identities: ${lock.identities.length} (20 libraries, 5 implementations, 5 proxies)`);
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
    console.log("Safe/Zodiac authority: disabled; no value-authority transaction can be built from this manifest");
    console.log("Indexer activation: disabled; handoff generation is inert");
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
            "actual AssessmentResolver implementation/owner/code hash, final creation-code hash, and rollback calldata",
          nextStageRule: "rebuild this nonce-bound plan immediately before its separately authorized stage",
        },
        {
          index: 2,
          command: "bun run pooling:schemas:plan:arbitrum --expected-nonce <fresh-pending-nonce>",
          outcome: "testimony resolver prediction plus AssessmentV3 preparation; no Community Testimony activation",
        },
        {
          index: 3,
          command: "bun run pooling:deploy:dry:arbitrum",
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
          command: "bun run settlement:module:plan:arbitrum",
          outcome: "paused message-only source candidate; no peer and no value authority",
        },
        {
          index: 6,
          command: "bun run credit:registry:plan:arbitrum",
          outcome: "paused records-only registry plus two-way settlement binding; G$ pool rail remains disabled",
        },
        {
          index: 7,
          command: "bun run pooling:upgrade:plan:arbitrum --expected-nonce <fresh-pending-nonce>",
          outcome:
            "actual GardenToken and WorkApprovalResolver implementations/owners/code hashes, upgrades, reverse wiring, and per-proxy rollback calldata while pooling stays paused",
          nextStageRule:
            "rebuild after earlier receipts; a stale sender nonce invalidates every predicted implementation",
        },
        {
          index: 8,
          command: "bun run release:ownership:plan:arbitrum",
          outcome:
            "one-boundary transfer plan from the verified deployment owner to the frozen protocol Safe for every touched Arbitrum proxy",
          nextStageRule: "each transfer receipt and live owner must verify before the next target",
        },
        {
          index: 9,
          command: "bun run pooling:backfill:dry:arbitrum",
          outcome:
            "fail-closed proof of the live garden inventory and the unresolved frozen-ABI conflict: authorized backfill-before-unpause cannot call registerPool while whenOperational is false",
          nextStageRule:
            "do not emit or authorize an unpause-first workaround and do not change the merged ABI inside release engineering",
        },
      ],
      ownershipTransfer: {
        separatelyAuthorized: true,
        from: manifest.ownership.deploymentSender,
        to: manifest.ownership.protocolSafe,
        rollbackBefore: manifest.ownership.rollbackOwnerBeforeTransfer,
        rollbackAfter: manifest.ownership.rollbackOwnerAfterTransfer,
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

  private async ownershipTransfer(options: ParsedOptions, manifest: ReleaseManifest, lock: ReleaseLock): Promise<void> {
    if (options.network !== "arbitrum" && options.network !== "celo") {
      throw new Error("ownership-transfer supports only --network arbitrum|celo");
    }
    const network = options.network;
    const chainId = Number(manifest.chains[network].evmChainId);
    const deployment = readDeployment(String(chainId));
    const predicted = (name: string) => identity(lock, name, "proxy").address;
    const targets =
      network === "arbitrum"
        ? [
            ["AssessmentResolver", deployment.assessmentResolver],
            ["TestimonyResolver", manifest.schemaPreparation.expected.proxy],
            ["CommitmentPoolingModule", predicted("CommitmentPoolingModule")],
            ["CommitmentRegistry", predicted("CommitmentRegistry")],
            ["GardenToken", deployment.gardenToken],
            ["WorkApprovalResolver", deployment.workApprovalResolver],
            ["SettlementModule", predicted("SettlementModule")],
            ["CreditRegistry", predicted("CreditRegistry")],
          ]
        : [["CeloSettlementExecutor", predicted("CeloSettlementExecutor")]];
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
          "the immediately preceding boundary has a verified receipt checkpoint",
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
      if ((await provider.getCode(plan.finalOwner, finalized.number)) === "0x") {
        throw new Error(
          `Frozen protocol Safe ${plan.finalOwner} has no code on ${network} at block ${finalized.number}`,
        );
      }
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
    if (options.releaseStep > 1 && !checkpoint.completed.some((item) => item.step === options.releaseStep! - 1)) {
      throw new Error(`Ownership boundary ${options.releaseStep - 1} has no verified checkpoint`);
    }
    const prior = checkpoint.completed.find((item) => item.step === options.releaseStep);
    let transactionHash = prior?.transactionHash ?? options.receiptHash;
    if (!transactionHash) {
      const pendingNonce = await provider.getTransactionCount(plan.sender, "pending");
      if (pendingNonce !== options.expectedNonce) {
        throw new Error(`Nonce drift: expected ${options.expectedNonce}, live pending nonce is ${pendingNonce}`);
      }
      const result = JSON.parse(
        execFileSync(
          "cast",
          [
            "send",
            boundary.to,
            boundary.calldata,
            "--chain",
            String(chainId),
            "--nonce",
            String(options.expectedNonce),
            "--account",
            manifest.ownership.deploymentKeystore,
            "--rpc-url",
            this.networkManager.getRpcUrl(network),
            "--json",
          ],
          { cwd: CONTRACTS_ROOT, env: process.env, encoding: "utf8", stdio: ["inherit", "pipe", "inherit"] },
        ),
      ) as Record<string, unknown>;
      if (typeof result.transactionHash !== "string" || !/^0x[0-9a-fA-F]{64}$/u.test(result.transactionHash)) {
        throw new Error("Bun-wrapped ownership boundary returned no transaction hash");
      }
      transactionHash = result.transactionHash;
    }
    const transaction = await provider.getTransaction(transactionHash);
    const receipt = await provider.getTransactionReceipt(transactionHash);
    if (!transaction || !receipt || receipt.status !== 1)
      throw new Error(`Ownership receipt ${transactionHash} is unavailable or failed`);
    if (
      getAddress(transaction.from) !== getAddress(plan.sender) ||
      !transaction.to ||
      getAddress(transaction.to) !== getAddress(boundary.to) ||
      transaction.data.toLowerCase() !== boundary.calldata.toLowerCase() ||
      transaction.nonce !== options.expectedNonce
    ) {
      throw new Error(`Ownership receipt ${transactionHash} differs from the reviewed boundary`);
    }
    const liveOwner = getAddress(await new Contract(boundary.to, ownableInterface, provider).owner());
    if (liveOwner !== getAddress(plan.finalOwner)) throw new Error(`Ownership post-state mismatch at ${boundary.to}`);
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
    if (options.broadcast && !options.dryRun) {
      assertSepoliaGate({
        network: options.network,
        broadcast: true,
        overrideSepoliaGate: options.overrideSepoliaGate,
      });
    }
    const chainId = manifest.chains[expectedNetwork].evmChainId;
    const deployment = readDeployment(chainId);
    const plan = buildStageTransactionPlan(manifest, lock, stage, deployment, baseSalt);
    const directory = path.join(GENERATED_ROOT, manifest.releaseId, expectedNetwork);
    const planPath = path.join(directory, `${stage}-transaction-plan.json`);
    const sidePath = path.join(directory, `${chainId}-${stage}-side.json`);
    const checkpointPath = path.join(directory, `${stage}-checkpoint.json`);
    const canonicalPath = path.join(CONTRACTS_ROOT, "deployments", `${chainId}-latest.json`);
    writeGenerated(planPath, plan);
    writeGenerated(sidePath, predictedSide(lock, stage));
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
      if (!boundary)
        throw new Error("Broadcast requires --step <index>; one invocation may execute exactly one boundary");
      if (options.expectedNonce === undefined) {
        throw new Error("Broadcast requires --expected-nonce <n>; nonce drift must fail closed");
      }
      if (!options.receiptHash) await this.assertLiveNonce(options, manifest, expectedNetwork);
      const checkpoint = this.readCheckpoint(checkpointPath);
      this.assertCheckpoint(checkpoint, manifest, lock, stage, expectedNetwork, baseSalt, boundary.index);
      if (checkpoint && checkpoint.lastVerifiedStep >= boundary.index) {
        const evidence = checkpoint.verifiedBoundaries.find((item) => item.index === boundary!.index);
        if (!evidence) throw new Error(`Boundary ${boundary.index} checkpoint has no receipt evidence`);
        await this.verifyReleaseReceipt(
          expectedNetwork,
          manifest,
          boundary,
          evidence.transactionHash,
          evidence.expectedNonce,
        );
        this.runBoundaryVerifier(options, stage, boundary.index, sidePath, baseSalt);
        console.log(`Boundary ${boundary.index} was already verified; no replay transaction was sent`);
        return;
      }
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
        console.log("Final boundary verified; the exact stage artifact was promoted atomically");
      } else {
        console.log(`Boundary ${boundary.index} verified and checkpointed; canonical artifact remains unchanged`);
      }
    } else {
      const forgedMerge = simulateReleaseArtifactMerge({ canonicalPath, sidePath, ownedKeys: STAGE_KEYS[stage] });
      console.log(`Foundry simulation completed through artifact promotion path; would change: ${forgedMerge.changed}`);
    }
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
      ...process.env,
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
    const expected = predictedSide(lock, stage);
    for (const key of STAGE_KEYS[stage].filter((ownedKey) => !ownedKey.endsWith("Libraries"))) {
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
      execFileSync(
        "cast",
        [
          "nonce",
          manifest.ownership.deploymentSender,
          "--block",
          "pending",
          "--rpc-url",
          this.networkManager.getRpcUrl(network),
        ],
        { cwd: CONTRACTS_ROOT, env: process.env, encoding: "utf8" },
      ).trim(),
    );
    if (pendingNonce !== options.expectedNonce) {
      throw new Error(
        `Nonce drift after simulation: expected ${options.expectedNonce}, live pending nonce is ${pendingNonce}`,
      );
    }
    const result = JSON.parse(
      execFileSync(
        "cast",
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
        { cwd: CONTRACTS_ROOT, env: process.env, encoding: "utf8", stdio: ["inherit", "pipe", "inherit"] },
      ),
    ) as Record<string, unknown>;
    if (typeof result.transactionHash !== "string" || !/^0x[0-9a-fA-F]{64}$/u.test(result.transactionHash)) {
      throw new Error("Bun-wrapped release boundary returned no transaction hash");
    }
    return result.transactionHash;
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
    const transaction = await provider.getTransaction(transactionHash);
    const receipt = await provider.getTransactionReceipt(transactionHash);
    if (!transaction || !receipt || receipt.status !== 1) {
      throw new Error(`Release receipt ${transactionHash} is unavailable or failed`);
    }
    if (
      getAddress(transaction.from) !== getAddress(manifest.ownership.deploymentSender) ||
      !transaction.to ||
      getAddress(transaction.to) !== getAddress(boundary.to) ||
      transaction.nonce !== expectedNonce
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
    if (checkpoint.lastVerifiedStep < nextStep && checkpoint.lastVerifiedStep !== nextStep - 1) {
      throw new Error(
        `Boundary ${nextStep} is not resumable from verified boundary ${checkpoint.lastVerifiedStep}; execute exactly one step at a time`,
      );
    }
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
      { cwd: CONTRACTS_ROOT, stdio: "inherit", env: process.env },
    );
  }

  private runStageVerifier(options: ParsedOptions, stage: ReleaseStage, artifactPath: string, baseSalt: string): void {
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
      { cwd: CONTRACTS_ROOT, stdio: "inherit", env: process.env },
    );
  }

  private async safePlan(options: ParsedOptions, manifest: ReleaseManifest, lock: ReleaseLock): Promise<void> {
    if (options.network !== "celo") throw new Error("safe-plan requires --network celo");
    if (options.broadcast) throw new Error("Safe authority has no broadcast path while safeAuthority.enabled is false");
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
        if ((owners as string[]).length !== 5 || BigInt(threshold) !== 3n) {
          liveBlockers.push(
            `protocol Safe Arbitrum owner policy is ${String(threshold)}-of-${(owners as string[]).length}, expected 3-of-5`,
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
      blockedUntil: [
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
      throw new Error(`Safe/Zodiac live preflight blocked: ${liveBlockers.join("; ")}`);
    }
  }

  private peerPlan(options: ParsedOptions, manifest: ReleaseManifest, lock: ReleaseLock): void {
    if (options.network !== "arbitrum" && options.network !== "celo") {
      throw new Error("settlement-peer requires --network arbitrum|celo");
    }
    if (options.broadcast) throw new Error("Peer wiring is not broadcast-authorized in Phase A");
    const gas = process.env.SETTLEMENT_DESTINATION_GAS_LIMIT;
    if (!gas) throw new Error("Set SETTLEMENT_DESTINATION_GAS_LIMIT to the measured non-zero uint32 value");
    const plan = buildPeerTransactionPlan(manifest, lock, BigInt(gas), options.network);
    const filePath = path.join(GENERATED_ROOT, manifest.releaseId, options.network, "settlement-peer-plan.json");
    writeGenerated(filePath, plan);
    console.log(stable(plan));
    console.log(`Peer plan written: ${filePath}`);
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
    const recovered = predictedSide(lock, stage);
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
    execFileSync("bun", args, { cwd: CONTRACTS_ROOT, stdio: "inherit", env: process.env });
  }

  private indexerHandoff(options: ParsedOptions, manifest: ReleaseManifest, lock: ReleaseLock): void {
    if (options.broadcast || manifest.indexer.activationAuthorized) {
      throw new Error("Phase A indexer handoff is inert and may not activate production addresses");
    }
    const settlement = identity(lock, "SettlementModule", "proxy").address;
    const executor = identity(lock, "CeloSettlementExecutor", "proxy").address;
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
          startBlock: "RECEIPT_REQUIRED",
        },
        {
          chainId: "42220",
          contract: "CeloSettlementExecutor",
          address: executor,
          startBlock: "RECEIPT_REQUIRED",
        },
      ],
      commandsAfterSeparateAuthorization: [
        "cd packages/indexer && bun run codegen",
        "cd packages/indexer && bun run check:indexing-boundary",
        "cd packages/indexer && bun run test",
        "cd packages/indexer && bun run build",
        "read back SettlementExecution and SettlementAcknowledgment by execution key",
      ],
      hostedActivation:
        "BLOCKED: the installed Envio CLI has no deploy command. Record the exact hosted console/CI owner path before Phase B; do not invent a shell command.",
      cutoverRule: "Do not cut over until addresses and receipt start blocks pass release-verify on both chains.",
    };
    const filePath = path.join(GENERATED_ROOT, manifest.releaseId, "indexer-handoff.json");
    writeGenerated(filePath, plan);
    console.log(stable(plan));
    console.log(`Inert indexer handoff written: ${filePath}`);
  }

  private assertSender(command: string, options: ParsedOptions, manifest: ReleaseManifest): void {
    const expected =
      command === "settlement-peer" ? manifest.ownership.protocolSafe : manifest.ownership.deploymentSender;
    const sender = options.sender ?? expected;
    if (getAddress(sender) !== getAddress(expected)) {
      throw new Error(`Wrong sender: expected ${expected}, received ${sender}`);
    }
  }
}
