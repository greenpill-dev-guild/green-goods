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
    const definitions = loadCommitmentSchemas();

    console.log(
      `${options.broadcast ? "Registering" : "Planning"} commitment EAS schemas for ${options.network} ` +
        `(chainId: ${networkConfig.chainId})`,
    );
    console.log(`SchemaRegistry: ${schemaRegistry}`);

    const plans = definitions.map((definition) => this.planFor(definition, deployment, schemaRegistry, options));

    if (!options.broadcast) {
      this.printPlan(definitions, plans, chainId);
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

    this.mergeIntoDeployment(chainId, definitions, plans);
  }

  /** Append-only merge of both UIDs into the canonical artifact's `schemas` block. */
  private mergeIntoDeployment(
    chainId: string,
    definitions: CommitmentSchemaDefinition[],
    plans: SchemaRegistrationPlan[],
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
    });
    deployment.schemas = schemas;

    fs.writeFileSync(mainDeploymentPath, `${JSON.stringify(deployment, null, 2)}\n`);
    console.log(`\nMerged commitment schema UIDs into ${path.basename(mainDeploymentPath)}`);
    plans.forEach((plan) => console.log(`  ${plan.key}: ${plan.uid}`));
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
