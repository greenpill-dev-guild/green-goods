import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { Interface, ZeroAddress } from "ethers";
import { type ParsedOptions, redactSensitiveArgs } from "../utils/cli-parser";
import { DeploymentAddresses } from "../utils/deployment-addresses";
import { NetworkManager } from "../utils/network";
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
    const networkConfig = this.networkManager.getNetwork(options.network);
    const chainId = this.networkManager.getChainIdString(options.network);
    const deployment = this.deploymentAddresses.loadForChain(options.network) as Record<string, unknown>;
    const schemaRegistry = this.resolveSchemaRegistry(options.network, deployment);
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

    if (!options.broadcast) {
      this.printPlan(definitions, plans, chainId);
      if (!options.finalizeCommunityTestimony) this.printPredictedResolver(options);
      return;
    }

    this.broadcast(options, chainId, schemaRegistry, definitions, plans);
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

  /**
   * Read the live record under the deterministic UID. An unreachable RPC returns null rather than
   * throwing here: dry runs must stay usable offline, and a broadcast repeats this read through
   * the registry itself, which reverts `AlreadyExists` on a duplicate.
   */
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
    } catch {
      return null;
    }

    try {
      const raw = execFileSync(
        "cast",
        [
          "call",
          schemaRegistry,
          "getSchema(bytes32)((bytes32,address,bool,string))",
          computeSchemaUID(schema, resolver, revocable),
          "--rpc-url",
          rpcUrl,
        ],
        { cwd: CONTRACTS_ROOT, env: process.env, encoding: "utf8" },
      ).trim();
      return this.parseSchemaRecord(raw);
    } catch {
      return null;
    }
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
    if (options.pureSimulation) {
      console.log("\nPredicted resolver addresses unavailable: --pure-simulation makes no RPC calls.");
      console.log("Re-run without it to see the CREATE2 pair before broadcasting.");
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
        { cwd: CONTRACTS_ROOT, env: { ...process.env, FOUNDRY_PROFILE: "production" }, encoding: "utf8" },
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
    } catch (error) {
      // Not fatal: the prediction is operator information, and the broadcast recomputes it anyway.
      // Loud, though — a failing preflight here is exactly what a dry run is meant to surface.
      console.log("\nCould not preview the resolver addresses. The preparation preflight may be failing:");
      console.log(`  ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    }
  }

  private broadcast(
    options: ParsedOptions,
    chainId: string,
    schemaRegistry: string,
    definitions: CommitmentSchemaDefinition[],
    plans: SchemaRegistrationPlan[],
  ): void {
    const rpcUrl = this.networkManager.getRpcUrl(options.network);
    const args = [
      "script",
      "script/DeployCommitmentSchemas.s.sol:DeployCommitmentSchemas",
      ...(options.finalizeCommunityTestimony ? ["--sig", "finalizeCommunityTestimony()"] : []),
      "--chain-id",
      chainId,
      "--rpc-url",
      rpcUrl,
      "--broadcast",
    ];

    const keystoreName = process.env.FOUNDRY_KEYSTORE_ACCOUNT || "green-goods-deployer";
    args.push("--account", keystoreName);
    const senderAddress = options.sender ?? process.env.SENDER_ADDRESS;
    if (senderAddress) args.push("--sender", senderAddress);

    console.log(`\nUsing Foundry keystore: ${keystoreName}`);
    console.log(`SchemaRegistry: ${schemaRegistry}`);
    plans.forEach((plan) => console.log(`  ${plan.key}: ${plan.action} -> ${plan.uid}`));
    console.log("forge", redactSensitiveArgs(args).join(" "));

    execFileSync("forge", args, {
      stdio: "inherit",
      cwd: CONTRACTS_ROOT,
      env: { ...process.env, FOUNDRY_PROFILE: "production", FORGE_BROADCAST: "true" },
    });

    this.mergeIntoDeployment(chainId, definitions, plans, options);
  }

  /**
   * Append-only merge into the canonical artifact.
   *
   * Preparation also promotes the resolver addresses it deployed, since it owns that deployment
   * now. Its side file is the recovery record: a run whose transaction mined but whose merge
   * failed re-runs to the same CREATE2 addresses and rewrites the same values.
   */
  private mergeIntoDeployment(
    chainId: string,
    definitions: CommitmentSchemaDefinition[],
    plans: SchemaRegistrationPlan[],
    options: ParsedOptions,
  ): void {
    const mainDeploymentPath = path.join(CONTRACTS_ROOT, "deployments", `${chainId}-latest.json`);
    if (!fs.existsSync(mainDeploymentPath)) {
      throw new Error(`Main deployment file not found: ${mainDeploymentPath}`);
    }

    const deployment = JSON.parse(fs.readFileSync(mainDeploymentPath, "utf8")) as Record<string, unknown>;
    const schemas =
      typeof deployment.schemas === "object" && deployment.schemas !== null
        ? (deployment.schemas as Record<string, unknown>)
        : {};

    definitions.forEach((definition, index) => {
      schemas[ARTIFACT_KEYS[definition.key]] = plans[index].uid;
      schemas[`${definition.key}Schema`] = schemaString(definition.fields);
      // §6.4.4 lists `*Name` and `*Description` beside the UID and schema string, and every schema
      // already in the artifact carries all four. Omitting them left these two the only entries an
      // operator could not identify without reading config/schemas.json.
      schemas[`${definition.key}Name`] = definition.name;
      schemas[`${definition.key}Description`] = definition.description;
    });
    deployment.schemas = schemas;

    if (options.finalizeCommunityTestimony) {
      this.assertFinalizationSideFileAgrees(chainId, plans);
    } else {
      this.mergePreparedResolver(chainId, deployment);
    }

    fs.writeFileSync(mainDeploymentPath, `${JSON.stringify(deployment, null, 2)}\n`);
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
  private assertFinalizationSideFileAgrees(chainId: string, plans: SchemaRegistrationPlan[]): void {
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
  }

  /** Promote the resolver addresses preparation deployed, from its side file. */
  private mergePreparedResolver(chainId: string, deployment: Record<string, unknown>): void {
    const preparedPath = path.join(CONTRACTS_ROOT, "deployments", `${chainId}-commitment-schemas-prepared.json`);
    if (!fs.existsSync(preparedPath)) return;

    const prepared = JSON.parse(fs.readFileSync(preparedPath, "utf8")) as Record<string, unknown>;
    PREPARATION_KEYS.forEach((key) => {
      const value = prepared[key];
      if (typeof value !== "string" || !value.startsWith("0x") || /^0x0+$/i.test(value)) {
        throw new Error(`Preparation result is missing ${key}; refusing to record a partial deployment`);
      }
      deployment[key] = value;
      console.log(`  ${key}: ${value}`);
    });
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

export default CommitmentSchemasDeployer;
