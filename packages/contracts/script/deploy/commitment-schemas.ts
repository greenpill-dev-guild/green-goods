import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  Contract,
  getAddress,
  Interface,
  isAddress,
  JsonRpcProvider,
  keccak256,
  toUtf8Bytes,
  ZeroAddress,
} from "ethers";
import { type ParsedOptions } from "../utils/cli-parser";
import { DeploymentAddresses } from "../utils/deployment-addresses";
import { NetworkManager } from "../utils/network";
import { mergeReleaseArtifact, writeReleaseJsonAtomic } from "../utils/release-artifacts";
import { buildReleaseLock, loadReleaseManifest } from "../utils/release-manifest";
import { getFoundryBroadcastPath } from "../utils/paths";
import { assertSepoliaGate } from "../utils/release-gate";
import { buildReadOnlyCastEnv, parseCastTransactionHash } from "../utils/cast-env";
import {
  type CommitmentSchemaDefinition,
  type OnChainSchemaRecord,
  type SchemaRegistrationPlan,
  computeSchemaUID,
  loadCommitmentSchemas,
  planSchemaRegistration,
  schemaString,
} from "../utils/pooling-release";

const CONTRACTS_ROOT = path.join(__dirname, "../..");
const GENERATED_SCHEMA_ROOT = path.join(CONTRACTS_ROOT, ".generated/release-schemas");
export const SCHEMA_TRANSACTION_BOUNDARY_RULE =
  "Execute and verify exactly one nonce-pinned transaction; do not continue until its receipt and live post-state are checkpointed.";
export const SCHEMA_RESUMABLE_STATE =
  "The exact on-chain postcondition is satisfied or absent; a conflicting record, owner, module, salt, or code identity fails closed.";

export function schemaSimulationArtifactName(finalizeCommunityTestimony: boolean): string {
  return finalizeCommunityTestimony ? "finalizeCommunityTestimony-latest.json" : "run-latest.json";
}

/**
 * Addresses preparation produces. The resolver is deployed by this target now (contract-spec
 * §6.4.4), so its addresses land here rather than coming from a separate step.
 */
const PREPARATION_KEYS = ["testimonyResolver", "testimonyResolverImpl"] as const;

/** Artifact key each schema lands under in `deployments/{chainId}-latest.json#schemas`. */
const ARTIFACT_KEYS: Record<string, string> = {
  assessmentV3: "assessmentV3SchemaUID",
  communityTestimony: "communityTestimonySchemaUID",
};

/** Deployment key holding the resolver each schema registers against. */
const RESOLVER_KEYS: Record<string, string> = {
  assessmentV3: "assessmentResolver",
  communityTestimony: "testimonyResolver",
};

const schemaRegistryInterface = new Interface([
  "function register(string schema,address resolver,bool revocable) returns (bytes32 uid)",
  "function getSchema(bytes32 uid) view returns (tuple(bytes32 uid,address resolver,bool revocable,string schema))",
]);
const testimonyInterface = new Interface([
  "function owner() view returns (address)",
  "function schemaUID() view returns (bytes32)",
  "function commitmentModule() view returns (address)",
  "function setSchemaUID(bytes32 uid)",
  "function setCommitmentModule(address module)",
]);

interface ForgeSchemaArtifact {
  transactions?: Array<{
    transactionType?: string;
    contractName?: string | null;
    contractAddress?: string | null;
    function?: string | null;
    transaction?: {
      from?: string;
      to?: string;
      nonce?: string;
      input?: string;
      value?: string;
    };
  }>;
}

export interface PersistedSchemaPlan {
  schemaVersion: 1;
  releaseId: string;
  manifestHash: string;
  sourceCommit: string;
  mode: "preparation" | "finalization";
  network: string;
  chainId: number;
  sender: string;
  expectedNonce: number;
  schemaRegistry: string;
  testimonyResolver: string;
  testimonyResolverImpl: string;
  commitmentPoolingModule: string | null;
  pinnedCommunityTestimonyUID: string;
  schemas: Array<{
    key: string;
    uid: string;
    schema: string;
    resolver: string;
    revocable: boolean;
    name: string;
    description: string;
  }>;
  transactions: Array<{
    index: number;
    from: string;
    to: string;
    nonce: number;
    data: string;
    value: string;
    kind: "CREATE2_IMPLEMENTATION" | "CREATE2_PROXY" | "REGISTER_SCHEMA" | "PIN_UID" | "ACTIVATE_RESOLVER";
    expectedAddress?: string;
    expectedUID?: string;
    resumableState: string;
  }>;
  transactionBoundaryRule: string;
  canonicalArtifactMutation: false;
}

export interface SchemaCheckpoint {
  schemaVersion: 1;
  planHash: string;
  completed: Array<{
    step: number;
    transactionHash: string;
    blockNumber: number;
    verifiedAt: string;
  }>;
}

export interface FrozenSchemaPlanInputs {
  releaseId: string;
  manifestHash: string;
  sourceCommit: string;
  mode: "preparation" | "finalization";
  network: string;
  chainId: number;
  sender: string;
  schemaRegistry: string;
  testimonyResolver: string;
  testimonyResolverImpl: string;
  commitmentPoolingModule: string | null;
  pinnedCommunityTestimonyUID: string;
  create2: {
    factory: string;
    implementationSalt: string;
    proxySalt: string;
    implementationCreationCodeHash: string;
    proxyCreationCodeHash: string;
  };
  schemas: PersistedSchemaPlan["schemas"];
}

export function validateSchemaCheckpointPrefix(
  checkpoint: SchemaCheckpoint,
  plan: PersistedSchemaPlan,
  requestedStep: number,
): void {
  if (checkpoint.schemaVersion !== 1) throw new Error("Schema checkpoint version is unsupported");
  const steps = checkpoint.completed.map((entry) => entry.step);
  if (new Set(steps).size !== steps.length) throw new Error("Schema checkpoint contains duplicate boundaries");
  for (let index = 0; index < checkpoint.completed.length; index += 1) {
    const evidence = checkpoint.completed[index];
    if (evidence.step !== index + 1) throw new Error("Schema checkpoint is not one contiguous verified prefix");
    if (!/^0x[0-9a-f]{64}$/iu.test(evidence.transactionHash)) {
      throw new Error(`Schema checkpoint boundary ${evidence.step} has no valid transaction hash`);
    }
    if (!Number.isSafeInteger(evidence.blockNumber) || evidence.blockNumber <= 0) {
      throw new Error(`Schema checkpoint boundary ${evidence.step} has no valid block number`);
    }
    if (Number.isNaN(Date.parse(evidence.verifiedAt))) {
      throw new Error(`Schema checkpoint boundary ${evidence.step} has no valid verification time`);
    }
  }
  const alreadyVerified = steps.includes(requestedStep);
  const requiredLength = alreadyVerified ? requestedStep : requestedStep - 1;
  if (checkpoint.completed.length !== requiredLength) {
    throw new Error(`Schema boundary ${requestedStep} is not the next boundary in the verified prefix`);
  }
  if (requestedStep < 1 || requestedStep > plan.transactions.length) {
    throw new Error(`Schema plan has no boundary ${requestedStep}`);
  }
}

export function validateSchemaReceiptTransaction(
  transaction: { from: string; to: string | null; data: string; nonce: number; value: bigint },
  plan: PersistedSchemaPlan,
  boundary: PersistedSchemaPlan["transactions"][number],
  transactionHash: string,
): void {
  if (
    getAddress(transaction.from) !== getAddress(plan.sender) ||
    !transaction.to ||
    getAddress(transaction.to) !== getAddress(boundary.to) ||
    transaction.data.toLowerCase() !== boundary.data.toLowerCase() ||
    transaction.nonce !== boundary.nonce ||
    transaction.value !== BigInt(boundary.value)
  ) {
    throw new Error(`Schema receipt ${transactionHash} differs from the reviewed boundary`);
  }
}

export function validateReviewedSchemaPlan(plan: PersistedSchemaPlan, expected: FrozenSchemaPlanInputs): void {
  if (
    plan.schemaVersion !== 1 ||
    plan.releaseId !== expected.releaseId ||
    plan.manifestHash !== expected.manifestHash ||
    plan.sourceCommit !== expected.sourceCommit ||
    plan.mode !== expected.mode ||
    plan.network !== expected.network ||
    plan.chainId !== expected.chainId ||
    getAddress(plan.sender) !== getAddress(expected.sender) ||
    getAddress(plan.schemaRegistry) !== getAddress(expected.schemaRegistry) ||
    getAddress(plan.testimonyResolver) !== getAddress(expected.testimonyResolver) ||
    getAddress(plan.testimonyResolverImpl) !== getAddress(expected.testimonyResolverImpl) ||
    plan.transactionBoundaryRule !== SCHEMA_TRANSACTION_BOUNDARY_RULE ||
    plan.canonicalArtifactMutation !== false
  ) {
    throw new Error("Schema plan does not match the freshly derived frozen release inputs");
  }
  if (
    (plan.commitmentPoolingModule === null) !== (expected.commitmentPoolingModule === null) ||
    (plan.commitmentPoolingModule !== null &&
      expected.commitmentPoolingModule !== null &&
      getAddress(plan.commitmentPoolingModule) !== getAddress(expected.commitmentPoolingModule))
  ) {
    throw new Error("Schema plan CommitmentPoolingModule differs from the shipped deployment artifact");
  }
  if (plan.pinnedCommunityTestimonyUID.toLowerCase() !== expected.pinnedCommunityTestimonyUID.toLowerCase()) {
    throw new Error("Schema plan Community Testimony UID differs from the canonical schema definition");
  }
  if (plan.schemas.length !== expected.schemas.length) {
    throw new Error("Schema plan definition count differs from the canonical schema set");
  }
  for (let index = 0; index < expected.schemas.length; index += 1) {
    const actual = plan.schemas[index];
    const canonical = expected.schemas[index];
    if (
      actual.key !== canonical.key ||
      actual.uid.toLowerCase() !== canonical.uid.toLowerCase() ||
      actual.schema !== canonical.schema ||
      getAddress(actual.resolver) !== getAddress(canonical.resolver) ||
      actual.revocable !== canonical.revocable ||
      actual.name !== canonical.name ||
      actual.description !== canonical.description
    ) {
      throw new Error(`Schema plan definition ${index + 1} differs from the canonical schema set`);
    }
  }

  const expectedKinds =
    expected.mode === "preparation"
      ? (["CREATE2_IMPLEMENTATION", "CREATE2_PROXY", "REGISTER_SCHEMA", "PIN_UID"] as const)
      : (["REGISTER_SCHEMA", "ACTIVATE_RESOLVER"] as const);
  if (plan.transactions.length !== expectedKinds.length) {
    throw new Error(`Schema ${expected.mode} plan must contain the complete canonical transaction sequence`);
  }
  if (!Number.isSafeInteger(plan.expectedNonce) || plan.expectedNonce < 0) {
    throw new Error("Schema plan starting nonce is invalid");
  }
  const schema = expected.schemas[0];
  if (!schema) throw new Error("Canonical schema plan contains no schema definition");
  for (let index = 0; index < plan.transactions.length; index += 1) {
    const transaction = plan.transactions[index];
    const kind = expectedKinds[index];
    if (
      transaction.index !== index + 1 ||
      transaction.kind !== kind ||
      getAddress(transaction.from) !== getAddress(expected.sender) ||
      transaction.nonce !== plan.expectedNonce + index ||
      BigInt(transaction.value) !== 0n ||
      !/^0x[0-9a-f]*$/iu.test(transaction.data) ||
      transaction.resumableState !== SCHEMA_RESUMABLE_STATE
    ) {
      throw new Error(`Schema transaction ${index + 1} differs from the canonical sequence`);
    }
    if (kind === "CREATE2_IMPLEMENTATION" || kind === "CREATE2_PROXY") {
      const implementation = kind === "CREATE2_IMPLEMENTATION";
      const salt = implementation ? expected.create2.implementationSalt : expected.create2.proxySalt;
      const address = implementation ? expected.testimonyResolverImpl : expected.testimonyResolver;
      const creationCodeHash = implementation
        ? expected.create2.implementationCreationCodeHash
        : expected.create2.proxyCreationCodeHash;
      if (
        getAddress(transaction.to) !== getAddress(expected.create2.factory) ||
        transaction.expectedAddress === undefined ||
        getAddress(transaction.expectedAddress) !== getAddress(address) ||
        `0x${transaction.data.slice(2, 66)}`.toLowerCase() !== salt.toLowerCase() ||
        keccak256(`0x${transaction.data.slice(66)}`).toLowerCase() !== creationCodeHash.toLowerCase() ||
        transaction.expectedUID !== undefined
      ) {
        throw new Error(`Schema transaction ${index + 1} changes the frozen CREATE2 identity`);
      }
    } else if (kind === "REGISTER_SCHEMA") {
      const calldata = schemaRegistryInterface.encodeFunctionData("register", [
        schema.schema,
        schema.resolver,
        schema.revocable,
      ]);
      if (
        getAddress(transaction.to) !== getAddress(expected.schemaRegistry) ||
        transaction.data.toLowerCase() !== calldata.toLowerCase() ||
        transaction.expectedUID?.toLowerCase() !== schema.uid.toLowerCase() ||
        transaction.expectedAddress !== undefined
      ) {
        throw new Error(`Schema transaction ${index + 1} changes the canonical registration`);
      }
    } else if (kind === "PIN_UID") {
      const calldata = testimonyInterface.encodeFunctionData("setSchemaUID", [expected.pinnedCommunityTestimonyUID]);
      if (
        getAddress(transaction.to) !== getAddress(expected.testimonyResolver) ||
        transaction.data.toLowerCase() !== calldata.toLowerCase() ||
        transaction.expectedUID?.toLowerCase() !== expected.pinnedCommunityTestimonyUID.toLowerCase() ||
        transaction.expectedAddress !== undefined
      ) {
        throw new Error(`Schema transaction ${index + 1} changes the canonical UID pin`);
      }
    } else {
      if (!expected.commitmentPoolingModule) throw new Error("Finalization has no CommitmentPoolingModule");
      const calldata = testimonyInterface.encodeFunctionData("setCommitmentModule", [expected.commitmentPoolingModule]);
      if (
        getAddress(transaction.to) !== getAddress(expected.testimonyResolver) ||
        transaction.data.toLowerCase() !== calldata.toLowerCase() ||
        transaction.expectedUID !== undefined ||
        transaction.expectedAddress !== undefined
      ) {
        throw new Error(`Schema transaction ${index + 1} changes the canonical resolver activation`);
      }
    }
  }
}

export function deriveFrozenSchemaPlanInputs(args: {
  manifest: ReturnType<typeof loadReleaseManifest>;
  lock: ReturnType<typeof buildReleaseLock>;
  mode: "preparation" | "finalization";
  network: string;
  chainId: number;
  sender: string;
  schemaRegistry: string;
  deployment: Record<string, unknown>;
}): FrozenSchemaPlanInputs {
  const definitions = loadCommitmentSchemas().filter((definition) =>
    args.mode === "finalization" ? definition.key === "communityTestimony" : definition.key === "assessmentV3",
  );
  const schemas = definitions.map((definition) => {
    const resolverValue = args.deployment[RESOLVER_KEYS[definition.key]];
    if (typeof resolverValue !== "string" || !isAddress(resolverValue) || getAddress(resolverValue) === ZeroAddress) {
      throw new Error(`Shipped deployment artifact is missing ${RESOLVER_KEYS[definition.key]}`);
    }
    const resolver = getAddress(resolverValue);
    const schema = schemaString(definition.fields);
    return {
      key: definition.key,
      uid: computeSchemaUID(schema, resolver, definition.revocable),
      schema,
      resolver,
      revocable: definition.revocable,
      name: definition.name,
      description: definition.description,
    };
  });
  const communityDefinition = loadCommitmentSchemas().find((definition) => definition.key === "communityTestimony");
  if (!communityDefinition) throw new Error("Community Testimony schema definition is missing");
  const preparation = args.manifest.schemaPreparation;
  const commitmentPoolingModule =
    typeof args.deployment.commitmentPoolingModule === "string" && isAddress(args.deployment.commitmentPoolingModule)
      ? getAddress(args.deployment.commitmentPoolingModule)
      : null;
  if (args.mode === "finalization" && !commitmentPoolingModule) {
    throw new Error("Finalization requires the shipped CommitmentPoolingModule artifact");
  }
  return {
    releaseId: args.manifest.releaseId,
    manifestHash: args.lock.manifestHash,
    sourceCommit: args.lock.sourceCommit,
    mode: args.mode,
    network: args.network,
    chainId: args.chainId,
    sender: getAddress(args.sender),
    schemaRegistry: getAddress(args.schemaRegistry),
    testimonyResolver: getAddress(preparation.expected.proxy),
    testimonyResolverImpl: getAddress(preparation.expected.implementation),
    commitmentPoolingModule,
    pinnedCommunityTestimonyUID: computeSchemaUID(
      schemaString(communityDefinition.fields),
      preparation.expected.proxy,
      communityDefinition.revocable,
    ),
    create2: {
      factory: getAddress(preparation.create2.factory),
      implementationSalt: preparation.create2.implementationSalt,
      proxySalt: preparation.create2.proxySalt,
      implementationCreationCodeHash: preparation.expected.implementationCreationCodeHash,
      proxyCreationCodeHash: preparation.expected.proxyCreationCodeHash,
    },
    schemas,
  };
}

/**
 * Registers or reconciles the two additive EAS schemas this lane owns: assessment v3 and
 * community testimony.
 *
 * Registration is resumable by construction. Each UID is computed off-chain before anything is
 * sent, so a run interrupted after `register` but before the artifact was written reads the same
 * UID back from the registry and reconciles rather than registering a duplicate. A UID that
 * exists with a *different* record fails closed — EAS schemas are immutable, so that is an
 * operator conflict to resolve, never something to overwrite.
 */
export class CommitmentSchemasDeployer {
  private networkManager: NetworkManager;
  private deploymentAddresses: DeploymentAddresses;

  constructor(networkManager?: NetworkManager, deploymentAddresses?: DeploymentAddresses) {
    this.networkManager = networkManager ?? new NetworkManager();
    this.deploymentAddresses = deploymentAddresses ?? new DeploymentAddresses();
  }

  async deployCommitmentSchemas(options: ParsedOptions): Promise<void> {
    if (options.broadcast && options.transactionPlan) {
      throw new Error("--broadcast and --tx-plan are mutually exclusive");
    }
    if (
      options.broadcast &&
      (!options.artifactPath ||
        options.releaseStep === undefined ||
        options.expectedNonce === undefined ||
        !options.sender)
    ) {
      throw new Error("Schema broadcast requires --artifact <reviewed-plan>, --step, --expected-nonce, and --sender");
    }
    if (options.transactionPlan && (!options.sender || options.expectedNonce === undefined)) {
      throw new Error("Commitment schema transaction planning requires --sender and --expected-nonce");
    }
    const networkConfig = this.networkManager.getNetwork(options.network);
    const chainId = this.networkManager.getChainIdString(options.network);
    const deployment = this.deploymentAddresses.loadForChain(options.network) as Record<string, unknown>;
    const schemaRegistry = this.resolveSchemaRegistry(options.network, deployment);
    if (options.broadcast) {
      await this.executeTransactionBoundary(options, Number(chainId), deployment, schemaRegistry);
      return;
    }
    // The two modes own different registrations. Preparation registers AssessmentV3 and only PINS
    // the Community Testimony UID; its record belongs to finalization, after the module exists and
    // has been verified (contract-spec §6.4.4). Planning both here would advertise a registration
    // preparation deliberately does not perform.
    const definitions = loadCommitmentSchemas().filter((definition) =>
      options.finalizeCommunityTestimony ? definition.key === "communityTestimony" : definition.key === "assessmentV3",
    );

    const mode = options.finalizeCommunityTestimony ? "FINALIZATION" : "PREPARATION";
    console.log(
      `${options.broadcast ? "Running" : "Planning"} commitment-schemas ${mode} for ${options.network} ` +
        `(chainId: ${networkConfig.chainId})`,
    );
    console.log(
      options.finalizeCommunityTestimony
        ? "Registers the exact Community Testimony record, then activates the resolver against the module."
        : "Deploys the testimony resolver (CREATE2), registers AssessmentV3, and pins the Community\n" +
            "Testimony UID. The resolver stays inert: its module is set only by the finalization run.",
    );
    console.log(`SchemaRegistry: ${schemaRegistry}`);

    const plans = definitions.map((definition) => this.planFor(definition, deployment, schemaRegistry, options));

    if (options.transactionPlan) {
      await this.persistTransactionPlan(options, Number(chainId), schemaRegistry, definitions, plans, deployment);
      return;
    }

    this.printPlan(definitions, plans, chainId);
    if (!options.finalizeCommunityTestimony) this.printPredictedResolver(options);
  }

  private planFor(
    definition: CommitmentSchemaDefinition,
    deployment: Record<string, unknown>,
    schemaRegistry: string,
    options: ParsedOptions,
  ): SchemaRegistrationPlan {
    const resolver = this.resolveResolver(definition.key, deployment);
    const schema = schemaString(definition.fields);
    const input = { key: definition.key, schema, resolver, revocable: definition.revocable };

    // A pure simulation never touches the chain, so it can only report the deterministic UID and
    // the action a run would take against an empty registry.
    const existing = options.pureSimulation
      ? null
      : this.readSchemaRecord(options.network, schemaRegistry, input.schema, resolver, definition.revocable);

    return planSchemaRegistration(input, existing);
  }

  /** Read the live record under the deterministic UID; only --pure-simulation may skip RPC proof. */
  private readSchemaRecord(
    network: string,
    schemaRegistry: string,
    schema: string,
    resolver: string,
    revocable: boolean,
  ): OnChainSchemaRecord | null {
    let rpcUrl: string;
    try {
      rpcUrl = this.networkManager.getRpcUrl(network);
    } catch (error) {
      throw new Error(
        `Could not read the exact live schema record on ${network}; use --pure-simulation for an RPC-free plan: ` +
          `${error instanceof Error ? error.message.split("\n")[0] : String(error)}`,
      );
    }

    let raw: string;
    try {
      raw = execFileSync(
        "cast",
        [
          "call",
          schemaRegistry,
          "getSchema(bytes32)((bytes32,address,bool,string))",
          computeSchemaUID(schema, resolver, revocable),
          "--rpc-url",
          rpcUrl,
        ],
        { cwd: CONTRACTS_ROOT, env: buildReadOnlyCastEnv(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      ).trim();
    } catch (error) {
      throw new Error(
        `Could not read the exact live schema record on ${network}; use --pure-simulation only for an RPC-free preview: ` +
          `${error instanceof Error ? error.message.split("\n")[0] : String(error)}`,
      );
    }
    return this.parseSchemaRecord(raw);
  }

  /** `cast call` renders a struct as `(uid, resolver, revocable, "schema")`. */
  private parseSchemaRecord(raw: string): OnChainSchemaRecord | null {
    const inner = raw.replace(/^\(/, "").replace(/\)$/, "");
    const match = inner.match(/^(0x[0-9a-fA-F]{64}),\s*(0x[0-9a-fA-F]{40}),\s*(true|false),\s*"([\s\S]*)"$/);
    if (!match) return null;
    if (/^0x0+$/i.test(match[1])) return null;

    return { uid: match[1], resolver: match[2], revocable: match[3] === "true", schema: match[4] };
  }

  private printPlan(definitions: CommitmentSchemaDefinition[], plans: SchemaRegistrationPlan[], chainId: string): void {
    console.log("\nDRY RUN - no transactions will be sent");
    definitions.forEach((definition, index) => {
      const plan = plans[index];
      const schema = schemaString(definition.fields);
      console.log(`\n${definition.key} (${definition.name})`);
      console.log(`  schema:    ${schema}`);
      console.log(`  revocable: ${definition.revocable}`);
      console.log(`  uid:       ${plan.uid}`);
      console.log(`  action:    ${plan.action}`);
      console.log(`  artifact:  schemas.${ARTIFACT_KEYS[definition.key]}`);
      if (plan.action === "register") {
        console.log(
          `  calldata:  ${schemaRegistryInterface.encodeFunctionData("register", [schema, ZeroAddress, definition.revocable])}`,
        );
      }
    });
    console.log(`\nWould merge both UIDs into deployments/${chainId}-latest.json#schemas`);
    console.log("\nCommitment schema dry-run plan complete.");
  }

  /**
   * Show the CREATE2 pair preparation would deploy, before anything is authorized.
   *
   * Runs the forge script's `predict()` view, which reuses the same derivation the broadcast does —
   * recomputing it here in TypeScript would create a second source of truth for an address that
   * must not drift. Needs an RPC because the owner comes from the live sibling resolvers, so
   * `--pure-simulation` and an unreachable node both degrade to a printed note rather than a
   * failure: a dry run's job is to stay usable before a signer or a node exists.
   */
  private printPredictedResolver(options: ParsedOptions): void {
    const preparation = loadReleaseManifest().schemaPreparation;
    console.log("\nFrozen TestimonyResolver identities (no transactions sent):");
    console.log(`  implementation: ${preparation.expected.implementation}`);
    console.log(`  proxy:          ${preparation.expected.proxy}`);
    console.log(`  implementation salt: ${preparation.create2.implementationSalt}`);
    console.log(`  proxy salt:          ${preparation.create2.proxySalt}`);
    if (options.pureSimulation) {
      console.log("  live compatibility preflight: deferred; --pure-simulation makes no RPC calls");
      return;
    }

    let rpcUrl: string;
    try {
      rpcUrl = this.networkManager.getRpcUrl(options.network);
    } catch {
      console.log(`\nPredicted resolver addresses unavailable: no RPC configured for ${options.network}.`);
      return;
    }

    try {
      const output = execFileSync(
        "forge",
        [
          "script",
          "script/DeployCommitmentSchemas.s.sol:DeployCommitmentSchemas",
          "--sig",
          "predict()",
          "--rpc-url",
          rpcUrl,
        ],
        { cwd: CONTRACTS_ROOT, env: { ...buildReadOnlyCastEnv(), FOUNDRY_PROFILE: "production" }, encoding: "utf8" },
      );
      console.log("\nTestimonyResolver deployment preview (no transactions sent):");
      // forge wraps script logs in its own banner; the console.log lines are what an operator
      // compares against the runbook.
      output
        .split("\n")
        .filter(
          (line) =>
            line.includes("TestimonyResolver") ||
            line.includes("Community Testimony") ||
            /^0x[0-9a-f]{64}$/i.test(line.trim()),
        )
        .forEach((line) => console.log(`  ${line.trim()}`));
    } catch {
      throw new Error(
        "Live schema preparation preflight failed. The existing AssessmentResolver must be upgraded and verified " +
          "before this dependent dry-run can be green.",
      );
    }
  }

  private async persistTransactionPlan(
    options: ParsedOptions,
    chainId: number,
    schemaRegistry: string,
    definitions: CommitmentSchemaDefinition[],
    plans: SchemaRegistrationPlan[],
    deployment: Record<string, unknown>,
  ): Promise<void> {
    if (options.pureSimulation || options.broadcast) {
      throw new Error("--tx-plan cannot be combined with --pure-simulation or --broadcast");
    }
    if (!options.sender || options.expectedNonce === undefined) {
      throw new Error("Commitment schema transaction planning requires --sender and --expected-nonce");
    }
    const manifest = loadReleaseManifest();
    const lock = buildReleaseLock(manifest);
    if (getAddress(options.sender) !== getAddress(manifest.ownership.deploymentSender)) {
      throw new Error(`Schema plan sender must equal ${manifest.ownership.deploymentSender}`);
    }
    const rpcUrl = this.networkManager.getRpcUrl(options.network);
    const provider = new JsonRpcProvider(rpcUrl, chainId, { staticNetwork: true });
    const pendingNonce = await provider.getTransactionCount(options.sender, "pending");
    if (pendingNonce !== options.expectedNonce) {
      throw new Error(`Nonce drift: expected ${options.expectedNonce}, live pending nonce is ${pendingNonce}`);
    }
    const mode = options.finalizeCommunityTestimony ? "finalization" : "preparation";
    const outputDirectory = path.join(GENERATED_SCHEMA_ROOT, mode, "simulation-output");
    fs.mkdirSync(outputDirectory, { recursive: true });
    const artifactPath = getFoundryBroadcastPath(
      "DeployCommitmentSchemas.s.sol",
      String(chainId),
      "dry-run",
      schemaSimulationArtifactName(options.finalizeCommunityTestimony),
    );
    const startedAt = Date.now();
    const args = [
      "script",
      "script/DeployCommitmentSchemas.s.sol:DeployCommitmentSchemas",
      ...(options.finalizeCommunityTestimony ? ["--sig", "finalizeCommunityTestimony()"] : []),
      "--chain-id",
      String(chainId),
      "--rpc-url",
      rpcUrl,
      "--sender",
      options.sender,
    ];
    console.log(`Building the Bun-wrapped ${mode} transaction plan; no transactions will be broadcast`);
    execFileSync("forge", args, {
      cwd: CONTRACTS_ROOT,
      stdio: "inherit",
      env: {
        ...buildReadOnlyCastEnv(),
        FOUNDRY_PROFILE: "production",
        DEPLOYMENT_OUTPUT_DIR: outputDirectory,
      },
    });
    if (!fs.existsSync(artifactPath) || fs.statSync(artifactPath).mtimeMs + 1_000 < startedAt) {
      throw new Error(`Fresh schema simulation artifact was not produced: ${artifactPath}`);
    }
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as ForgeSchemaArtifact;
    const preparation = manifest.schemaPreparation;
    const testimonyResolver = getAddress(preparation.expected.proxy);
    const testimonyResolverImpl = getAddress(preparation.expected.implementation);
    const communityDefinition = loadCommitmentSchemas().find((definition) => definition.key === "communityTestimony");
    if (!communityDefinition) throw new Error("Community Testimony schema definition is missing");
    const pinnedCommunityTestimonyUID = computeSchemaUID(
      schemaString(communityDefinition.fields),
      testimonyResolver,
      communityDefinition.revocable,
    );
    const commitmentPoolingModule =
      typeof deployment.commitmentPoolingModule === "string" && isAddress(deployment.commitmentPoolingModule)
        ? getAddress(deployment.commitmentPoolingModule)
        : null;
    if (options.finalizeCommunityTestimony && !commitmentPoolingModule) {
      throw new Error("Finalization planning requires the verified commitmentPoolingModule artifact");
    }

    const rawTransactions = artifact.transactions ?? [];
    const transactions: PersistedSchemaPlan["transactions"] = rawTransactions.map((entry, index) => {
      const from = entry.transaction?.from;
      const to = entry.transaction?.to;
      const nonceValue = entry.transaction?.nonce;
      const data = entry.transaction?.input;
      if (!from || !isAddress(from) || !to || !isAddress(to) || typeof data !== "string" || !data.startsWith("0x")) {
        throw new Error(`Schema simulation transaction ${index + 1} is incomplete`);
      }
      const nonce =
        typeof nonceValue === "string" && /^0x[0-9a-f]+$/iu.test(nonceValue)
          ? Number(BigInt(nonceValue))
          : Number(nonceValue);
      if (!Number.isSafeInteger(nonce) || nonce !== options.expectedNonce! + index) {
        throw new Error(`Schema simulation nonce drift at transaction ${index + 1}`);
      }
      let kind: PersistedSchemaPlan["transactions"][number]["kind"];
      let expectedAddress: string | undefined;
      let expectedUID: string | undefined;
      const target = getAddress(to);
      if (getAddress(from) !== getAddress(options.sender!)) {
        throw new Error(`Schema simulation sender drift at transaction ${index + 1}`);
      }
      if (BigInt(entry.transaction?.value ?? "0x0") !== 0n) {
        throw new Error(`Schema simulation unexpectedly moves value at transaction ${index + 1}`);
      }
      if (target === getAddress(preparation.create2.factory)) {
        const salt = `0x${data.slice(2, 66)}`.toLowerCase();
        if (salt === preparation.create2.implementationSalt.toLowerCase()) {
          kind = "CREATE2_IMPLEMENTATION";
          expectedAddress = testimonyResolverImpl;
          if (keccak256(`0x${data.slice(66)}`) !== preparation.expected.implementationCreationCodeHash) {
            throw new Error("TestimonyResolver implementation creation code differs from the frozen manifest");
          }
        } else if (salt === preparation.create2.proxySalt.toLowerCase()) {
          kind = "CREATE2_PROXY";
          expectedAddress = testimonyResolver;
          if (keccak256(`0x${data.slice(66)}`) !== preparation.expected.proxyCreationCodeHash) {
            throw new Error("TestimonyResolver proxy creation code differs from the frozen manifest");
          }
        } else {
          throw new Error(`Schema simulation uses an unreviewed CREATE2 salt at transaction ${index + 1}`);
        }
      } else if (
        target === getAddress(schemaRegistry) &&
        data.startsWith(schemaRegistryInterface.getFunction("register")!.selector)
      ) {
        kind = "REGISTER_SCHEMA";
        const decoded = schemaRegistryInterface.decodeFunctionData("register", data);
        expectedUID = computeSchemaUID(String(decoded[0]), getAddress(decoded[1] as string), Boolean(decoded[2]));
        const plannedUIDs = new Set(plans.map((plan) => plan.uid.toLowerCase()));
        if (!plannedUIDs.has(expectedUID.toLowerCase())) {
          throw new Error(`Schema simulation registers unreviewed UID ${expectedUID}`);
        }
      } else if (
        target === testimonyResolver &&
        data.startsWith(testimonyInterface.getFunction("setSchemaUID")!.selector)
      ) {
        kind = "PIN_UID";
        expectedUID = String(testimonyInterface.decodeFunctionData("setSchemaUID", data)[0]);
        if (expectedUID.toLowerCase() !== pinnedCommunityTestimonyUID.toLowerCase()) {
          throw new Error("Schema simulation pins a Community Testimony UID that differs from the frozen definition");
        }
      } else if (
        target === testimonyResolver &&
        data.startsWith(testimonyInterface.getFunction("setCommitmentModule")!.selector)
      ) {
        kind = "ACTIVATE_RESOLVER";
        const module = getAddress(testimonyInterface.decodeFunctionData("setCommitmentModule", data)[0] as string);
        if (!commitmentPoolingModule || module !== commitmentPoolingModule) {
          throw new Error("Schema simulation activates an unreviewed CommitmentPoolingModule");
        }
      } else {
        throw new Error(`Schema simulation contains an unclassified transaction ${index + 1} to ${target}`);
      }
      return {
        index: index + 1,
        from: getAddress(from),
        to: target,
        nonce,
        data,
        value: entry.transaction?.value ?? "0x0",
        kind,
        expectedAddress,
        expectedUID,
        resumableState: SCHEMA_RESUMABLE_STATE,
      };
    });
    if (transactions.length === 0) {
      throw new Error(
        `${mode} is already satisfied; use the post-deploy verifier/recovery path instead of an empty broadcast plan`,
      );
    }
    const schemaEntries = definitions.map((definition, index) => ({
      key: definition.key,
      uid: plans[index].uid,
      schema: schemaString(definition.fields),
      resolver: this.resolveResolver(definition.key, deployment),
      revocable: definition.revocable,
      name: definition.name,
      description: definition.description,
    }));
    const plan: PersistedSchemaPlan = {
      schemaVersion: 1,
      releaseId: manifest.releaseId,
      manifestHash: lock.manifestHash,
      sourceCommit: lock.sourceCommit,
      mode,
      network: options.network,
      chainId,
      sender: getAddress(options.sender),
      expectedNonce: options.expectedNonce,
      schemaRegistry: getAddress(schemaRegistry),
      testimonyResolver,
      testimonyResolverImpl,
      commitmentPoolingModule,
      pinnedCommunityTestimonyUID,
      schemas: schemaEntries,
      transactions,
      transactionBoundaryRule: SCHEMA_TRANSACTION_BOUNDARY_RULE,
      canonicalArtifactMutation: false,
    };
    const planPath = path.join(GENERATED_SCHEMA_ROOT, mode, `${chainId}-${mode}-transaction-plan.json`);
    writeReleaseJsonAtomic(planPath, plan);
    console.log(`${JSON.stringify(plan, null, 2)}\n`);
    console.log(`Exact schema transaction plan: ${planPath}`);
    console.log("Canonical deployment artifact was not mutated");
  }

  private async executeTransactionBoundary(
    options: ParsedOptions,
    chainId: number,
    deployment: Record<string, unknown>,
    schemaRegistry: string,
  ): Promise<void> {
    if (
      !options.artifactPath ||
      options.releaseStep === undefined ||
      options.expectedNonce === undefined ||
      !options.sender
    ) {
      throw new Error("Schema broadcast requires --artifact <reviewed-plan>, --step, --expected-nonce, and --sender");
    }
    assertSepoliaGate({
      network: options.network,
      broadcast: true,
      overrideSepoliaGate: options.overrideSepoliaGate,
    });
    const planPath = path.resolve(CONTRACTS_ROOT, options.artifactPath);
    if (!fs.existsSync(planPath)) throw new Error(`Reviewed schema plan not found: ${planPath}`);
    const plan = JSON.parse(fs.readFileSync(planPath, "utf8")) as PersistedSchemaPlan;
    const manifest = loadReleaseManifest();
    const lock = buildReleaseLock(manifest);
    const mode = options.finalizeCommunityTestimony ? "finalization" : "preparation";
    validateReviewedSchemaPlan(
      plan,
      deriveFrozenSchemaPlanInputs({
        manifest,
        lock,
        mode,
        network: options.network,
        chainId,
        sender: options.sender,
        schemaRegistry,
        deployment,
      }),
    );
    const boundary = plan.transactions[options.releaseStep - 1];
    if (!boundary || boundary.index !== options.releaseStep) {
      throw new Error(`Schema plan has no boundary ${options.releaseStep}`);
    }
    if (boundary.nonce !== options.expectedNonce) {
      throw new Error(`Schema boundary nonce is ${boundary.nonce}, not ${options.expectedNonce}`);
    }
    const checkpointPath = planPath.replace(/\.json$/u, ".checkpoint.json");
    const planHash = keccak256(toUtf8Bytes(`${JSON.stringify(plan, null, 2)}\n`));
    const checkpoint: SchemaCheckpoint = fs.existsSync(checkpointPath)
      ? (JSON.parse(fs.readFileSync(checkpointPath, "utf8")) as SchemaCheckpoint)
      : { schemaVersion: 1, planHash, completed: [] };
    if (checkpoint.planHash !== planHash) throw new Error("Schema checkpoint belongs to a different reviewed plan");
    validateSchemaCheckpointPrefix(checkpoint, plan, options.releaseStep);

    const rpcUrl = this.networkManager.getRpcUrl(options.network);
    const provider = new JsonRpcProvider(rpcUrl, chainId, { staticNetwork: true });
    const prior = checkpoint.completed.find((entry) => entry.step === options.releaseStep);
    let transactionHash = prior?.transactionHash ?? options.receiptHash;
    if (!transactionHash) {
      const pendingNonce = await provider.getTransactionCount(plan.sender, "pending");
      if (pendingNonce !== boundary.nonce) {
        throw new Error(
          `Nonce drift: boundary expects ${boundary.nonce}, live pending nonce is ${pendingNonce}; use --receipt only for an exact mined recovery`,
        );
      }
      transactionHash = parseCastTransactionHash(
        execFileSync(
          "cast",
          [
            "send",
            boundary.to,
            boundary.data,
            "--chain",
            String(chainId),
            "--nonce",
            String(boundary.nonce),
            "--account",
            manifest.ownership.deploymentKeystore,
            "--rpc-url",
            rpcUrl,
            "--json",
          ],
          { cwd: CONTRACTS_ROOT, env: process.env, encoding: "utf8", stdio: ["inherit", "pipe", "inherit"] },
        ),
        "Bun-wrapped schema boundary",
      );
    }
    const transaction = await provider.getTransaction(transactionHash);
    const receipt = await provider.getTransactionReceipt(transactionHash);
    if (!transaction || !receipt || receipt.status !== 1)
      throw new Error(`Schema receipt ${transactionHash} is unavailable or failed`);
    validateSchemaReceiptTransaction(transaction, plan, boundary, transactionHash);
    await this.verifySchemaBoundary(provider, plan, boundary);
    if (!prior) {
      checkpoint.completed.push({
        step: options.releaseStep,
        transactionHash,
        blockNumber: receipt.blockNumber,
        verifiedAt: new Date().toISOString(),
      });
      writeReleaseJsonAtomic(checkpointPath, checkpoint);
    }
    if (options.releaseStep === plan.transactions.length) {
      await this.verifyCompleteSchemaPlan(provider, plan);
      this.promoteVerifiedSchemaPlan(plan);
    }
    console.log(
      prior
        ? `Schema boundary ${options.releaseStep} was already verified; no replay transaction was sent`
        : `Schema boundary ${options.releaseStep} receipt and post-state verified; checkpoint written atomically`,
    );
  }

  private async verifySchemaBoundary(
    provider: JsonRpcProvider,
    plan: PersistedSchemaPlan,
    boundary: PersistedSchemaPlan["transactions"][number],
  ): Promise<void> {
    if (boundary.kind === "CREATE2_IMPLEMENTATION" || boundary.kind === "CREATE2_PROXY") {
      if (!boundary.expectedAddress || (await provider.getCode(boundary.expectedAddress)) === "0x") {
        throw new Error(`No code exists at the predicted ${boundary.kind} address`);
      }
      if (boundary.kind === "CREATE2_PROXY") {
        const implementationSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
        const stored = await provider.getStorage(boundary.expectedAddress, implementationSlot);
        if (getAddress(`0x${stored.slice(-40)}`) !== getAddress(plan.testimonyResolverImpl)) {
          throw new Error("TestimonyResolver proxy implementation slot mismatch");
        }
        const owner = getAddress(await new Contract(boundary.expectedAddress, testimonyInterface, provider).owner());
        if (owner !== getAddress(plan.sender)) throw new Error("TestimonyResolver proxy owner mismatch");
      }
      return;
    }
    if (boundary.kind === "REGISTER_SCHEMA") {
      if (!boundary.expectedUID) throw new Error("Schema registration boundary has no expected UID");
      const record = await new Contract(plan.schemaRegistry, schemaRegistryInterface, provider).getSchema(
        boundary.expectedUID,
      );
      if (String(record.uid).toLowerCase() !== boundary.expectedUID.toLowerCase()) {
        throw new Error(`Schema record ${boundary.expectedUID} was not stored`);
      }
      return;
    }
    const resolver = new Contract(plan.testimonyResolver, testimonyInterface, provider);
    if (boundary.kind === "PIN_UID") {
      if (String(await resolver.schemaUID()).toLowerCase() !== plan.pinnedCommunityTestimonyUID.toLowerCase()) {
        throw new Error("Community Testimony UID pin did not reach the exact frozen value");
      }
      if (getAddress(await resolver.commitmentModule()) !== ZeroAddress) {
        throw new Error("Preparation unexpectedly activated the Community Testimony resolver");
      }
      return;
    }
    if (!plan.commitmentPoolingModule) throw new Error("Finalization plan has no CommitmentPoolingModule");
    if (getAddress(await resolver.commitmentModule()) !== getAddress(plan.commitmentPoolingModule)) {
      throw new Error("Community Testimony resolver activation post-state mismatch");
    }
  }

  private async verifyCompleteSchemaPlan(provider: JsonRpcProvider, plan: PersistedSchemaPlan): Promise<void> {
    if (
      (await provider.getCode(plan.testimonyResolverImpl)) === "0x" ||
      (await provider.getCode(plan.testimonyResolver)) === "0x"
    ) {
      throw new Error("TestimonyResolver implementation/proxy pair is incomplete");
    }
    const implementationSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
    const stored = await provider.getStorage(plan.testimonyResolver, implementationSlot);
    if (getAddress(`0x${stored.slice(-40)}`) !== getAddress(plan.testimonyResolverImpl)) {
      throw new Error("TestimonyResolver implementation slot differs from the reviewed plan");
    }
    const resolver = new Contract(plan.testimonyResolver, testimonyInterface, provider);
    if (getAddress(await resolver.owner()) !== getAddress(plan.sender))
      throw new Error("TestimonyResolver owner drift");
    if (String(await resolver.schemaUID()).toLowerCase() !== plan.pinnedCommunityTestimonyUID.toLowerCase()) {
      throw new Error("Community Testimony UID pin drift");
    }
    const expectedModule = plan.mode === "finalization" ? plan.commitmentPoolingModule : ZeroAddress;
    if (!expectedModule || getAddress(await resolver.commitmentModule()) !== getAddress(expectedModule)) {
      throw new Error("Community Testimony activation state differs from the reviewed mode");
    }
    const registry = new Contract(plan.schemaRegistry, schemaRegistryInterface, provider);
    for (const schema of plan.schemas) {
      const record = await registry.getSchema(schema.uid);
      if (
        String(record.uid).toLowerCase() !== schema.uid.toLowerCase() ||
        getAddress(record.resolver) !== getAddress(schema.resolver) ||
        Boolean(record.revocable) !== schema.revocable ||
        String(record.schema) !== schema.schema
      ) {
        throw new Error(`Exact schema record verification failed for ${schema.key}`);
      }
    }
  }

  private promoteVerifiedSchemaPlan(plan: PersistedSchemaPlan): void {
    const canonicalPath = path.join(CONTRACTS_ROOT, "deployments", `${plan.chainId}-latest.json`);
    const promotionPath = path.join(GENERATED_SCHEMA_ROOT, plan.mode, `${plan.chainId}-${plan.mode}-promotion.json`);
    const promotion: Record<string, unknown> = { schemas: {} };
    const schemas = promotion.schemas as Record<string, unknown>;
    const ownedKeys: string[] = [];
    for (const schema of plan.schemas) {
      const artifactKey = ARTIFACT_KEYS[schema.key];
      if (!artifactKey) throw new Error(`No canonical artifact key for ${schema.key}`);
      schemas[artifactKey] = schema.uid;
      schemas[`${schema.key}Schema`] = schema.schema;
      schemas[`${schema.key}Name`] = schema.name;
      schemas[`${schema.key}Description`] = schema.description;
      ownedKeys.push(
        `schemas.${artifactKey}`,
        `schemas.${schema.key}Schema`,
        `schemas.${schema.key}Name`,
        `schemas.${schema.key}Description`,
      );
    }
    if (plan.mode === "preparation") {
      promotion.testimonyResolver = plan.testimonyResolver;
      promotion.testimonyResolverImpl = plan.testimonyResolverImpl;
      ownedKeys.push(...PREPARATION_KEYS);
    }
    writeReleaseJsonAtomic(promotionPath, promotion);
    mergeReleaseArtifact({ canonicalPath, sidePath: promotionPath, ownedKeys });
    console.log(`Verified ${plan.mode} artifact promoted without overwriting historical deployment keys`);
  }

  /**
   * Append-only merge into the canonical artifact.
   *
   * Preparation also promotes the resolver addresses it deployed, since it owns that deployment
   * now. Its side file is the recovery record: a run whose transaction mined but whose merge
   * failed re-runs to the same CREATE2 addresses and rewrites the same values.
   */
  mergeIntoDeployment(
    chainId: string,
    definitions: CommitmentSchemaDefinition[],
    plans: SchemaRegistrationPlan[],
    options: ParsedOptions,
  ): void {
    const mainDeploymentPath = path.join(CONTRACTS_ROOT, "deployments", `${chainId}-latest.json`);
    if (!fs.existsSync(mainDeploymentPath)) {
      throw new Error(`Main deployment file not found: ${mainDeploymentPath}`);
    }

    const promotionPath = path.join(CONTRACTS_ROOT, "deployments", `${chainId}-commitment-schema-promotion.json`);
    const promotion: Record<string, unknown> = { schemas: {} };
    const schemas = promotion.schemas as Record<string, unknown>;
    const ownedPaths: string[] = [];

    definitions.forEach((definition, index) => {
      const keys = [
        ARTIFACT_KEYS[definition.key],
        `${definition.key}Schema`,
        `${definition.key}Name`,
        `${definition.key}Description`,
      ];
      schemas[keys[0]] = plans[index].uid;
      schemas[keys[1]] = schemaString(definition.fields);
      // §6.4.4 lists `*Name` and `*Description` beside the UID and schema string, and every schema
      // already in the artifact carries all four. Omitting them left these two the only entries an
      // operator could not identify without reading config/schemas.json.
      schemas[keys[2]] = definition.name;
      schemas[keys[3]] = definition.description;
      ownedPaths.push(...keys.map((key) => `schemas.${key}`));
    });

    let recoverySidePath: string;
    if (options.finalizeCommunityTestimony) {
      recoverySidePath = this.assertFinalizationSideFileAgrees(chainId, plans);
    } else {
      const prepared = this.readPreparedResolver(chainId);
      Object.assign(promotion, prepared.values);
      ownedPaths.push(...PREPARATION_KEYS);
      recoverySidePath = prepared.path;
    }

    fs.writeFileSync(promotionPath, `${JSON.stringify(promotion, null, 2)}\n`, { mode: 0o600 });
    mergeReleaseArtifact({
      canonicalPath: mainDeploymentPath,
      sidePath: promotionPath,
      ownedKeys: ownedPaths,
    });
    if (fs.existsSync(recoverySidePath)) fs.unlinkSync(recoverySidePath);
    console.log(`\nMerged commitment schema UIDs into ${path.basename(mainDeploymentPath)}`);
    plans.forEach((plan) => console.log(`  ${plan.key}: ${plan.uid}`));
  }

  /**
   * Cross-check the canonical Community Testimony UID against the one the broadcast itself wrote.
   *
   * The finalization side file is written by the forge script only after the record is reconciled
   * and the resolver activated, so it is the on-chain truth; the UID merged here is recomputed in
   * TypeScript from the schema config. They agree today by construction — the schema string is
   * conformance-pinned and the resolver address comes from the artifact — but "agree by
   * construction" is exactly the claim worth checking at the point where a divergence would be
   * written into the canonical artifact and become the value every consumer trusts.
   *
   * Previously this file was written and never read, while the script's own comment claimed the
   * CLI promoted the key from it.
   */
  private assertFinalizationSideFileAgrees(chainId: string, plans: SchemaRegistrationPlan[]): string {
    const finalPath = path.join(CONTRACTS_ROOT, "deployments", `${chainId}-commitment-schemas-final.json`);
    if (!fs.existsSync(finalPath)) {
      throw new Error(
        `Finalization side file not found: ${finalPath}. The broadcast writes it as its last action, ` +
          "so its absence means finalization did not complete — refusing to record the canonical " +
          "communityTestimonySchemaUID.",
      );
    }

    const side = JSON.parse(fs.readFileSync(finalPath, "utf8")) as Record<string, unknown>;
    const broadcastUID = side.communityTestimonySchemaUID;
    const plannedUID = plans.find((plan) => plan.key === "communityTestimony")?.uid;

    if (typeof broadcastUID !== "string" || !plannedUID) {
      throw new Error(`Finalization side file ${finalPath} is missing communityTestimonySchemaUID`);
    }
    if (broadcastUID.toLowerCase() !== plannedUID.toLowerCase()) {
      throw new Error(
        `Community Testimony UID mismatch: the broadcast recorded ${broadcastUID} but this run planned ` +
          `${plannedUID}. The resolver is live against the broadcast's UID; do not overwrite the ` +
          "artifact until the divergence is explained.",
      );
    }
    return finalPath;
  }

  /** Read and validate resolver addresses preparation deployed, without mutating canonical state. */
  private readPreparedResolver(chainId: string): { path: string; values: Record<string, unknown> } {
    const preparedPath = path.join(CONTRACTS_ROOT, "deployments", `${chainId}-commitment-schemas-prepared.json`);
    if (!fs.existsSync(preparedPath)) {
      throw new Error(
        `Preparation side file not found: ${preparedPath}. Recover the deterministic on-chain resolver pair before promotion.`,
      );
    }

    const prepared = JSON.parse(fs.readFileSync(preparedPath, "utf8")) as Record<string, unknown>;
    const values: Record<string, unknown> = {};
    PREPARATION_KEYS.forEach((key) => {
      const value = prepared[key];
      if (typeof value !== "string" || !value.startsWith("0x") || /^0x0+$/i.test(value)) {
        throw new Error(`Preparation result is missing ${key}; refusing to record a partial deployment`);
      }
      values[key] = value;
      console.log(`  ${key}: ${value}`);
    });
    return { path: preparedPath, values };
  }

  private resolveResolver(key: string, deployment: Record<string, unknown>): string {
    const deploymentKey = RESOLVER_KEYS[key];
    const resolver = deployment[deploymentKey];
    if (typeof resolver !== "string" || !resolver.startsWith("0x") || /^0x0+$/i.test(resolver)) {
      throw new Error(
        `Missing ${deploymentKey} in the deployment artifact; ${key} cannot be registered against an unknown resolver`,
      );
    }
    return resolver;
  }

  private resolveSchemaRegistry(network: string, deployment: Record<string, unknown>): string {
    const easDeployment = deployment.eas;
    if (
      typeof easDeployment === "object" &&
      easDeployment !== null &&
      typeof (easDeployment as { schemaRegistry?: unknown }).schemaRegistry === "string"
    ) {
      return (easDeployment as { schemaRegistry: string }).schemaRegistry;
    }

    const schemaRegistry = this.networkManager.getNetwork(network).contracts?.easSchemaRegistry;
    if (schemaRegistry) return schemaRegistry;

    throw new Error(
      `Missing EAS schema registry address: eas.schemaRegistry deployment key or contracts.easSchemaRegistry ` +
        `network key for network ${network}`,
    );
  }
}
