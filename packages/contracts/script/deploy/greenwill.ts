import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ZeroAddress, getAddress, id, isAddress } from "ethers";
import { type ParsedOptions, redactSensitiveArgs } from "../utils/cli-parser";
import { DeploymentAddresses, type DeploymentData } from "../utils/deployment-addresses";
import { NetworkManager } from "../utils/network";
import { EnvioIntegration } from "../utils/envio-integration";
import { assertSepoliaGate } from "../utils/release-gate";

type BadgeKey = "genesis" | "firstWork" | "firstSupport";
type BadgeSlug = "genesis" | "first-work" | "first-support";
type GreenWillRule = "Hat" | "WorkAttestation" | "VaultShares";

interface PersistedBadgeLock {
  address?: unknown;
}

interface DeploymentWithGreenWill extends DeploymentData {
  eas?: { address?: unknown; schemaRegistry?: unknown };
  schemas?: { workSchemaUID?: unknown };
  unlock?: { locks?: Partial<Record<BadgeKey, PersistedBadgeLock>> };
  greenWillConfig?: {
    owner?: unknown;
    deployer?: unknown;
    genesisHatId?: unknown;
    metadataURIs?: {
      genesis?: unknown;
      firstWork?: unknown;
      firstSupport?: unknown;
    };
  };
  greenWill?: unknown;
}

interface GreenWillArtifact {
  greenWill: string;
  greenWillImplementation: string;
  owner: string;
  deployer: string;
  deploymentRegistry: string;
}

interface GreenWillBadgePlan {
  key: BadgeKey;
  slug: BadgeSlug;
  badgeId: string;
  metadataURI: string;
  validator: string;
  authorizedIssuer: string;
  unlockLock: string;
  rule: GreenWillRule;
  criteria: string;
  unlockDuration: string;
  claimable: true;
  active: true;
}

export interface GreenWillDeploymentPlan {
  network: string;
  chainId: string;
  owner: string;
  deployer?: string;
  deploymentRegistry: string;
  greenWill?: string;
  greenWillImplementation?: string;
  genesisHatId: string;
  badges: {
    genesis: GreenWillBadgePlan;
    firstWork: GreenWillBadgePlan;
    firstSupport: GreenWillBadgePlan;
  };
}

const ZERO_BYTES32 = `0x${"0".repeat(64)}`;
const GENESIS_BADGE_ID = id("GENESIS");
const FIRST_WORK_BADGE_ID = id("FIRST_WORK");
const FIRST_SUPPORT_BADGE_ID = id("FIRST_SUPPORT");

export class GreenWillDeployer {
  private networkManager: NetworkManager;
  private deploymentAddresses: DeploymentAddresses;
  private deploymentsDir: string;

  constructor(networkManager?: NetworkManager, deploymentAddresses?: DeploymentAddresses, deploymentsDir?: string) {
    this.networkManager = networkManager ?? new NetworkManager();
    this.deploymentAddresses = deploymentAddresses ?? new DeploymentAddresses();
    this.deploymentsDir = deploymentsDir ?? path.join(__dirname, "../../deployments");
  }

  async deployGreenWill(options: ParsedOptions): Promise<void> {
    const plan = this.buildDeploymentPlan(options);
    this.printPlan(plan, options.broadcast);

    if (options.broadcast) {
      await this.broadcastGreenWill(options, plan);
      return;
    }

    console.log("\nDRY RUN - no transactions will be sent");
    this.runForgeScript(options, plan, false);
    console.log("\nGreenWill dry-run complete.");
  }

  buildDeploymentPlan(options: ParsedOptions): GreenWillDeploymentPlan {
    const networkConfig = this.networkManager.getNetwork(options.network);
    const chainId = networkConfig.chainId.toString();
    const deployment = this.deploymentAddresses.loadForChain(options.network) as DeploymentWithGreenWill;
    const existingGreenWill = this.optionalAddress(deployment.greenWill);

    if (existingGreenWill && !options.force) {
      throw new Error(
        `GreenWill is already configured for ${options.network}: ${existingGreenWill}. ` +
          "Pass --force only after confirming a replacement deploy is intended.",
      );
    }

    const launchConfig = deployment.greenWillConfig ?? {};
    const metadataURIs = launchConfig.metadataURIs ?? {};
    const owner = this.requiredConfiguredAddress(options.greenWillOwner ?? launchConfig.owner, "greenWillConfig.owner");
    const deployer = this.optionalAddress(launchConfig.deployer);
    const genesisHatId = this.requiredGenesisHatId(
      options.genesisHatId ?? this.optionalString(launchConfig.genesisHatId),
    );
    const genesisCriteria = this.uint256ToBytes32(genesisHatId);
    const deploymentRegistry = this.requiredAddress(deployment.deploymentRegistry, "deploymentRegistry");
    const hats = this.requiredAddress(deployment.hatsModule, "hatsModule");
    const eas = this.requiredAddress(deployment.eas?.address, "eas.address");
    const workSchemaUID = this.requiredBytes32(deployment.schemas?.workSchemaUID, "schemas.workSchemaUID");
    const octantResolver = this.requiredAddress(deployment.octantModule, "octantModule");
    const genesisLock = this.resolveLock(options.genesisLock, deployment, "genesis", "--genesis-lock");
    const firstWorkLock = this.resolveLock(options.firstWorkLock, deployment, "firstWork", "--first-work-lock");
    const firstSupportLock = this.resolveLock(
      options.firstSupportLock,
      deployment,
      "firstSupport",
      "--first-support-lock",
    );

    return {
      network: options.network,
      chainId,
      owner,
      deployer,
      deploymentRegistry,
      genesisHatId: genesisHatId.toString(),
      badges: {
        genesis: {
          key: "genesis",
          slug: "genesis",
          badgeId: GENESIS_BADGE_ID,
          metadataURI: options.genesisMetadataUri ?? this.optionalString(metadataURIs.genesis) ?? "",
          validator: hats,
          authorizedIssuer: ZeroAddress,
          unlockLock: genesisLock,
          rule: "Hat",
          criteria: genesisCriteria,
          unlockDuration: "0",
          claimable: true,
          active: true,
        },
        firstWork: {
          key: "firstWork",
          slug: "first-work",
          badgeId: FIRST_WORK_BADGE_ID,
          metadataURI: options.firstWorkMetadataUri ?? this.optionalString(metadataURIs.firstWork) ?? "",
          validator: eas,
          authorizedIssuer: ZeroAddress,
          unlockLock: firstWorkLock,
          rule: "WorkAttestation",
          criteria: workSchemaUID,
          unlockDuration: "0",
          claimable: true,
          active: true,
        },
        firstSupport: {
          key: "firstSupport",
          slug: "first-support",
          badgeId: FIRST_SUPPORT_BADGE_ID,
          metadataURI: options.firstSupportMetadataUri ?? this.optionalString(metadataURIs.firstSupport) ?? "",
          validator: octantResolver,
          authorizedIssuer: ZeroAddress,
          unlockLock: firstSupportLock,
          rule: "VaultShares",
          criteria: ZERO_BYTES32,
          unlockDuration: "0",
          claimable: true,
          active: true,
        },
      },
    };
  }

  mergeIntoDeployment(chainId: string, plan: GreenWillDeploymentPlan): void {
    const greenWillResultPath = path.join(this.deploymentsDir, `${chainId}-greenwill.json`);
    const mainDeploymentPath = path.join(this.deploymentsDir, `${chainId}-latest.json`);

    if (!fs.existsSync(greenWillResultPath)) {
      throw new Error(`GreenWill result file not found: ${greenWillResultPath}`);
    }
    if (!fs.existsSync(mainDeploymentPath)) {
      throw new Error(`Main deployment file not found: ${mainDeploymentPath}`);
    }

    const artifact = JSON.parse(fs.readFileSync(greenWillResultPath, "utf8")) as Partial<GreenWillArtifact>;
    const deployment = JSON.parse(fs.readFileSync(mainDeploymentPath, "utf8")) as Record<string, unknown>;
    const greenWill = this.requiredAddress(artifact.greenWill, "greenwill artifact greenWill");
    const implementation = this.requiredAddress(
      artifact.greenWillImplementation,
      "greenwill artifact greenWillImplementation",
    );
    const owner = this.requiredAddress(artifact.owner, "greenwill artifact owner");

    deployment.greenWill = greenWill;
    deployment.greenWillBadges = {
      implementation,
      owner,
      deploymentRegistry: plan.deploymentRegistry,
      badges: plan.badges,
    };

    fs.writeFileSync(mainDeploymentPath, JSON.stringify(deployment, null, 2) + "\n");
    fs.unlinkSync(greenWillResultPath);

    console.log(`\nMerged GreenWill deployment into ${path.basename(mainDeploymentPath)}`);
    console.log(`  GreenWill: ${greenWill}`);
    console.log(`  Owner:     ${owner}`);
  }

  private async broadcastGreenWill(options: ParsedOptions, plan: GreenWillDeploymentPlan): Promise<void> {
    assertSepoliaGate({
      network: options.network,
      broadcast: options.broadcast,
      overrideSepoliaGate: options.overrideSepoliaGate,
    });

    const sender = this.requiredBroadcastSender(options, plan);
    this.preflightDeploymentRegistry(options, plan, sender);
    this.runForgeScript(options, plan, true);
    this.mergeIntoDeployment(plan.chainId, plan);

    if (!options.skipEnvio) {
      try {
        await this.updateEnvioConfig(plan.chainId);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn("⚠️  Failed to update Envio config:", message);
        console.warn(
          `   Run manually: cd packages/contracts && bun script/utils/envio-integration.ts update ${plan.chainId}`,
        );
      }
    }

    console.log("\nGreenWill deployed successfully.");
    console.log("Next indexer step: cd packages/indexer && bun run codegen && bun run check:indexing-boundary");
  }

  private preflightDeploymentRegistry(options: ParsedOptions, plan: GreenWillDeploymentPlan, sender: string): void {
    const rpcUrl = this.networkManager.getRpcUrl(options.network);

    try {
      this.castCall(plan.deploymentRegistry, "getGreenWill()(address)", [], rpcUrl);
    } catch {
      throw new Error(
        "GreenWill broadcast blocked before sending transactions: the live DeploymentRegistry does not expose " +
          "getGreenWill/updateGreenWill. Upgrade the DeploymentRegistry implementation before broadcasting GreenWill.",
      );
    }

    const paused = this.castCall(plan.deploymentRegistry, "emergencyPaused()(bool)", [], rpcUrl).trim();
    if (paused === "true") {
      throw new Error("GreenWill broadcast blocked before sending transactions: DeploymentRegistry is paused.");
    }

    const owner = getAddress(this.castCall(plan.deploymentRegistry, "owner()(address)", [], rpcUrl).trim());
    const isAllowlisted =
      this.castCall(plan.deploymentRegistry, "isInAllowlist(address)(bool)", [sender], rpcUrl).trim() === "true";

    if (owner !== sender && !isAllowlisted) {
      throw new Error(
        `GreenWill broadcast blocked before sending transactions: --sender ${sender} is not the DeploymentRegistry owner or allowlisted updater.`,
      );
    }
  }

  private castCall(contract: string, signature: string, args: string[], rpcUrl: string): string {
    return execFileSync("cast", ["call", contract, signature, ...args, "--rpc-url", rpcUrl], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  }

  private runForgeScript(options: ParsedOptions, plan: GreenWillDeploymentPlan, broadcast: boolean): void {
    const rpcUrl = this.networkManager.getRpcUrl(options.network);
    const args = [
      "script",
      "script/DeployGreenWill.s.sol:DeployGreenWill",
      "--chain-id",
      plan.chainId,
      "--rpc-url",
      rpcUrl,
    ];

    if (broadcast) {
      args.push("--broadcast");
      const keystoreName = process.env.FOUNDRY_KEYSTORE_ACCOUNT || "green-goods-deployer";
      args.push("--account", keystoreName);
    }

    const senderAddress = options.sender ?? plan.deployer ?? process.env.SENDER_ADDRESS;
    if (senderAddress) {
      args.push("--sender", senderAddress);
    }

    if (options.deploymentSalt) {
      console.warn(
        "⚠️  --salt is accepted by the shared parser but GreenWill deploy currently uses standard proxy deployment.",
      );
    }

    console.log("\nExecuting GreenWill deployment script...");
    console.log("forge", redactSensitiveArgs(args).join(" "));

    execFileSync("forge", args, {
      stdio: "inherit",
      env: {
        ...process.env,
        FOUNDRY_PROFILE: "production",
        GREENWILL_WRITE_ARTIFACT: broadcast ? "true" : "false",
        GREENWILL_OWNER: plan.owner,
        GREENWILL_DEPLOYMENT_REGISTRY: plan.deploymentRegistry,
        GREENWILL_HATS: plan.badges.genesis.validator,
        GREENWILL_EAS: plan.badges.firstWork.validator,
        GREENWILL_OCTANT_RESOLVER: plan.badges.firstSupport.validator,
        GREENWILL_WORK_SCHEMA_UID: plan.badges.firstWork.criteria,
        GREENWILL_GENESIS_HAT_ID: plan.genesisHatId,
        GREENWILL_GENESIS_LOCK: plan.badges.genesis.unlockLock,
        GREENWILL_FIRST_WORK_LOCK: plan.badges.firstWork.unlockLock,
        GREENWILL_FIRST_SUPPORT_LOCK: plan.badges.firstSupport.unlockLock,
        GREENWILL_GENESIS_METADATA_URI: plan.badges.genesis.metadataURI,
        GREENWILL_FIRST_WORK_METADATA_URI: plan.badges.firstWork.metadataURI,
        GREENWILL_FIRST_SUPPORT_METADATA_URI: plan.badges.firstSupport.metadataURI,
      },
      cwd: path.join(__dirname, "../.."),
    });
  }

  private async updateEnvioConfig(chainId: string): Promise<void> {
    const envioIntegration = new EnvioIntegration();
    await envioIntegration.updateEnvioConfig(chainId);
  }

  private printPlan(plan: GreenWillDeploymentPlan, broadcast: boolean): void {
    console.log(`${broadcast ? "Deploying" : "Planning"} GreenWill for ${plan.network}`);
    console.log(`Network: ${plan.network} (chainId: ${plan.chainId})`);
    console.log(`Owner: ${plan.owner}`);
    console.log(`Deployer/sender: ${plan.deployer ?? "<from --sender or env>"}`);
    console.log(`DeploymentRegistry: ${plan.deploymentRegistry}`);
    console.log(`Genesis hat ID: ${plan.genesisHatId}`);
    console.log("Metadata URIs: empty string means media can be attached later by the owner.");
    console.log("\nBadge configuration:");

    for (const badge of Object.values(plan.badges)) {
      console.log(`\n- ${badge.slug}`);
      console.log(`  badgeId: ${badge.badgeId}`);
      console.log(`  rule: ${badge.rule}`);
      console.log(`  criteria: ${badge.criteria}`);
      console.log(`  validator: ${badge.validator}`);
      console.log(`  unlockLock: ${badge.unlockLock}`);
      console.log(`  metadataURI: ${badge.metadataURI || "<empty>"}`);
      console.log(`  active/claimable: ${badge.active}/${badge.claimable}`);
    }
  }

  private resolveLock(
    override: string | undefined,
    deployment: DeploymentWithGreenWill,
    key: BadgeKey,
    flagName: string,
  ): string {
    const artifactAddress = deployment.unlock?.locks?.[key]?.address;
    const value = override ?? artifactAddress;
    const artifactPath = `unlock.locks.${key}.address`;
    const help = `Run badge-locks --broadcast first, or pass ${flagName} for dry-run/testing.`;
    return this.requiredAddress(value, `${artifactPath} (${help})`);
  }

  private optionalAddress(value: unknown): string | undefined {
    if (typeof value !== "string" || !isAddress(value)) return undefined;
    const checksummed = getAddress(value);
    return checksummed === ZeroAddress ? undefined : checksummed;
  }

  private optionalString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
  }

  private requiredConfiguredAddress(value: unknown, configPath: string): string {
    if (!value) {
      throw new Error(`GreenWill deploy requires ${configPath} or a CLI override; do not rely on deployer ownership.`);
    }
    return this.requiredAddress(value, configPath);
  }

  private requiredAddress(value: unknown, label: string): string {
    if (typeof value !== "string" || !isAddress(value)) {
      throw new Error(`GreenWill deploy requires a valid non-zero address for ${label}.`);
    }

    const checksummed = getAddress(value);
    if (checksummed === ZeroAddress) {
      throw new Error(`GreenWill deploy requires a non-zero address for ${label}.`);
    }

    return checksummed;
  }

  private requiredBytes32(value: unknown, label: string): string {
    if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
      throw new Error(`GreenWill deploy requires a valid bytes32 for ${label}.`);
    }
    if (value.toLowerCase() === ZERO_BYTES32) {
      throw new Error(`GreenWill deploy requires a non-zero bytes32 for ${label}.`);
    }
    return value.toLowerCase();
  }

  private requiredGenesisHatId(value: string | undefined): bigint {
    if (!value) {
      throw new Error(
        "GreenWill deploy requires greenWillConfig.genesisHatId or --genesis-hat-id for the Genesis Hats eligibility rule.",
      );
    }

    let parsed: bigint;
    try {
      parsed = BigInt(value);
    } catch {
      throw new Error("--genesis-hat-id must be a uint256 decimal or hex value.");
    }

    if (parsed <= 0n) {
      throw new Error("--genesis-hat-id must be greater than zero.");
    }
    if (parsed >= 1n << 256n) {
      throw new Error("--genesis-hat-id must fit in uint256.");
    }

    return parsed;
  }

  private uint256ToBytes32(value: bigint): string {
    return `0x${value.toString(16).padStart(64, "0")}`;
  }

  private requiredBroadcastSender(options: ParsedOptions, plan: GreenWillDeploymentPlan): string {
    const sender = options.sender ?? plan.deployer ?? process.env.SENDER_ADDRESS;
    if (!sender) {
      throw new Error(
        "GreenWill broadcast requires greenWillConfig.deployer or --sender so the deployer can preflight DeploymentRegistry owner/allowlist access.",
      );
    }
    return this.requiredAddress(sender, "--sender");
  }
}
