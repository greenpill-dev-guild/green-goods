import { Interface, ZeroAddress } from "ethers";
import type { ParsedOptions } from "../utils/cli-parser";
import { DeploymentAddresses } from "../utils/deployment-addresses";
import { NetworkManager } from "../utils/network";

interface BadgeDeployDependencies {
  networkManager: NetworkManager;
  deploymentAddresses: DeploymentAddresses;
}

interface BadgeLockPlan {
  id: string;
  name: string;
  expirationDuration: bigint;
  expirationLabel: string;
  transferrable: false;
}

const SECONDS_PER_YEAR = 365n * 24n * 60n * 60n;
const MAX_KEYS = (1n << 256n) - 1n;
const DRY_RUN_PUBLIC_LOCK_VERSION = 14;
const DISABLED_TRANSFER_FEE_BASIS_POINTS = 10_000n;

const BADGE_LOCKS: BadgeLockPlan[] = [
  {
    id: "verified-gardener",
    name: "Green Goods Verified Gardener",
    expirationDuration: 0n,
    expirationLabel: "0 (lifetime)",
    transferrable: false,
  },
  {
    id: "active-contributor",
    name: "Green Goods Active Contributor",
    expirationDuration: SECONDS_PER_YEAR,
    expirationLabel: `${SECONDS_PER_YEAR.toString()} (1 year)`,
    transferrable: false,
  },
  {
    id: "stewardship",
    name: "Green Goods Stewardship",
    expirationDuration: 0n,
    expirationLabel: "0 (lifetime)",
    transferrable: false,
  },
  {
    id: "garden-operator",
    name: "Green Goods Garden Operator",
    expirationDuration: 0n,
    expirationLabel: "0 (manager-revoked)",
    transferrable: false,
  },
  {
    id: "community-builder",
    name: "Green Goods Community Builder",
    expirationDuration: 0n,
    expirationLabel: "0 (lifetime)",
    transferrable: false,
  },
  {
    id: "impact-verified",
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
]);

export class BadgeLocksDeployer {
  private networkManager: NetworkManager;
  private deploymentAddresses: DeploymentAddresses;

  constructor(networkManager?: NetworkManager, deploymentAddresses?: DeploymentAddresses) {
    this.networkManager = networkManager ?? new NetworkManager();
    this.deploymentAddresses = deploymentAddresses ?? new DeploymentAddresses();
  }

  async deployBadgeLocks(options: ParsedOptions): Promise<void> {
    console.log(`Planning GreenWill badge locks for ${options.network}`);

    const networkConfig = this.networkManager.getNetwork(options.network);
    const networkUnlockFactory = networkConfig.contracts?.unlockFactory;
    const deploymentUnlockFactory = this.resolveDeploymentUnlockFactory(options.network);
    const unlockFactory = networkUnlockFactory ?? deploymentUnlockFactory;

    if (options.broadcast) {
      throw new Error(
        "badge-locks broadcast is blocked: this target is dry-run planning only. " +
          "Before broadcast can be enabled, add a verified Unlock factory address to " +
          `networks.json under networks.${options.network}.contracts.unlockFactory, ` +
          "wire deployment persistence in DeploymentAddresses, and re-enable this path.",
      );
    }

    if (!unlockFactory) {
      throw new Error(
        "badge-locks dry-run cannot plan without a resolvable Unlock factory address. " +
          `Add networks.${options.network}.contracts.unlockFactory to networks.json, ` +
          "or record an unlock.factory entry in deployments/<chainId>-latest.json.",
      );
    }

    const lockCreator = this.resolveLockCreator(options);
    const plans = BADGE_LOCKS.map((badge) => this.buildPlan(badge, lockCreator));

    console.log("\nDRY RUN - no transactions will be sent (broadcast is blocked)");
    console.log(`Network: ${networkConfig.name} (chainId: ${networkConfig.chainId})`);
    console.log(`Unlock factory: ${unlockFactory}`);
    console.log(`Unlock factory source: ${networkUnlockFactory ? "contracts.unlockFactory" : "deployment fallback"}`);
    console.log(`Lock creator: ${lockCreator}`);
    console.log(`Lock version: ${DRY_RUN_PUBLIC_LOCK_VERSION} (dry-run encoding value)`);
    console.log("Token address: native ETH (0x0000000000000000000000000000000000000000)");
    console.log("Key price: 0");
    console.log("Max keys: uint256 max");
    console.log("Transferrable: false");

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
    }

    console.log("\n[planning-only] Badge lock dry-run plan complete. Broadcast is blocked; see --help.");
  }

  private resolveLockCreator(options: ParsedOptions): string {
    return (
      options.sender ??
      process.env.SENDER_ADDRESS ??
      this.networkManager.getDeploymentDefault("multisig") ??
      ZeroAddress
    );
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

  private buildPlan(badge: BadgeLockPlan, lockCreator: string) {
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

    return {
      ...badge,
      lockInitializerCalldata,
      createLockCalldata,
      updateTransferFeeCalldata,
    };
  }
}

export async function deployBadgeLocks(options: ParsedOptions, dependencies: BadgeDeployDependencies): Promise<void> {
  const deployer = new BadgeLocksDeployer(dependencies.networkManager, dependencies.deploymentAddresses);
  await deployer.deployBadgeLocks(options);
}

export default deployBadgeLocks;
