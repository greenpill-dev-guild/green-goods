import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { getAddress, Interface, isAddress, ZeroAddress } from "ethers";
import { type ParsedOptions, redactSensitiveArgs } from "../utils/cli-parser";
import { DeploymentAddresses } from "../utils/deployment-addresses";
import { CHAIN_ID_MAP, NetworkManager } from "../utils/network";
import { assertSepoliaGate } from "../utils/release-gate";

interface BadgeDeployDependencies {
  networkManager: NetworkManager;
  deploymentAddresses: DeploymentAddresses;
}

interface BadgeLockPlan {
  id: string;
  key: string;
  name: string;
  expirationDuration: bigint;
  expirationLabel: string;
  transferrable: false;
}

interface BadgeLockArtifact {
  factory: string;
  publicLockVersion: number;
  lockCreator: string;
  managerCount: number;
  verifiedGardener: string;
  activeContributor: string;
  stewardship: string;
  gardenOperator: string;
  communityBuilder: string;
  impactVerified: string;
}

interface PersistedBadgeLock {
  badgeId: string;
  address: string;
  name: string;
  expirationDuration: string;
  transferrable: false;
}

const SECONDS_PER_YEAR = 365n * 24n * 60n * 60n;
const MAX_KEYS = (1n << 256n) - 1n;
const DRY_RUN_PUBLIC_LOCK_VERSION = 14;
const DISABLED_TRANSFER_FEE_BASIS_POINTS = 10_000n;

const BADGE_LOCKS: BadgeLockPlan[] = [
  {
    id: "verified-gardener",
    key: "verifiedGardener",
    name: "Green Goods Verified Gardener",
    expirationDuration: 0n,
    expirationLabel: "0 (lifetime)",
    transferrable: false,
  },
  {
    id: "active-contributor",
    key: "activeContributor",
    name: "Green Goods Active Contributor",
    expirationDuration: SECONDS_PER_YEAR,
    expirationLabel: `${SECONDS_PER_YEAR.toString()} (1 year)`,
    transferrable: false,
  },
  {
    id: "stewardship",
    key: "stewardship",
    name: "Green Goods Stewardship",
    expirationDuration: 0n,
    expirationLabel: "0 (lifetime)",
    transferrable: false,
  },
  {
    id: "garden-operator",
    key: "gardenOperator",
    name: "Green Goods Garden Operator",
    expirationDuration: 0n,
    expirationLabel: "0 (manager-revoked)",
    transferrable: false,
  },
  {
    id: "community-builder",
    key: "communityBuilder",
    name: "Green Goods Community Builder",
    expirationDuration: 0n,
    expirationLabel: "0 (lifetime)",
    transferrable: false,
  },
  {
    id: "impact-verified",
    key: "impactVerified",
    name: "Green Goods Impact Verified",
    expirationDuration: 0n,
    expirationLabel: "0 (lifetime)",
    transferrable: false,
  },
];

const unlockFactoryInterface = new Interface([
  "function createLock(bytes data,uint16 lockVersion) returns (address lock)",
]);

const publicLockInterface = new Interface([
  "function initialize(address lockCreator,uint256 expirationDuration,address tokenAddress,uint256 keyPrice,uint256 maxNumberOfKeys,string lockName)",
  "function updateTransferFee(uint256 transferFeeBasisPoints)",
  "function addLockManager(address account)",
]);

export class BadgeLocksDeployer {
  private networkManager: NetworkManager;
  private deploymentAddresses: DeploymentAddresses;

  constructor(networkManager?: NetworkManager, deploymentAddresses?: DeploymentAddresses) {
    this.networkManager = networkManager ?? new NetworkManager();
    this.deploymentAddresses = deploymentAddresses ?? new DeploymentAddresses();
  }

  async deployBadgeLocks(options: ParsedOptions): Promise<void> {
    const networkConfig = this.networkManager.getNetwork(options.network);
    const networkUnlockFactory = networkConfig.contracts?.unlockFactory;
    const deploymentUnlockFactory = this.resolveDeploymentUnlockFactory(options.network);
    const unlockFactory = networkUnlockFactory ?? deploymentUnlockFactory;
    const lockManagers = this.resolveLockManagers();

    console.log(`${options.broadcast ? "Deploying" : "Planning"} GreenWill badge locks for ${options.network}`);

    if (!unlockFactory) {
      throw new Error(
        `badge-locks requires a resolvable Unlock factory address. Add networks.${options.network}.contracts.unlockFactory to networks.json, ` +
          "or record an unlock.factory entry in deployments/<chainId>-latest.json before retrying.",
      );
    }

    if (options.broadcast) {
      this.broadcastBadgeLocks(options, networkConfig.chainId.toString(), unlockFactory, lockManagers);
      return;
    }

    const lockCreator = this.resolveLockCreator(options, lockManagers);
    const plans = BADGE_LOCKS.map((badge) => this.buildPlan(badge, lockCreator, lockManagers));

    console.log("\nDRY RUN - no transactions will be sent");
    console.log(`Network: ${networkConfig.name} (chainId: ${networkConfig.chainId})`);
    console.log(`Unlock factory: ${unlockFactory}`);
    console.log(`Unlock factory source: ${networkUnlockFactory ? "contracts.unlockFactory" : "deployment fallback"}`);
    console.log(`Lock creator: ${lockCreator}`);
    console.log(`Lock version: ${DRY_RUN_PUBLIC_LOCK_VERSION} (dry-run encoding value)`);
    console.log("Token address: native ETH (0x0000000000000000000000000000000000000000)");
    console.log("Key price: 0");
    console.log("Max keys: uint256 max");
    console.log("Transferrable: false");
    console.log(`Default lock managers: ${lockManagers.length > 0 ? lockManagers.join(", ") : "<none configured>"}`);

    console.log("\nPlanned Unlock createLock calldata packets:");
    for (const [index, plan] of plans.entries()) {
      console.log(`\n${index + 1}. ${plan.id}`);
      console.log(`   name: ${plan.name}`);
      console.log(`   expirationDuration: ${plan.expirationLabel}`);
      console.log(`   to: ${unlockFactory}`);
      console.log("   method: createLock(bytes,uint16)");
      console.log(`   lockInitializerCalldata: ${plan.lockInitializerCalldata}`);
      console.log(`   createLockCalldata: ${plan.createLockCalldata}`);
      console.log("   postCreate.transferPolicy: transferrable=false");
      console.log(`   postCreate.updateTransferFeeCalldata: ${plan.updateTransferFeeCalldata}`);

      if (plan.addLockManagerCalldata.length === 0) {
        console.log("   postCreate.lockManagers: <none configured>");
      } else {
        for (const [managerIndex, managerCalldata] of plan.addLockManagerCalldata.entries()) {
          console.log(`   postCreate.addLockManager[${managerIndex}]: ${managerCalldata}`);
        }
      }
    }

    console.log("\nBadge lock dry-run plan complete.");
  }

  private broadcastBadgeLocks(
    options: ParsedOptions,
    chainId: string,
    unlockFactory: string,
    lockManagers: string[],
  ): void {
    assertSepoliaGate({
      network: options.network,
      broadcast: options.broadcast,
      overrideSepoliaGate: options.overrideSepoliaGate,
    });

    const rpcUrl = this.networkManager.getRpcUrl(options.network);
    const args = [
      "script",
      "script/DeployBadgeLocks.s.sol:DeployBadgeLocks",
      "--chain-id",
      chainId,
      "--rpc-url",
      rpcUrl,
    ];
    args.push("--broadcast");

    const keystoreName = process.env.FOUNDRY_KEYSTORE_ACCOUNT || "green-goods-deployer";
    args.push("--account", keystoreName);

    const senderAddress = options.sender ?? process.env.SENDER_ADDRESS;
    if (senderAddress) {
      args.push("--sender", senderAddress);
    }

    console.log(`\nUsing Foundry keystore: ${keystoreName === "green-goods-deployer" ? keystoreName : "[custom]"}`);
    console.log("Password will be prompted interactively");
    console.log(`Unlock factory: ${unlockFactory}`);
    console.log(`Manager defaults: ${lockManagers.length > 0 ? lockManagers.join(", ") : "<none configured>"}`);
    console.log("\nExecuting badge lock deployment...");
    console.log("forge", redactSensitiveArgs(args).join(" "));

    try {
      execFileSync("forge", args, {
        stdio: "inherit",
        env: {
          ...process.env,
          FOUNDRY_PROFILE: "production",
          FORGE_BROADCAST: "true",
        },
        cwd: path.join(__dirname, "../.."),
      });

      this.mergeIntoDeployment(chainId, unlockFactory, lockManagers);
      console.log("\nBadge locks deployed successfully!");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("\nBadge lock deployment failed:", errorMsg);
      process.exit(1);
    }
  }

  private mergeIntoDeployment(chainId: string, unlockFactory: string, lockManagers: string[]): void {
    const deploymentsDir = path.join(__dirname, "../../deployments");
    const badgeLockResultPath = path.join(deploymentsDir, `${chainId}-badge-locks.json`);
    const mainDeploymentPath = path.join(deploymentsDir, `${chainId}-latest.json`);

    if (!fs.existsSync(badgeLockResultPath)) {
      throw new Error(`Badge lock result file not found: ${badgeLockResultPath}`);
    }
    if (!fs.existsSync(mainDeploymentPath)) {
      throw new Error(`Main deployment file not found: ${mainDeploymentPath}`);
    }

    const artifact = JSON.parse(fs.readFileSync(badgeLockResultPath, "utf8")) as Partial<BadgeLockArtifact>;
    const deployment = JSON.parse(fs.readFileSync(mainDeploymentPath, "utf8")) as Record<string, unknown>;
    const existingUnlock =
      typeof deployment.unlock === "object" && deployment.unlock !== null
        ? (deployment.unlock as Record<string, unknown>)
        : {};

    const locks = Object.fromEntries(
      BADGE_LOCKS.map((plan) => {
        const lockAddress = artifact[plan.key as keyof BadgeLockArtifact];
        if (typeof lockAddress !== "string" || !isAddress(lockAddress)) {
          throw new Error(`Badge lock artifact missing a valid ${plan.key} address`);
        }

        const record: PersistedBadgeLock = {
          badgeId: plan.id,
          address: getAddress(lockAddress),
          name: plan.name,
          expirationDuration: plan.expirationDuration.toString(),
          transferrable: false,
        };

        return [plan.key, record];
      }),
    );

    deployment.unlock = {
      ...existingUnlock,
      factory: getAddress(unlockFactory),
      publicLockVersion:
        typeof artifact.publicLockVersion === "number" ? artifact.publicLockVersion : DRY_RUN_PUBLIC_LOCK_VERSION,
      managerDefaults: lockManagers,
      locks,
    };

    fs.writeFileSync(mainDeploymentPath, JSON.stringify(deployment, null, 2) + "\n");
    fs.unlinkSync(badgeLockResultPath);

    console.log(`\nMerged badge locks into ${path.basename(mainDeploymentPath)}`);
    console.log(`  Factory: ${getAddress(unlockFactory)}`);
    console.log(`  Locks:   ${BADGE_LOCKS.map((plan) => plan.key).join(", ")}`);
  }

  private resolveLockCreator(options: ParsedOptions, lockManagers: string[]): string {
    const rawLockCreator =
      options.sender ??
      process.env.SENDER_ADDRESS ??
      lockManagers[0] ??
      this.networkManager.getDeploymentDefault("multisig") ??
      ZeroAddress;

    return isAddress(rawLockCreator) ? getAddress(rawLockCreator) : ZeroAddress;
  }

  private resolveLockManagers(): string[] {
    const configuredManagers = this.networkManager.getDeploymentDefaultAddresses("badgeLockManagers");
    const fallbackManagers = [
      this.networkManager.getDeploymentDefault("multisig"),
      this.networkManager.getDeploymentDefault("greenGoodsSafe"),
    ].filter((value): value is string => Boolean(value));

    const rawManagers = configuredManagers.length > 0 ? configuredManagers : fallbackManagers;

    return [...new Set(rawManagers)].map((manager) => {
      if (!isAddress(manager)) {
        throw new Error(`Invalid badge lock manager address in networks.json: ${manager}`);
      }
      return getAddress(manager);
    });
  }

  private resolveDeploymentUnlockFactory(network: string): string | undefined {
    try {
      const deployment = this.deploymentAddresses.loadForChain(network) as Record<string, unknown>;

      if (typeof deployment.unlockFactory === "string") {
        return deployment.unlockFactory;
      }

      const unlockDeployment = deployment.unlock;
      if (
        typeof unlockDeployment === "object" &&
        unlockDeployment !== null &&
        typeof (unlockDeployment as { factory?: unknown }).factory === "string"
      ) {
        return (unlockDeployment as { factory: string }).factory;
      }
    } catch {
      return undefined;
    }

    return undefined;
  }

  private buildPlan(badge: BadgeLockPlan, lockCreator: string, lockManagers: string[]) {
    const lockInitializerCalldata = publicLockInterface.encodeFunctionData("initialize", [
      lockCreator,
      badge.expirationDuration,
      ZeroAddress,
      0n,
      MAX_KEYS,
      badge.name,
    ]);
    const createLockCalldata = unlockFactoryInterface.encodeFunctionData("createLock", [
      lockInitializerCalldata,
      DRY_RUN_PUBLIC_LOCK_VERSION,
    ]);
    const updateTransferFeeCalldata = publicLockInterface.encodeFunctionData("updateTransferFee", [
      DISABLED_TRANSFER_FEE_BASIS_POINTS,
    ]);
    const addLockManagerCalldata = lockManagers
      .filter((manager) => manager !== lockCreator)
      .map((manager) => publicLockInterface.encodeFunctionData("addLockManager", [manager]));

    return {
      ...badge,
      lockInitializerCalldata,
      createLockCalldata,
      updateTransferFeeCalldata,
      addLockManagerCalldata,
    };
  }
}

export async function deployBadgeLocks(options: ParsedOptions, dependencies: BadgeDeployDependencies): Promise<void> {
  const deployer = new BadgeLocksDeployer(dependencies.networkManager, dependencies.deploymentAddresses);
  await deployer.deployBadgeLocks(options);
}

export default deployBadgeLocks;
