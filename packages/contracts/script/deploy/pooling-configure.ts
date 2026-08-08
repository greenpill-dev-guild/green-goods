import { execFileSync } from "node:child_process";
import * as path from "node:path";
import { type ParsedOptions, redactSensitiveArgs } from "../utils/cli-parser";
import { DeploymentAddresses } from "../utils/deployment-addresses";
import { NetworkManager } from "../utils/network";
import {
  type PoolingConfigurationState,
  type PoolingConfigurationStep,
  type PoolingConfigurationTargets,
  assertProxyOwnership,
  configurationOwnerTargets,
  planPoolingConfiguration,
  readPoolingConfigurationTargets,
} from "../utils/pooling-release";
import { assertSepoliaGate } from "../utils/release-gate";

const CONTRACTS_ROOT = path.join(__dirname, "../..");

const ZERO_ADDRESS = `0x${"0".repeat(40)}`;
const ZERO_UID = `0x${"0".repeat(64)}`;

/** Every value zero — what an unconfigured chain looks like, and the safe planning default. */
const UNCONFIGURED_STATE: PoolingConfigurationState = {
  assessmentSchemaUID: ZERO_UID,
  assessmentV3SchemaUID: ZERO_UID,
  testimonySchemaUID: ZERO_UID,
  testimonyCommitmentModule: ZERO_ADDRESS,
  workApprovalCommitmentModule: ZERO_ADDRESS,
};

interface ObservedState {
  state: PoolingConfigurationState;
  /** False when the values are assumed rather than read, so the plan can say so. */
  live: boolean;
}

/** Live reads, in the order the plan reports them. */
const STATE_READS = [
  { field: "assessmentSchemaUID", target: "assessmentResolver", selector: "schemaUID()(bytes32)" },
  {
    field: "assessmentV3SchemaUID",
    target: "assessmentResolver",
    selector: "assessmentV3SchemaUID()(bytes32)",
  },
  { field: "testimonySchemaUID", target: "testimonyResolver", selector: "schemaUID()(bytes32)" },
  {
    field: "testimonyCommitmentModule",
    target: "testimonyResolver",
    selector: "commitmentModule()(address)",
  },
  {
    field: "workApprovalCommitmentModule",
    target: "workApprovalResolver",
    selector: "commitmentModule()(address)",
  },
] as const satisfies ReadonlyArray<{
  field: keyof PoolingConfigurationState;
  target: keyof PoolingConfigurationTargets;
  selector: string;
}>;

/**
 * Final step of the Commitment Pooling release lane: the five resolver calls that connect the
 * deployed contracts to each other.
 *
 * Nothing here deploys. Until `workApprovalResolver.setCommitmentModule` lands, the resolver never
 * calls `onWorkDecision`, so approved work earns no commitment credit and a fully deployed,
 * wired, unpaused module is still inert.
 *
 * Safe to re-run: the plan reads live state first and reports each step as `set` or `satisfied`.
 * Any divergence between chain and artifact fails closed rather than overwriting — these are live
 * proxies handling real attestations.
 */
export class PoolingConfigureDeployer {
  private networkManager: NetworkManager;
  private deploymentAddresses: DeploymentAddresses;

  constructor(networkManager?: NetworkManager, deploymentAddresses?: DeploymentAddresses) {
    this.networkManager = networkManager ?? new NetworkManager();
    this.deploymentAddresses = deploymentAddresses ?? new DeploymentAddresses();
  }

  async configurePooling(options: ParsedOptions): Promise<void> {
    const networkConfig = this.networkManager.getNetwork(options.network);
    const chainId = this.networkManager.getChainIdString(options.network);
    const deployment = this.deploymentAddresses.loadForChain(options.network) as Record<string, unknown>;
    const targets = readPoolingConfigurationTargets(deployment);

    console.log(
      `${options.broadcast ? "Configuring" : "Planning"} Commitment Pooling resolvers for ${options.network}`,
    );
    console.log(`Network: ${networkConfig.name} (chainId: ${networkConfig.chainId})`);

    const observed = this.readLiveState(options, targets);
    const plan = planPoolingConfiguration(targets, observed.state);

    this.printPlan(plan, observed.live);
    this.assertSingleOwner(options, plan);

    if (!options.broadcast) {
      console.log("\nDRY RUN - no transactions will be sent");
      console.log("Script: script/ConfigurePooling.s.sol:ConfigurePooling");
      console.log("\nPooling configuration dry-run plan complete.");
      return;
    }

    this.broadcast(options, chainId);
  }

  /**
   * Read what the three proxies currently hold. A pure simulation, or an unreachable RPC, plans
   * against an unconfigured chain: that is the maximal plan, so it can never under-report work.
   * The broadcast re-reads on chain through `PoolingConfiguration`, which is what actually decides
   * each step, so an optimistic plan here cannot cause a wrong write.
   */
  private readLiveState(options: ParsedOptions, targets: PoolingConfigurationTargets): ObservedState {
    const assumed = { state: UNCONFIGURED_STATE, live: false };
    if (options.pureSimulation) return assumed;

    let rpcUrl: string;
    try {
      rpcUrl = this.networkManager.getRpcUrl(options.network);
    } catch {
      return assumed;
    }

    const state = { ...UNCONFIGURED_STATE };
    for (const read of STATE_READS) {
      try {
        const raw = execFileSync("cast", ["call", targets[read.target], read.selector, "--rpc-url", rpcUrl], {
          cwd: CONTRACTS_ROOT,
          env: process.env,
          encoding: "utf8",
          // A failed read is handled below; cast's connect errors are noise on a dry run.
          stdio: ["ignore", "pipe", "ignore"],
        }).trim();
        if (raw.startsWith("0x")) state[read.field] = raw;
      } catch {
        return assumed;
      }
    }
    return { state, live: true };
  }

  /**
   * All five calls are `onlyOwner` across three separate proxies, so the run only works if one
   * account owns all three. On Arbitrum One the resolvers are owned by the deployer rather than
   * the artifact's `guardian`, which is exactly the kind of divergence that burns a nonce halfway
   * through a broadcast.
   *
   * A broadcast FAILS CLOSED on anything it cannot prove: no RPC, an unreadable `owner()`, or a
   * missing `--sender` all refuse to send. Earlier this returned early and broadcast anyway, which
   * defeated the point of the check. A dry run degrades to a printed note instead, because its
   * whole job is to be usable before a signer exists.
   *
   * `ConfigurePooling.s.sol` re-proves ownership on chain before its first write, so this is a
   * readable early failure rather than the authority. Note that neither check is atomic with the
   * setters: forge submits each as its own transaction, so both prove ownership at simulation
   * time. Ownership moving mid-broadcast can still split configuration across owners, and only a
   * runbook freeze or an owner-side atomic executor closes that.
   *
   * Skipped when nothing would be written, so a confirmatory re-run does not demand a sender.
   */
  private assertSingleOwner(options: ParsedOptions, plan: PoolingConfigurationStep[]): void {
    if (plan.every((step) => step.action === "satisfied")) return;

    // `--pure-simulation` promises no RPC calls at all, and `readLiveState` already honours it.
    // Reaching for `owner()` here anyway would break that contract for an air-gapped preflight —
    // and quietly, since the failure is a timeout rather than an error. A broadcast never takes
    // this branch: `--pure-simulation` is a dry-run flag, and the check below still fails closed.
    if (options.pureSimulation && !options.broadcast) {
      console.log("\nOwner preflight skipped: --pure-simulation makes no RPC calls.");
      console.log("Re-run without it, with --sender, before broadcasting.");
      return;
    }

    let rpcUrl: string;
    try {
      rpcUrl = this.networkManager.getRpcUrl(options.network);
    } catch {
      this.ownerPreflightUnavailable(options, `no RPC is configured for ${options.network}`);
      return;
    }

    const owners = configurationOwnerTargets(plan).map((proxy) => ({
      ...proxy,
      owner: this.readOwner(proxy.address, rpcUrl),
    }));

    const unreadable = owners.filter((observation) => !observation.owner);
    if (unreadable.length > 0) {
      this.ownerPreflightUnavailable(
        options,
        `owner() was unreadable on ${unreadable.map((observation) => observation.label).join(", ")}`,
      );
      return;
    }

    console.log("\nResolver owners:");
    owners.forEach((observation) => console.log(`  ${observation.label}: ${observation.owner}`));

    const sender = options.sender ?? process.env.SENDER_ADDRESS;
    if (!sender && !options.broadcast) {
      console.log("No --sender given; a broadcast will require one that owns every resolver above.");
      return;
    }

    assertProxyOwnership(owners, sender);
    console.log("Owner preflight passed: one sender owns every resolver this run writes to.");
  }

  /** A broadcast that cannot prove ownership refuses; a dry run says so and continues. */
  private ownerPreflightUnavailable(options: ParsedOptions, reason: string): void {
    if (options.broadcast) {
      throw new Error(
        `Owner preflight could not run (${reason}), so this broadcast is refused. Every configuration ` +
          "call is onlyOwner across three proxies; sending blind risks applying some steps and reverting " +
          "on the rest. Provide a reachable RPC and --sender, then retry.",
      );
    }
    console.log(`\nOwner preflight unavailable (${reason}); a broadcast would refuse to run.`);
  }

  private readOwner(address: string, rpcUrl: string): string | null {
    try {
      const raw = execFileSync("cast", ["call", address, "owner()(address)", "--rpc-url", rpcUrl], {
        cwd: CONTRACTS_ROOT,
        env: process.env,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      return raw.startsWith("0x") ? raw : null;
    } catch {
      return null;
    }
  }

  private printPlan(plan: PoolingConfigurationStep[], live: boolean): void {
    if (!live) {
      console.log("\nLive state unavailable (pure simulation or unreachable RPC); planning against an");
      console.log("unconfigured chain. The broadcast re-reads each value on chain before writing.");
    }

    console.log("\nConfiguration steps, in dependency order:");
    plan.forEach((step, index) => {
      console.log(`\n  ${index + 1}. ${step.key} [${step.action}]`);
      console.log(`     ${step.target} ${step.address}`);
      console.log(`     ${step.signature} <- ${step.argument}`);
    });

    const writes = plan.filter((step) => step.action === "set").length;
    console.log(
      writes === 0
        ? "\nEvery step is already satisfied on chain; this run would send no transactions."
        : `\n${writes} of ${plan.length} steps would be written.`,
    );
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
      "script/ConfigurePooling.s.sol:ConfigurePooling",
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

    // The script requires this and will not infer an owner. It is only set here after
    // `assertSingleOwner` proved this sender equals every live `owner()`.
    if (!senderAddress) {
      throw new Error("pooling-configure requires --sender (or SENDER_ADDRESS) to declare the expected resolver owner");
    }

    execFileSync("forge", args, {
      stdio: "inherit",
      cwd: CONTRACTS_ROOT,
      env: {
        ...process.env,
        FOUNDRY_PROFILE: "production",
        FORGE_BROADCAST: "true",
        POOLING_CONFIGURE_EXPECTED_OWNER: senderAddress,
      },
    });

    console.log("\nCommitment Pooling resolvers configured. The work-approval bridge is live:");
    console.log("approved work now earns commitment credit through onWorkDecision.");
  }
}

export default PoolingConfigureDeployer;
