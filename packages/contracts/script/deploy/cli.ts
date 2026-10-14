#!/usr/bin/env bun

import { execFileSync } from "node:child_process";
import path from "node:path";
import { CliParser } from "../utils/cli-parser";
import { DeploymentAddresses } from "../utils/deployment-addresses";
import { formatENSSponsorStatus, getENSSponsorStatus, isGreenGoodsENSConfigured } from "../utils/ens-sponsor";
import { NetworkManager } from "../utils/network";
import { ActionDeployer } from "./actions";
import { AnvilManager } from "./anvil";
import { BadgeLocksDeployer } from "./badge-locks";
import { BadgeSchemasDeployer } from "./badge-schemas";
import { CommitmentSchemasDeployer } from "./commitment-schemas";
import { CoreDeployer } from "./core";
import { GardenDeployer } from "./gardens";
import { GoodsDeployer } from "./goods";
import { GreenWillDeployer } from "./greenwill";
import { HatsTreeDeployer } from "./hats";
import { OctantFactoryDeployer } from "./octant-factory";
import { PoolingConfigureDeployer } from "./pooling-configure";
import { ReleaseDeployer } from "./release";

const CONTRACTS_ROOT = path.join(__dirname, "../..");

/**
 * Main CLI entry. Shared NetworkManager, AnvilManager, and
 * DeploymentAddresses are constructed once and injected into every deployer
 * so file reads aren't repeated and configuration stays consistent.
 */
export class DeploymentCLI {
  private parser: CliParser;
  private networkManager: NetworkManager;
  private deploymentAddresses: DeploymentAddresses;
  private coreDeployer: CoreDeployer;
  private gardenDeployer: GardenDeployer;
  private actionDeployer: ActionDeployer;
  private anvilManager: AnvilManager;
  private hatsTreeDeployer: HatsTreeDeployer;
  private goodsDeployer: GoodsDeployer;
  private octantFactoryDeployer: OctantFactoryDeployer;
  private badgeLocksDeployer: BadgeLocksDeployer;
  private badgeSchemasDeployer: BadgeSchemasDeployer;
  private greenWillDeployer: GreenWillDeployer;
  private commitmentSchemasDeployer: CommitmentSchemasDeployer;
  private poolingConfigureDeployer: PoolingConfigureDeployer;
  private releaseDeployer: ReleaseDeployer;

  constructor() {
    this.parser = new CliParser();

    // Shared dependencies — single instance each
    this.networkManager = new NetworkManager();
    this.anvilManager = new AnvilManager(this.networkManager);
    this.deploymentAddresses = new DeploymentAddresses();

    // Inject shared dependencies into deployers
    this.coreDeployer = new CoreDeployer(this.networkManager, this.anvilManager);
    this.gardenDeployer = new GardenDeployer(this.networkManager, this.anvilManager, this.deploymentAddresses);
    this.actionDeployer = new ActionDeployer(this.networkManager, this.anvilManager, this.deploymentAddresses);
    this.hatsTreeDeployer = new HatsTreeDeployer(this.networkManager, this.deploymentAddresses);
    this.goodsDeployer = new GoodsDeployer(this.networkManager, this.anvilManager);
    this.octantFactoryDeployer = new OctantFactoryDeployer(this.networkManager, this.anvilManager);
    this.badgeLocksDeployer = new BadgeLocksDeployer(this.networkManager, this.deploymentAddresses);
    this.badgeSchemasDeployer = new BadgeSchemasDeployer(this.networkManager, this.deploymentAddresses);
    this.greenWillDeployer = new GreenWillDeployer(this.networkManager, this.deploymentAddresses);
    this.commitmentSchemasDeployer = new CommitmentSchemasDeployer(this.networkManager, this.deploymentAddresses);
    this.poolingConfigureDeployer = new PoolingConfigureDeployer(this.networkManager, this.deploymentAddresses);
    this.releaseDeployer = new ReleaseDeployer(this.networkManager);
  }

  /**
   * Show help message
   */
  showHelp(): void {
    console.log(`
Green Goods Deployment CLI

Usage: bun run contracts -- deploy <command> [options]

Commands:
  core                     Deploy core contracts
  goods                    Deploy GOODS Juicebox project (requires env vars)
  juicebox                 Alias for 'goods' deployment
  octant-factory           Deploy Octant vault factory (auto-updates deployment JSON)
  garden <config.json>     Deploy garden from config file
  actions <config.json>    Deploy actions from config file
  hats-tree                Create and configure the Hats protocol tree
  badge-locks              Deploy or dry-run GreenWill reputation badge Unlock locks
  greenwill                Deploy or dry-run initial GreenWill proxy and three-badge config
  badge-schemas            Future/backlog: deploy GreenWill portable EAS badge schema
  commitment-schemas       Pooling lane step 1: deploy the testimony resolver, register assessment v3,
                           and pin the community testimony UID (add --finalize-community-testimony
                           after 'pooling' to register the record and activate the resolver)
  pooling                  Deterministically deploy CommitmentPoolingModule, its 14 libraries,
                           and CommitmentRegistry (module stays paused)
  pooling-configure        Legacy resolver-only compatibility target; release plans use 'pooling'
  release-manifest         Validate the combined pooling/settlement/credit manifest and identity lock
  protocol-core            Print the dependency-ordered Arbitrum core release plan
  ownership-transfer      Transfer one reviewed proxy owner boundary to the protocol Safe
  settlement-module       Deploy/plan the paused Arbitrum SettlementModule and its six libraries
  credit-registry         Deploy/plan the paused records-only CreditRegistry and settlement binding
  settlement-executor     Deploy/plan the paused Celo executor (--network celo only)
  safe-plan               Produce the inert Safe prediction/Zodiac Roles plan
  settlement-peer         Plan peer wiring after fresh bidirectional route verification
  settlement-peer-verify  Prove a sent peer-wiring call matches the reviewed plan
  release-recover         Produce deterministic artifact recovery inputs
  release-verify          Reread release code, proxy, owner, peer, pause, and artifact state
  indexer-handoff         Produce an inert Envio activation/reindex/read-back plan
  ens-migrate              Reconcile Arbitrum ENS sends and migrate missing mainnet receiver records
  status [network]         Check deployment status
  fork <network>           Start Anvil fork for network

Common Options:
  --network, -n <network>  Network to deploy to (default: localhost)
  --broadcast, -b          Broadcast transactions
  --save-artifacts         Save forge broadcast artifacts without broadcasting
  --sender <address>       Override tx sender address
  --stage <name>           Exact release stage for verification or artifact recovery
  --step <index>           One-based release transaction boundary (required for broadcast)
  --expected-nonce <n>     Exact pending nonce authorized for a release boundary
  --artifact <path>        Explicit release/recovery artifact for read-only verification
  --owner-phase <phase>    Verify release proxy owners in deployment or safe phase
  --update-schemas         Only update schemas, skip existing contracts
  --force                  Force fresh deployment
  --dry-run                Run full deployment simulation against RPC (no broadcast)
  --pure-simulation        Run compile-only preflight (no RPC calls)
  --tx-plan                Persist an exact nonce-pinned transaction plan without broadcasting
  --salt <value>           Override deployment salt string for CREATE2
  --owner <address>        Optional GreenWill owner override; defaults to deployment greenWillConfig.owner
  --genesis-hat-id <id>    Optional Genesis Hats override; defaults to deployment greenWillConfig.genesisHatId
  --genesis-lock <addr>    Optional GreenWill Genesis lock override
  --first-work-lock <addr> Optional GreenWill First Work lock override
  --first-support-lock <addr> Optional GreenWill First Support lock override
  --override-sepolia-gate  Bypass Sepolia gate for Arbitrum/Celo broadcast
  --help, -h               Show this help

Examples:
  # Fresh deployment
  bun run contracts -- deploy core --network sepolia --mode broadcast

  # Update schemas only
  bun run contracts -- deploy core --network sepolia --mode broadcast --update-schemas

  # Deploy garden
  bun run contracts -- deploy garden config/my-garden.json --network arbitrum --mode broadcast

  # Deploy actions
  bun run contracts -- deploy actions config/my-actions.json --network arbitrum --mode broadcast

  # Deploy Octant vault factory
  bun run contracts -- deploy octant-factory --network arbitrum --mode broadcast

  # Create Hats tree
  bun run contracts -- deploy hats-tree --network sepolia --mode broadcast

  # Plan initial GreenWill badge locks and proxy configuration
  bun run contracts -- deploy badge-locks --network arbitrum --mode preflight
  bun run contracts -- deploy greenwill --network arbitrum --mode simulate

  # Broadcast initial GreenWill badge locks and proxy configuration
  bun run contracts -- deploy badge-locks --network arbitrum --mode broadcast
  bun run contracts -- deploy greenwill --network arbitrum --mode broadcast

  # Future/backlog portable badge attestation schema, not required for initial three-badge launch
  bun run contracts -- deploy badge-schemas --network arbitrum --mode preflight

  # Migrate stuck greengoods.eth registrations into the current mainnet receiver
  bun run contracts -- ens migrate --network mainnet --mode broadcast

  # Plan the Commitment Pooling lane, in order. Each step's output is the next step's input, so
  # the sequence cannot be reordered. Rehearse the whole thing first on an Arbitrum One fork:
  #   APP_ENV=development bun run --cwd packages/contracts test:shard run pooling-arbitrum
  bun run contracts -- deploy commitment-schemas --network arbitrum --mode plan --sender 0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6 --expected-nonce <fresh-pending-nonce>
  bun run contracts -- deploy pooling --network arbitrum --mode simulate --expected-nonce <fresh-pending-nonce>
  bun run contracts -- deploy commitment-schemas --network arbitrum --mode plan --finalize-community-testimony --sender 0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6 --expected-nonce <fresh-pending-nonce>
  bun run contracts -- upgrade commitment-pooling --network arbitrum --mode plan --sender 0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6 --expected-nonce <fresh-pending-nonce>
  bun run contracts -- pooling backfill --network arbitrum --mode simulate --authority deployer

  # Phase A release engineering (never broadcasts)
  bun run contracts -- release manifest --network arbitrum
  bun run contracts -- release core --network arbitrum --mode preflight
  bun run contracts -- deploy settlement-module --network arbitrum --mode preflight --expected-nonce <fresh-pending-nonce>
  bun run contracts -- deploy credit-registry --network arbitrum --mode preflight --expected-nonce <fresh-pending-nonce>
  bun run contracts -- deploy settlement-executor --network celo --mode preflight --expected-nonce <fresh-pending-nonce>
  bun run contracts -- settlement safe --network celo --mode preflight
  bun run contracts -- release verify --network arbitrum --mode preflight
  bun run contracts -- release indexer-handoff --network arbitrum --mode preflight

Available networks: ${this.networkManager.getAvailableNetworks().join(", ")}

Note: Contracts are automatically verified on all networks except localhost.
For UUPS upgrades, use: bun run contracts -- upgrade <contract> --network <network> --mode broadcast
    `);
  }

  /**
   * Check deployment status for a network
   * @param network - Network name (null for all networks)
   */
  async checkDeploymentStatus(network: string | null): Promise<void> {
    console.log("🚀 Green Goods Deployment Status\n");

    if (network) {
      try {
        const addresses = this.deploymentAddresses.loadForChain(network);
        const networkConfig = this.deploymentAddresses.getNetworkConfig(network);
        const communityToken = this.deploymentAddresses.getCommunityToken(network);

        console.log(`✅ Chain ${network} (${networkConfig.name})`);
        console.log(`   Garden Token: ${addresses.gardenToken}`);
        console.log(`   Action Registry: ${addresses.actionRegistry}`);
        console.log(`   Community Token: ${communityToken}`);
        console.log(`   Deployment Registry: ${addresses.deploymentRegistry}`);
        console.log(`   Garden Account Impl: ${addresses.gardenAccountImpl}`);
        console.log(`   Work Resolver: ${addresses.workResolver}`);
        console.log(`   Work Approval Resolver: ${addresses.workApprovalResolver}`);
        console.log(`   Assessment Resolver: ${addresses.assessmentResolver}`);
        console.log(`   Octant Module: ${addresses.octantModule || "not deployed"}`);
        console.log(`   Octant Factory: ${addresses.octantFactory || "not deployed"}`);
        console.log(`   GreenGoodsENS: ${addresses.greenGoodsENS || "not deployed"}`);

        if (isGreenGoodsENSConfigured(addresses.greenGoodsENS)) {
          try {
            const sponsorStatus = await getENSSponsorStatus({ network });
            console.log(formatENSSponsorStatus(sponsorStatus, "   "));
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.log(`   ENS Sponsor: status unavailable (${message})`);
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(`❌ ${network}: ${errorMsg}`);
      }
    } else {
      // List all networks
      const networks = ["localhost", "arbitrum", "celo", "sepolia"];

      for (const net of networks) {
        try {
          this.deploymentAddresses.loadForChain(net);
          console.log(`✅ ${net} - Contracts deployed`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.log(`❌ ${net} - ${errorMsg}`);
        }
      }
    }
  }

  /**
   * Reconcile Arbitrum GreenGoodsENS registration sends against the current
   * Ethereum receiver and migrate missing records via one Foundry script run.
   */
  async migrateEnsRegistrations(options: ReturnType<CliParser["parseOptions"]>): Promise<void> {
    if (options.network !== "mainnet") {
      throw new Error("ens-migrate must be run with --network mainnet");
    }

    const args = ["script/upgrade-ens-receiver.ts", "migrate", "--network", "mainnet"];
    if (options.broadcast) args.push("--broadcast");
    if (options.pureSimulation) args.push("--pure-simulation");
    if (options.sender) args.push("--sender", options.sender);

    execFileSync("bun", args, {
      cwd: CONTRACTS_ROOT,
      stdio: "inherit",
      env: process.env,
    });
  }

  /**
   * Main execution function
   * @param args - Command line arguments
   */
  async run(args: string[]): Promise<void> {
    // Get command
    const command = this.parser.getCommand(args);

    // Check for help
    if (args.includes("--help") || args.includes("-h") || !command) {
      this.showHelp();
      return;
    }

    // Parse options
    const options = this.parser.parseOptions(args);

    if (options.error) {
      console.error(`❌ ${options.error}`);
      this.showHelp();
      process.exit(1);
    }

    try {
      switch (command) {
        case "core":
          await this.coreDeployer.deployCoreContracts(options);
          break;

        case "goods":
        case "juicebox":
          await this.goodsDeployer.deployGoods(options);
          break;

        case "octant-factory":
          await this.octantFactoryDeployer.deployOctantFactory(options);
          break;

        case "garden": {
          const gardenConfigPath = this.parser.getPositionalArg(args, 1);
          if (!gardenConfigPath) {
            console.error("❌ Garden config file required");
            process.exit(1);
          }
          await this.gardenDeployer.deployGarden(gardenConfigPath, options);
          break;
        }

        case "actions": {
          const actionsConfigPath = this.parser.getPositionalArg(args, 1);
          if (!actionsConfigPath) {
            console.error("❌ Actions config file required");
            process.exit(1);
          }
          await this.actionDeployer.deployActions(actionsConfigPath, options);
          break;
        }

        case "hats-tree": {
          await this.hatsTreeDeployer.setupHatsTree(options);
          break;
        }

        case "badge-locks": {
          await this.badgeLocksDeployer.deployBadgeLocks(options);
          break;
        }

        case "greenwill": {
          await this.greenWillDeployer.deployGreenWill(options);
          break;
        }

        case "badge-schemas": {
          await this.badgeSchemasDeployer.deployBadgeSchemas(options);
          break;
        }

        case "commitment-schemas": {
          await this.commitmentSchemasDeployer.deployCommitmentSchemas(options);
          break;
        }

        case "pooling": {
          await this.releaseDeployer.run("pooling", options);
          break;
        }

        case "pooling-configure": {
          await this.poolingConfigureDeployer.configurePooling(options);
          break;
        }

        case "release-manifest":
        case "protocol-core":
        case "ownership-transfer":
        case "settlement-module":
        case "credit-registry":
        case "settlement-executor":
        case "safe-plan":
        case "settlement-peer":
        case "settlement-peer-verify":
        case "release-recover":
        case "release-verify":
        case "indexer-handoff": {
          await this.releaseDeployer.run(command, options);
          break;
        }

        case "ens-migrate": {
          await this.migrateEnsRegistrations(options);
          break;
        }

        case "status": {
          const networkArg = this.parser.getPositionalArg(args, 1);
          await this.checkDeploymentStatus(networkArg);
          break;
        }

        case "fork": {
          const forkNetwork = this.parser.getPositionalArg(args, 1);
          if (!forkNetwork) {
            console.error("❌ Network required for fork");
            process.exit(1);
          }
          await this.anvilManager.startFork(forkNetwork);
          break;
        }

        default:
          console.error(`❌ Unknown command: ${command}`);
          this.showHelp();
          process.exit(1);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("❌ Error:", errorMsg);
      process.exit(1);
    }
  }
}

// Main execution
const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("cli.ts");
if (isMain) {
  const cli = new DeploymentCLI();
  cli.run(process.argv).catch((error) => {
    console.error("CLI failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
