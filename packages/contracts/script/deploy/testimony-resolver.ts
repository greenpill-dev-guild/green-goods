import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { type ParsedOptions, redactSensitiveArgs } from "../utils/cli-parser";
import { DeploymentAddresses } from "../utils/deployment-addresses";
import { NetworkManager } from "../utils/network";
import { assertSepoliaGate } from "../utils/release-gate";

const CONTRACTS_ROOT = path.join(__dirname, "../..");

/** Artifact keys this target owns in `deployments/{chainId}-latest.json`. */
const TESTIMONY_KEYS = ["testimonyResolver", "testimonyResolverImpl"] as const;

/**
 * Dependencies the deploy reads. The two sibling resolvers are required because the new proxy
 * takes its owner from them rather than from `guardian` — see `_resolverOwner` in
 * `DeployTestimonyResolver.s.sol`.
 */
const REQUIRED_ADDRESSES = [
  { label: "assessmentResolver", parent: null, child: "assessmentResolver" },
  { label: "workApprovalResolver", parent: null, child: "workApprovalResolver" },
  { label: "eas.address", parent: "eas", child: "address" },
] as const;

function isZeroOrMissing(value: unknown): boolean {
  return typeof value !== "string" || !value.startsWith("0x") || /^0x0+$/i.test(value);
}

/**
 * First step of the Commitment Pooling release lane: the community testimony resolver.
 *
 * Its own target rather than part of `pooling` because of an ordering cycle. The community
 * testimony schema's UID is `keccak256(schema, resolver, revocable)`, so the schema cannot be
 * registered until this address exists — but the resolver cannot pin a `schemaUID` until the
 * schema is registered. Deploying unconfigured here breaks the cycle; `pooling-configure` closes
 * it once both halves exist.
 */
export class TestimonyResolverDeployer {
  private networkManager: NetworkManager;
  private deploymentAddresses: DeploymentAddresses;

  constructor(networkManager?: NetworkManager, deploymentAddresses?: DeploymentAddresses) {
    this.networkManager = networkManager ?? new NetworkManager();
    this.deploymentAddresses = deploymentAddresses ?? new DeploymentAddresses();
  }

  async deployTestimonyResolver(options: ParsedOptions): Promise<void> {
    const networkConfig = this.networkManager.getNetwork(options.network);
    const chainId = this.networkManager.getChainIdString(options.network);
    const deployment = this.deploymentAddresses.loadForChain(options.network) as Record<string, unknown>;
    const missing = this.findMissingDependencies(deployment);

    console.log(`${options.broadcast ? "Deploying" : "Planning"} TestimonyResolver for ${options.network}`);
    console.log(`Network: ${networkConfig.name} (chainId: ${networkConfig.chainId})`);

    if (missing.length > 0) {
      throw new Error(
        `TestimonyResolver cannot deploy until these deployment keys are non-zero: ${missing.join(", ")}. ` +
          "Deploy core first, then retry.",
      );
    }

    // Already recorded means there is nothing to do. This is not a redeploy guard — the script's
    // CREATE2 addresses are deterministic, so a rerun cannot produce a second deployment — it just
    // avoids sending a pointless transaction and re-merging identical values.
    const existing = deployment.testimonyResolver;
    if (!isZeroOrMissing(existing)) {
      console.log(`\nTestimonyResolver is already recorded at ${existing}; nothing to do.`);
      console.log("To ship new implementation bytecode, use `bun script/upgrade.ts testimony-resolver`.");
      return;
    }

    this.assertNoSaltOverride(options);

    if (!options.broadcast) {
      this.printDryRunPlan(options, deployment, chainId);
      return;
    }

    this.broadcast(options, chainId);
  }

  /**
   * This target pins its own salt namespace so the recovery address cannot move. A `--salt` or
   * ambient `DEPLOYMENT_SALT` therefore does nothing here — and silently doing nothing is exactly
   * the trap: an operator recovering an interrupted run would believe they had reproduced the
   * original identity. Refuse loudly instead.
   */
  private assertNoSaltOverride(options: ParsedOptions): void {
    if (options.deploymentSalt) {
      throw new Error(
        "testimony-resolver does not accept --salt. Its CREATE2 addresses are pinned to an " +
          "internal namespace so an interrupted run is recoverable from any shell; a salt override " +
          "would move them. To claim a fresh address pair deliberately, bump DEPLOY_VERSION in " +
          "script/DeployTestimonyResolver.s.sol.",
      );
    }
    if (process.env.DEPLOYMENT_SALT) {
      console.log(
        "\nNote: DEPLOYMENT_SALT is set in the environment and is IGNORED by this target. Its " +
          "addresses derive from a pinned internal namespace, not from the shared deploy salt.",
      );
    }
  }

  /**
   * Ask the Foundry script itself for the addresses it will produce, rather than recomputing
   * CREATE2 here. A second derivation is a second thing that can drift from the one that actually
   * deploys. Runs without an RPC.
   */
  private predictAddresses(eas: string, owner: string): { impl: string; proxy: string } | null {
    try {
      const raw = execFileSync(
        "forge",
        [
          "script",
          "script/DeployTestimonyResolver.s.sol:DeployTestimonyResolver",
          "--sig",
          "predictAddresses(address,address)",
          eas,
          owner,
        ],
        { cwd: CONTRACTS_ROOT, env: process.env, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      );
      const found = raw.match(/0x[0-9a-fA-F]{40}/g);
      return found && found.length >= 2 ? { impl: found[0], proxy: found[1] } : null;
    } catch {
      return null;
    }
  }

  private findMissingDependencies(deployment: Record<string, unknown>): string[] {
    return REQUIRED_ADDRESSES.filter(({ parent, child }) => {
      const source = parent ? (deployment[parent] as Record<string, unknown> | undefined) : deployment;
      return isZeroOrMissing(source?.[child]);
    }).map(({ label }) => label);
  }

  /**
   * The owner the Foundry script will read off `assessmentResolver`, reported here so the dry run
   * shows the address the broadcast actually uses. `null` when the RPC is unreachable — the
   * script re-reads it on chain either way, so this is reporting, not a decision.
   */
  private readResolverOwner(network: string, assessmentResolver: string): string | null {
    let rpcUrl: string;
    try {
      rpcUrl = this.networkManager.getRpcUrl(network);
    } catch {
      return null;
    }

    try {
      const raw = execFileSync("cast", ["call", assessmentResolver, "owner()(address)", "--rpc-url", rpcUrl], {
        cwd: CONTRACTS_ROOT,
        env: process.env,
        encoding: "utf8",
        // Reporting only; an unreachable RPC falls back to the note below.
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      return raw.startsWith("0x") ? raw : null;
    } catch {
      return null;
    }
  }

  private printDryRunPlan(options: ParsedOptions, deployment: Record<string, unknown>, chainId: string): void {
    const eas = (deployment.eas as { address?: string } | undefined)?.address as string;
    // `--pure-simulation` promises no RPC calls, so the live owner read is skipped there and the
    // proxy address — which commits to the owner through its initialize calldata — is unknowable.
    const owner = options.pureSimulation
      ? null
      : this.readResolverOwner(options.network, deployment.assessmentResolver as string);
    const predicted = owner ? this.predictAddresses(eas, owner) : null;

    console.log("\nDRY RUN - no transactions will be sent");
    console.log("Script: script/DeployTestimonyResolver.s.sol:DeployTestimonyResolver");
    console.log("\nWould deploy, via CREATE2 with versioned salts:");
    console.log("  - TestimonyResolver implementation (EAS baked into constructor)");
    console.log("  - ERC1967 proxy over it (initialize(owner))");

    console.log("\nDeterministic identity:");
    console.log("  salt namespace:  green-goods:testimony-resolver");
    console.log("  version:         v1   (bump DEPLOY_VERSION to claim a fresh pair on purpose)");
    console.log("  --salt:          rejected by this target; DEPLOYMENT_SALT is ignored");
    if (predicted) {
      console.log(`  implementation:  ${predicted.impl}`);
      console.log(`  proxy:           ${predicted.proxy}`);
      console.log("  Compare both against the runbook before broadcasting. A run interrupted after");
      console.log("  broadcast but before the artifact merge reruns to these same two addresses,");
      console.log("  sends no deployment transaction, and just rewrites the artifact.");
    } else if (options.pureSimulation) {
      console.log("  addresses:       not derivable offline — the proxy commits to the live owner.");
      console.log("                   Re-run without --pure-simulation to print both.");
    } else {
      console.log("  addresses:       unavailable (owner unreadable or forge prediction failed).");
    }

    console.log(`\n  owner:             ${owner ?? "unread — the script reads assessmentResolver.owner()"}`);
    console.log("    (taken from the sibling resolvers, not the artifact guardian, so one sender");
    console.log("     can run pooling-configure across all three)");
    console.log(`  eas (constructor): ${eas}`);
    console.log(`\nWould merge ${TESTIMONY_KEYS.join(", ")} into deployments/${chainId}-latest.json`);
    console.log("\nThe resolver deploys unconfigured. Next steps, in order:");
    console.log("  1. bun script/deploy.ts commitment-schemas  (needs this address for the schema UID)");
    console.log("  2. bun script/deploy.ts pooling");
    console.log("  3. bun script/deploy.ts pooling-configure   (pins the schema and both bridges)");
    console.log("\nTestimony resolver dry-run plan complete.");
  }

  private broadcast(options: ParsedOptions, chainId: string): void {
    assertSepoliaGate({
      network: options.network,
      broadcast: options.broadcast,
      overrideSepoliaGate: options.overrideSepoliaGate,
    });

    const rpcUrl = this.networkManager.getRpcUrl(options.network);
    const args = [
      "script",
      "script/DeployTestimonyResolver.s.sol:DeployTestimonyResolver",
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
    console.log("Password will be prompted interactively");
    console.log("forge", redactSensitiveArgs(args).join(" "));

    execFileSync("forge", args, {
      stdio: "inherit",
      cwd: CONTRACTS_ROOT,
      env: { ...process.env, FOUNDRY_PROFILE: "production", FORGE_BROADCAST: "true" },
    });

    this.mergeIntoDeployment(chainId);
  }

  /** Append-only merge, matching the pooling target: side file first, canonical artifact second. */
  private mergeIntoDeployment(chainId: string): void {
    const deploymentsDir = path.join(CONTRACTS_ROOT, "deployments");
    const resultPath = path.join(deploymentsDir, `${chainId}-testimony-resolver.json`);
    const mainDeploymentPath = path.join(deploymentsDir, `${chainId}-latest.json`);

    if (!fs.existsSync(resultPath)) {
      throw new Error(`Testimony resolver deployment result not found: ${resultPath}`);
    }
    if (!fs.existsSync(mainDeploymentPath)) {
      throw new Error(`Main deployment file not found: ${mainDeploymentPath}`);
    }

    const result = JSON.parse(fs.readFileSync(resultPath, "utf8")) as Record<string, unknown>;
    const deployment = JSON.parse(fs.readFileSync(mainDeploymentPath, "utf8")) as Record<string, unknown>;

    TESTIMONY_KEYS.forEach((key) => {
      if (isZeroOrMissing(result[key])) {
        throw new Error(`Testimony resolver deployment result is missing ${key}`);
      }
      deployment[key] = result[key];
    });

    fs.writeFileSync(mainDeploymentPath, `${JSON.stringify(deployment, null, 2)}\n`);
    fs.unlinkSync(resultPath);

    console.log(`\nMerged testimony resolver addresses into ${path.basename(mainDeploymentPath)}`);
    TESTIMONY_KEYS.forEach((key) => console.log(`  ${key}: ${deployment[key]}`));
    console.log("\nNext: bun script/deploy.ts commitment-schemas --network <network>");
  }
}

export default TestimonyResolverDeployer;
