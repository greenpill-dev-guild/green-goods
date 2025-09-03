#!/usr/bin/env node

const fs = require("node:fs");
const dotenv = require("dotenv");
const path = require("node:path");
const { execSync, execFileSync } = require("node:child_process");

const { DeploymentAddresses } = require("./utils/deployment-addresses");
const { GasOptimizer } = require("./utils/gas-optimizer");
const { GardenOnboarding } = require("./garden-onboarding");
const { EnvioIntegration } = require("./utils/envio-integration");
// const { TemplateManager } = require("./utils/template-manager");

// Load environment variables
dotenv.config({ path: path.join(__dirname, "..", ".env") });

// Load network configuration
const networksConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", "networks.json")));

// Capital enum mapping for actions
const CAPITAL_MAPPING = {
  SOCIAL: 0,
  MATERIAL: 1,
  FINANCIAL: 2,
  LIVING: 3,
  INTELLECTUAL: 4,
  EXPERIENTIAL: 5,
  SPIRITUAL: 6,
  CULTURAL: 7,
};

class DeploymentCLI {
  constructor() {
    this.deploymentAddresses = new DeploymentAddresses();
    this.profiles = {
      full: {
        description: "Full deployment with all components",
        flags: {},
      },
      update: {
        description: "Update existing deployment (skip contracts)",
        flags: {
          skipExisting: true,
          skipVerification: true,
          forceSchemas: true,
          skipSeedData: true,
        },
      },
      "metadata-only": {
        description: "Update only schema metadata",
        flags: {
          skipExisting: true,
          skipSchemas: true,
          skipConfiguration: true,
          skipSeedData: true,
          skipVerification: true,
          skipGovernance: true,
          metadataOnly: true,
        },
      },
      "contracts-only": {
        description: "Deploy only contracts (skip schemas)",
        flags: {
          skipSchemas: true,
          skipSeedData: true,
          skipConfiguration: true,
        },
      },
      "schemas-only": {
        description: "Deploy only schemas",
        flags: {
          skipExisting: true,
          skipConfiguration: true,
          skipSeedData: true,
          skipVerification: true,
        },
      },
      testing: {
        description: "Full deployment with test data",
        flags: {
          verbose: true,
        },
      },
      production: {
        description: "Production deployment (no test data, governance transfer)",
        flags: {
          skipSeedData: true,
          skipGovernance: false,
          noAllowlist: true,
        },
      },
      hotfix: {
        description: "Emergency hotfix deployment",
        flags: {
          skipExisting: true,
          skipSchemas: true,
          skipSeedData: true,
          skipVerification: true,
          verbose: true,
        },
      },
    };
  }

  showHelp() {
    console.log(`
Green Goods Deployment CLI

Usage: node deploy.js <command> [options]

Commands:
  core                     Deploy core contracts
  garden <config.json>     Deploy a garden from JSON config
  onboard <config.csv>     Onboard gardens from CSV with wallet creation
  actions <config.json>    Deploy actions from JSON config
  status [network]         Check deployment status
  fork <network>           Start a network fork
  
FACTORY COMMANDS:
  factory-setup            Setup factory with Gnosis Safe and guardian
  template-register        Register deployment template with expiration
  template-list            List all registered templates
  deploy-approved          Deploy using approved template
  emergency-approve        Emergency template approval (guardian only)
  emergency-revoke         Emergency deployer revocation (guardian only)

DEPLOYMENT PROFILES (use --profile <name>):
${Object.entries(this.profiles)
  .map(([name, profile]) => `  ${name.padEnd(15)} - ${profile.description}`)
  .join("\n")}

Options:
  --profile, -p <name>              Use deployment profile
  --list-profiles                   List available profiles
  --network, -n <network>           Network to deploy to (default: localhost)
  --broadcast, -b                   Broadcast transactions
  --verify, -v                      Verify contracts after deployment
  --gas-optimize, -g                Enable gas optimization
  --gas-strategy <strategy>         Gas strategy (conservative/standard/aggressive)
  --save-report, -r                 Generate deployment report
  --dry-run                         Validate configuration without deploying
  --help, -h                        Show this help

Deployment Control Options:
  --skip-existing                   Skip deployment if contract already exists
  --force-redeploy                  Force redeployment even if contract exists
  --skip-schemas                    Skip EAS schema deployment entirely
  --force-schemas                   Force redeploy schemas even if they exist
  --skip-verification               Skip contract verification
  --skip-seed-data                  Skip seed data initialization
  --skip-configuration              Skip deployment registry configuration
  --skip-governance                 Skip governance transfer to multisig
  --no-allowlist                    Don't add deployer to registry allowlist
  --verbose                         Enable verbose deployment logging

Envio Integration Options:
  --skip-envio                      Skip automatic Envio configuration update
  --start-indexer                   Start Envio indexer after localhost deployment

QUICK COMMANDS (via package.json):
  pnpm deploy:celo                  # Full production deployment to Celo
  pnpm deploy:sepolia               # Full testing deployment to Sepolia
  pnpm deploy:celo:update           # Update existing Celo deployment
  pnpm deploy:celo:metadata         # Update schema metadata on Celo
  pnpm deploy:dryrun:celo           # Simulate Celo production deployment

Examples:
  # Using profiles
  node deploy.js core --profile production --network celo --broadcast --verify
  node deploy.js core --profile testing --network sepolia --broadcast
  node deploy.js core --profile metadata-only --network celo --broadcast
  
  # Traditional flags (still supported)
  node deploy.js core --network sepolia --broadcast --force-schemas
  node deploy.js core --network arbitrum --broadcast --verify --skip-seed-data
  
  # With Envio integration
  node deploy.js core --network localhost --broadcast --start-indexer
  node deploy.js core --network sepolia --broadcast --skip-envio

Available networks: ${Object.keys(networksConfig.networks).join(", ")}
    `);
  }

  listProfiles() {
    console.log("Available deployment profiles:");
    Object.entries(this.profiles).forEach(([name, profile]) => {
      console.log(`  ${name.padEnd(15)} - ${profile.description}`);
    });
  }

  parseOptions(args) {
    const options = {
      network: "localhost",
      broadcast: false,
      verify: false,
      gasOptimize: false,
      gasStrategy: "standard",
      saveReport: false,
      dryRun: false,
      profile: null,
      // Envio integration flags
      skipEnvio: false,
      startIndexer: false,
      // Deployment flags
      skipExisting: false,
      forceRedeploy: false,
      skipSchemas: false,
      forceSchemas: false,
      skipVerification: false,
      skipSeedData: false,
      skipConfiguration: false,
      skipGovernance: false,
      noAllowlist: false,
      verbose: false,
      metadataOnly: false,
    };

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];

      // Skip command and config file arguments
      if (i === 1 && !arg.startsWith("-")) continue;
      if (i === 2 && !args[1].startsWith("-") && !arg.startsWith("-")) continue;

      switch (arg) {
        case "--network":
        case "-n":
          options.network = args[++i];
          break;
        case "--broadcast":
        case "-b":
          options.broadcast = true;
          break;
        case "--verify":
        case "-v":
          options.verify = true;
          break;
        case "--gas-optimize":
        case "-g":
          options.gasOptimize = true;
          break;
        case "--gas-strategy":
          options.gasStrategy = args[++i];
          break;
        case "--save-report":
        case "-r":
          options.saveReport = true;
          break;
        case "--dry-run":
          options.dryRun = true;
          break;
        case "--profile":
        case "-p":
          options.profile = args[++i];
          break;
        case "--list-profiles":
          this.listProfiles();
          process.exit(0);
          break;

        // Deployment control flags
        case "--skip-existing":
          options.skipExisting = true;
          break;
        case "--force-redeploy":
          options.forceRedeploy = true;
          break;
        case "--skip-schemas":
          options.skipSchemas = true;
          break;
        case "--force-schemas":
          options.forceSchemas = true;
          break;
        case "--skip-verification":
          options.skipVerification = true;
          break;
        case "--skip-seed-data":
          options.skipSeedData = true;
          break;
        case "--skip-configuration":
          options.skipConfiguration = true;
          break;
        case "--skip-governance":
          options.skipGovernance = true;
          break;
        case "--no-allowlist":
          options.noAllowlist = true;
          break;
        case "--verbose":
          options.verbose = true;
          break;

        // Envio integration flags
        case "--skip-envio":
          options.skipEnvio = true;
          break;
        case "--start-indexer":
          options.startIndexer = true;
          break;

        case "--help":
        case "-h":
          this.showHelp();
          process.exit(0);
          break;

        default:
          if (arg.startsWith("-")) {
            console.error(`❌ Unknown option: ${arg}`);
            this.showHelp();
            process.exit(1);
          }
      }
    }

    // Apply environment variable overrides (env vars take precedence over CLI flags)
    if (process.env.SKIP_EXISTING_CONTRACTS !== undefined) {
      options.skipExisting = process.env.SKIP_EXISTING_CONTRACTS === "true";
    }
    if (process.env.FORCE_REDEPLOY !== undefined) {
      options.forceRedeploy = process.env.FORCE_REDEPLOY === "true";
    }
    if (process.env.SKIP_SCHEMAS !== undefined) {
      options.skipSchemas = process.env.SKIP_SCHEMAS === "true";
    }
    if (process.env.FORCE_SCHEMA_DEPLOYMENT !== undefined) {
      options.forceSchemas = process.env.FORCE_SCHEMA_DEPLOYMENT === "true";
    }
    if (process.env.SKIP_VERIFICATION !== undefined) {
      options.skipVerification = process.env.SKIP_VERIFICATION === "true";
    }
    if (process.env.SKIP_SEED_DATA !== undefined) {
      options.skipSeedData = process.env.SKIP_SEED_DATA === "true";
    }
    if (process.env.SKIP_CONFIGURATION !== undefined) {
      options.skipConfiguration = process.env.SKIP_CONFIGURATION === "true";
    }
    if (process.env.SKIP_GOVERNANCE_TRANSFER !== undefined) {
      options.skipGovernance = process.env.SKIP_GOVERNANCE_TRANSFER === "true";
    }
    if (process.env.ADD_DEPLOYER_TO_ALLOWLIST !== undefined) {
      options.noAllowlist = process.env.ADD_DEPLOYER_TO_ALLOWLIST === "false";
    }
    if (process.env.VERBOSE_LOGGING !== undefined) {
      options.verbose = process.env.VERBOSE_LOGGING === "true";
    }
    if (process.env.METADATA_ONLY !== undefined) {
      options.metadataOnly = process.env.METADATA_ONLY === "true";
    }

    // Apply profile flags
    if (options.profile) {
      this.applyProfile(options, options.profile);
    }

    return options;
  }

  applyProfile(options, profileName) {
    const profile = this.profiles[profileName];
    if (!profile) {
      console.error(`❌ Unknown profile: ${profileName}`);
      console.log("Available profiles:");
      this.listProfiles();
      process.exit(1);
    }

    console.log(`📋 Applying profile: ${profileName} - ${profile.description}`);
    Object.assign(options, profile.flags);
  }

  setEnvironmentFlags(options) {
    // Set environment variables for the Solidity script
    process.env.SKIP_EXISTING_CONTRACTS = options.skipExisting.toString();
    process.env.FORCE_REDEPLOY = options.forceRedeploy.toString();
    process.env.SKIP_SCHEMAS = options.skipSchemas.toString();
    process.env.FORCE_SCHEMA_DEPLOYMENT = options.forceSchemas.toString();
    process.env.SKIP_VERIFICATION = options.skipVerification.toString();
    process.env.SKIP_SEED_DATA = options.skipSeedData.toString();
    process.env.SKIP_CONFIGURATION = options.skipConfiguration.toString();
    process.env.SKIP_GOVERNANCE_TRANSFER = options.skipGovernance.toString();
    process.env.ADD_DEPLOYER_TO_ALLOWLIST = (!options.noAllowlist).toString();
    process.env.VERBOSE_LOGGING = options.verbose.toString();
    process.env.METADATA_ONLY = options.metadataOnly.toString();

    // Set deployment profile if specified
    if (options.profile) {
      process.env.DEPLOYMENT_PROFILE = options.profile;
    }
  }

  async deployCoreContracts(options) {
    console.log(`Deploying core contracts to ${options.network}`);

    // Set environment variables for the Solidity script
    this.setEnvironmentFlags(options);

    // Display active deployment flags
    this.logActiveFlags(options);

    const networkConfig = networksConfig.networks[options.network];
    if (!networkConfig) {
      throw new Error(`Network ${options.network} not found in configuration`);
    }

    // Auto-start anvil with Celo fork for localhost deployments
    if (options.network === "localhost") {
      await this.ensureAnvilRunning("celo");
    }

    // Get RPC URL
    let rpcUrl = networkConfig.rpcUrl;
    if (rpcUrl.startsWith("${") && rpcUrl.endsWith("}")) {
      const envVar = rpcUrl.slice(2, -1);
      rpcUrl = process.env[envVar];
      if (!rpcUrl) {
        throw new Error(`Environment variable ${envVar} not set`);
      }
    }

    // Build forge script command
    const args = ["script", "script/Deploy.s.sol:Deploy"];
    args.push("--chain-id", networkConfig.chainId.toString());
    args.push("--rpc-url", rpcUrl);

    if (options.broadcast) {
      args.push("--broadcast");
      const privateKey = process.env.PRIVATE_KEY;
      if (!privateKey) {
        throw new Error("PRIVATE_KEY not set in .env file");
      }
      args.push("--private-key", privateKey);
    }

    // Skip verification if contracts are already deployed or if explicitly skipped
    let shouldVerify = options.verify && networkConfig.verifyApiUrl && !options.skipVerification;
    if (shouldVerify) {
      try {
        const chainMap = {
          localhost: "31337",
          sepolia: "11155111",
          arbitrum: "42161",
          base: "8453",
          baseSepolia: "84532",
          optimism: "10",
          celo: "42220",
        };
        const chainId = chainMap[options.network] || options.network;
        const deploymentFile = path.join(__dirname, "../deployments", `${chainId}-latest.json`);

        if (fs.existsSync(deploymentFile) && !options.forceRedeploy) {
          console.log("⏭️  Skipping verification - contracts already deployed and likely verified");
          shouldVerify = false;
        }
      } catch (error) {
        console.error("❌ Failed to check deployment status:", error.message);
        // If check fails, proceed with verification
      }
    }

    if (shouldVerify) {
      args.push("--verify");
      args.push("--verifier-url", networkConfig.verifyApiUrl);

      if (networkConfig.verifyApiKey) {
        let apiKey = networkConfig.verifyApiKey;
        if (apiKey.startsWith("${") && apiKey.endsWith("}")) {
          const envVar = apiKey.slice(2, -1);
          apiKey = process.env[envVar];
          if (apiKey) {
            args.push("--etherscan-api-key", apiKey);
          }
        }
      }
    }

    // Gas optimization
    if (options.gasOptimize) {
      const gasOptimizer = new GasOptimizer(options.network, options.gasStrategy || "standard");
      await gasOptimizer.initialize();
      const optimalGasPrice = await gasOptimizer.getOptimalGasPrice();
      args.push("--gas-price", Math.floor(optimalGasPrice * 1e9).toString());
    }

    console.log("\nExecuting deployment command:");
    const displayArgs = args.map((arg, idx) => (idx > 0 && args[idx - 1] === "--private-key" ? "[REDACTED]" : arg));
    console.log("forge", displayArgs.join(" "));

    try {
      execSync(`forge ${args.join(" ")}`, {
        stdio: "inherit",
        env: process.env,
        cwd: path.join(__dirname, ".."),
      });

      console.log("\n✅ Core contracts deployed successfully!");

      // Auto-update Envio configuration after successful deployment
      if (!options.skipEnvio) {
        try {
          console.log("\n🔄 Auto-updating Envio configuration...");

          // Get chain ID for Envio integration
          const chainMap = {
            localhost: "31337",
            sepolia: "11155111",
            arbitrum: "42161",
            base: "8453",
            baseSepolia: "84532",
            optimism: "10",
            celo: "42220",
          };
          const chainId = chainMap[options.network] || options.network;

          const envioIntegration = new EnvioIntegration();
          await envioIntegration.updateEnvioConfig(chainId, options.network === "localhost");

          // Setup cleanup for local deployments
          if (options.network === "localhost") {
            console.log("🔄 Setting up cleanup for local chain config...");

            const cleanup = async () => {
              console.log("\n🧹 Cleaning up local chain config...");
              try {
                await envioIntegration.disableLocalChainConfig();
                console.log("✅ Local chain config disabled successfully");
              } catch (error) {
                console.warn("⚠️  Failed to disable local chain config:", error.message);
              }
            };

            // Register cleanup handlers
            process.on("exit", cleanup);
            process.on("SIGINT", cleanup);
            process.on("SIGTERM", cleanup);
            process.on("uncaughtException", cleanup);
          }

          // Optionally start indexer for localhost deployments
          if (options.network === "localhost" && options.startIndexer) {
            await envioIntegration.startIndexer();
          }
        } catch (envioError) {
          console.warn("⚠️  Failed to update Envio config:", envioError.message);
          console.warn("   You can manually update it later using:");
          console.warn(
            `   node script/utils/envio-integration.js update ${chainMap[options.network] || options.network}`,
          );
        }
      } else {
        console.log("⏭️  Skipping Envio update (--skip-envio flag set)");
      }

      if (options.saveReport) {
        console.log("📊 Generating deployment report...");
        // Report generation would be implemented here
      }
    } catch (error) {
      console.error("\n❌ Core contract deployment failed:", error.message);
      process.exit(1);
    }
  }

  logActiveFlags(options) {
    const activeFlags = [];

    if (options.skipExisting) activeFlags.push("Skip Existing Contracts");
    if (options.forceRedeploy) activeFlags.push("Force Redeploy");
    if (options.skipSchemas) activeFlags.push("Skip Schemas");
    if (options.forceSchemas) activeFlags.push("Force Schema Deployment");
    if (options.skipVerification) activeFlags.push("Skip Verification");
    if (options.skipSeedData) activeFlags.push("Skip Seed Data");
    if (options.skipConfiguration) activeFlags.push("Skip Configuration");
    if (options.skipGovernance) activeFlags.push("Skip Governance Transfer");
    if (options.noAllowlist) activeFlags.push("No Deployer Allowlist");
    if (options.verbose) activeFlags.push("Verbose Logging");
    if (options.metadataOnly) activeFlags.push("Metadata Only");

    if (activeFlags.length > 0) {
      console.log("\n🏁 Active Deployment Flags:");
      activeFlags.forEach((flag) => {
        console.log(`   ✓ ${flag}`);
      });
    }

    // Show governance configuration
    console.log("\n🏛️  Governance Configuration:");
    console.log("   Multisig: 0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19 (Green Goods Safe)");

    const allowlistAddresses = [];
    if (process.env.DEPLOYMENT_REGISTRY_ALLOWLIST) {
      allowlistAddresses.push(process.env.DEPLOYMENT_REGISTRY_ALLOWLIST);
    }
    for (let i = 0; i < 10; i++) {
      const addr = process.env[`ALLOWLIST_ADDRESS_${i}`];
      if (addr) allowlistAddresses.push(addr);
    }

    if (allowlistAddresses.length > 0) {
      console.log("   Allowlist:", allowlistAddresses.join(", "));
    }

    console.log("");
  }

  async deployGarden(configPath, options) {
    console.log(`Deploying garden from ${configPath} to ${options.network}`);

    // Set environment variables for deployment flags
    this.setEnvironmentFlags(options);

    // Load and validate garden config
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    this.validateGardenConfig(config);

    if (options.dryRun) {
      console.log("\n🔍 DRY RUN - Garden configuration validated:");
      console.log(JSON.stringify(config, null, 2));
      console.log("\n✅ Garden configuration is valid!");
      return;
    }

    // Load deployed contract addresses
    let contractAddresses;
    let communityToken;
    try {
      contractAddresses = this.deploymentAddresses.loadForChain(options.network);
      communityToken = this.deploymentAddresses.getCommunityToken(options.network);
    } catch (error) {
      console.error(`❌ Failed to load contract addresses: ${error.message}`);
      console.error(`Please deploy core contracts first: node deploy.js core --network ${options.network} --broadcast`);
      process.exit(1);
    }

    // Set environment variables for the Solidity script
    const env = {
      ...process.env,
      GARDEN_NAME: config.name,
      GARDEN_DESCRIPTION: config.description,
      GARDEN_LOCATION: config.location,
      GARDEN_BANNER: config.bannerImage,
      GARDENERS: JSON.stringify(config.gardeners),
      OPERATORS: JSON.stringify(config.operators),
      GARDEN_TOKEN: contractAddresses.gardenToken,
      COMMUNITY_TOKEN: communityToken,
    };

    await this.executeForgeScript("script/DeployGarden.s.sol:DeployGarden", options, env);

    // Save deployment record
    this.saveGardenDeploymentRecord(config, options);
    console.log("\n✅ Garden deployed successfully!");
  }

  async onboardGarden(csvPath, options) {
    console.log(`Onboarding garden from ${csvPath} to ${options.network}`);

    const onboarding = new GardenOnboarding({
      network: options.network,
      dryRun: options.dryRun,
    });

    await onboarding.processCSV(csvPath);
  }

  async deployActions(configPath, options) {
    console.log(`Deploying actions from ${configPath} to ${options.network}`);

    // Set environment variables for deployment flags
    this.setEnvironmentFlags(options);

    // Load and validate actions config
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    this.validateActionsConfig(config);

    if (options.dryRun) {
      console.log("\n🔍 DRY RUN - Actions configuration validated:");
      console.log(JSON.stringify(config, null, 2));
      console.log("\n✅ Actions configuration is valid!");
      return;
    }

    // Load deployed contract addresses
    let contractAddresses;
    try {
      contractAddresses = this.deploymentAddresses.loadForChain(options.network);
    } catch (error) {
      console.error(`❌ Failed to load contract addresses: ${error.message}`);
      console.error(`Please deploy core contracts first: node deploy.js core --network ${options.network} --broadcast`);
      process.exit(1);
    }

    // Generate and execute actions deployment script
    const solidity = this.generateActionScript(config.actions, contractAddresses.actionRegistry);
    const scriptPath = path.join(__dirname, "temp", "DeployActionsGenerated.s.sol");

    fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
    fs.writeFileSync(scriptPath, solidity);

    try {
      await this.executeForgeScript(`${scriptPath}:DeployActionsGenerated`, options);

      // Save deployment record
      this.saveActionsDeploymentRecord(config, options);
      console.log("\n✅ Actions deployed successfully!");
    } finally {
      // Clean up temp file
      try {
        fs.unlinkSync(scriptPath);
      } catch (e) {
        // Ignore cleanup errors
        console.log("❌ Failed to cleanup temp file:", e.message);
      }
    }
  }

  async checkDeploymentStatus(network) {
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
        console.log(`   Work Resolver: ${addresses.workResolver}`);
        console.log(`   Work Approval Resolver: ${addresses.workApprovalResolver}`);
      } catch (error) {
        console.log(`❌ ${network}: ${error.message}`);
      }
    } else {
      // List all networks
      const networks = ["localhost", "sepolia", "arbitrum", "base", "baseSepolia", "optimism", "celo"];

      networks.forEach((net) => {
        try {
          this.deploymentAddresses.loadForChain(net);
          console.log(`✅ ${net} - Contracts deployed`);
        } catch (error) {
          console.log(`❌ ${net} - ${error.message}`);
        }
      });
    }
  }

  async startFork(network, background = false) {
    const networkConfig = networksConfig.networks[network];
    if (!networkConfig) {
      throw new Error(`Network ${network} not found in configuration`);
    }

    console.log(`Starting fork for ${networkConfig.name} (chainId: ${networkConfig.chainId})`);

    // Get RPC URL
    let rpcUrl = networkConfig.rpcUrl;
    if (rpcUrl.startsWith("${") && rpcUrl.endsWith("}")) {
      const envVar = rpcUrl.slice(2, -1);
      rpcUrl = process.env[envVar];
      if (!rpcUrl) {
        throw new Error(`Environment variable ${envVar} not set`);
      }
    }

    // Build anvil command
    const anvilArgs = [
      "--fork-url",
      rpcUrl,
      "--chain-id",
      networkConfig.chainId.toString(),
      "--accounts",
      "10",
      "--balance",
      "10000",
      "--block-time",
      "1",
      "--port",
      "8545",
    ];

    if (background) {
      anvilArgs.push("--silent");
    }

    if (!background) {
      console.log("\nStarting Anvil with command:");
      console.log("anvil", anvilArgs.join(" "));
      console.log("\nPress Ctrl+C to stop the fork\n");
    }

    // Start anvil
    const { spawn } = require("node:child_process");
    const anvil = spawn("anvil", anvilArgs, {
      stdio: background ? "pipe" : "inherit",
      detached: background,
    });

    anvil.on("error", (error) => {
      console.error("Failed to start anvil:", error);
      console.log("\nMake sure anvil is installed: foundryup");
      if (background) {
        throw new Error("Failed to start anvil fork");
      }
      process.exit(1);
    });

    if (background) {
      // Wait for anvil to be ready
      console.log("⏳ Waiting for anvil fork to be ready...");
      for (let i = 0; i < 30; i++) {
        if (await this.isAnvilRunning()) {
          console.log("✅ Anvil fork is ready!");
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      throw new Error("Anvil fork failed to start within 30 seconds");
    }

    process.on("SIGINT", () => {
      console.log("\nStopping fork...");
      anvil.kill();
      process.exit(0);
    });
  }

  async ensureAnvilRunning(forkNetwork = null) {
    // Check if anvil is already running
    if (await this.isAnvilRunning()) {
      console.log("✅ Anvil is already running on localhost:8545");
      return;
    }

    if (forkNetwork) {
      console.log(`🔄 Starting anvil with ${forkNetwork} fork for localhost deployment...`);
      await this.startFork(forkNetwork, true);
      return;
    }

    console.log("🔄 Starting anvil for localhost deployment...");

    // Start anvil in background
    const { spawn } = require("node:child_process");
    const anvil = spawn(
      "anvil",
      ["--accounts", "10", "--balance", "10000", "--block-time", "1", "--port", "8545", "--silent"],
      {
        stdio: "pipe",
        detached: true,
      },
    );

    anvil.on("error", (error) => {
      console.error("Failed to start anvil:", error);
      console.log("\nMake sure anvil is installed: foundryup");
      throw new Error("Failed to start anvil");
    });

    // Wait for anvil to be ready
    console.log("⏳ Waiting for anvil to be ready...");
    for (let i = 0; i < 30; i++) {
      if (await this.isAnvilRunning()) {
        console.log("✅ Anvil is ready!");
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error("Anvil failed to start within 30 seconds");
  }

  async isAnvilRunning() {
    try {
      const http = require("node:http");

      return new Promise((resolve) => {
        const req = http.request(
          {
            hostname: "localhost",
            port: 8545,
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            timeout: 2000,
          },
          (res) => {
            resolve(res.statusCode === 200);
          },
        );

        req.on("error", () => {
          resolve(false);
        });

        req.on("timeout", () => {
          resolve(false);
        });

        // Send a simple JSON-RPC request
        req.write(
          JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_blockNumber",
            params: [],
            id: 1,
          }),
        );
        req.end();
      });
    } catch (error) {
      console.error("Error checking anvil status:", error.message);
      return false;
    }
  }

  async executeForgeScript(scriptPath, options, env = {}) {
    const networkConfig = networksConfig.networks[options.network];

    // Set environment variables for deployment flags
    this.setEnvironmentFlags(options);

    // Auto-start anvil with Celo fork for localhost deployments
    if (options.network === "localhost") {
      await this.ensureAnvilRunning("celo");
    }

    const args = ["script", scriptPath];

    if (options.network !== "localhost") {
      let rpcUrl = networkConfig.rpcUrl;
      if (rpcUrl.startsWith("${") && rpcUrl.endsWith("}")) {
        const envVar = rpcUrl.slice(2, -1);
        rpcUrl = process.env[envVar];
        if (!rpcUrl) {
          throw new Error(`Environment variable ${envVar} not set`);
        }
      }
      args.push("--rpc-url", rpcUrl);
      args.push("--chain-id", networkConfig.chainId.toString());
    } else {
      args.push("--rpc-url", "http://localhost:8545");
    }

    if (options.broadcast) {
      args.push("--broadcast");
      const privateKey = process.env.PRIVATE_KEY;
      if (!privateKey) {
        throw new Error("PRIVATE_KEY not set in .env file");
      }
      args.push("--private-key", privateKey);
    }

    if (options.verify && networkConfig.verifyApiUrl && !options.skipVerification) {
      args.push("--verify");
      args.push("--verifier-url", networkConfig.verifyApiUrl);
      if (process.env.ETHERSCAN_API_KEY) {
        args.push("--etherscan-api-key", process.env.ETHERSCAN_API_KEY);
      }
    }

    console.log("\nExecuting deployment...");
    const displayArgs = args.map((arg, idx) => (idx > 0 && args[idx - 1] === "--private-key" ? "[REDACTED]" : arg));
    console.log("forge", displayArgs.join(" "));

    execFileSync("forge", args, {
      stdio: "inherit",
      env: { ...process.env, ...env },
      cwd: path.join(__dirname, ".."),
    });
  }

  validateGardenConfig(config) {
    const required = ["name", "description", "location", "bannerImage", "gardeners", "operators"];
    const missing = required.filter((field) => !config[field]);

    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(", ")}`);
    }

    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    const invalidGardeners = config.gardeners.filter((addr) => !addressRegex.test(addr));
    const invalidOperators = config.operators.filter((addr) => !addressRegex.test(addr));

    if (invalidGardeners.length > 0) {
      throw new Error(`Invalid gardener addresses: ${invalidGardeners.join(", ")}`);
    }

    if (invalidOperators.length > 0) {
      throw new Error(`Invalid operator addresses: ${invalidOperators.join(", ")}`);
    }
  }

  validateActionsConfig(config) {
    if (!config.actions || !Array.isArray(config.actions)) {
      throw new Error('Config must have an "actions" array');
    }

    if (config.actions.length === 0) {
      throw new Error("At least one action must be provided");
    }

    config.actions.forEach((action, index) => {
      const required = ["title", "instructions", "startTime", "endTime", "capitals", "media"];
      const missing = required.filter((field) => !action[field]);

      if (missing.length > 0) {
        throw new Error(`Action ${index}: Missing required fields: ${missing.join(", ")}`);
      }

      // Validate capitals
      const invalidCapitals = action.capitals.filter((capital) => !Object.hasOwn(CAPITAL_MAPPING, capital));
      if (invalidCapitals.length > 0) {
        throw new Error(`Action ${index}: Invalid capitals: ${invalidCapitals.join(", ")}`);
      }

      // Validate dates
      const startTime = new Date(action.startTime);
      const endTime = new Date(action.endTime);

      if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
        throw new Error(`Action ${index}: Invalid date format. Use ISO 8601 format`);
      }

      if (startTime >= endTime) {
        throw new Error(`Action ${index}: Start time must be before end time`);
      }

      if (!Array.isArray(action.media) || action.media.length === 0) {
        throw new Error(`Action ${index}: Media must be a non-empty array`);
      }
    });
  }

  generateActionScript(actions, actionRegistryAddress) {
    const actionsCode = actions
      .map((action, index) => {
        const startTime = Math.floor(new Date(action.startTime).getTime() / 1000);
        const endTime = Math.floor(new Date(action.endTime).getTime() / 1000);

        return `
        // Action ${index + 1}: ${action.title}
        {
            Capital[] memory capitals${index} = new Capital[](${action.capitals.length});
            ${action.capitals.map((capital, i) => `capitals${index}[${i}] = Capital.${capital};`).join("\n            ")}
            
            string[] memory media${index} = new string[](${action.media.length});
            ${action.media.map((m, i) => `media${index}[${i}] = "${m}";`).join("\n            ")}
            
            registry.registerAction(
                ${startTime},
                ${endTime},
                "${action.title}",
                "${action.instructions}",
                capitals${index},
                media${index}
            );
            
            console.log("Registered action: ${action.title}");
        }`;
      })
      .join("\n");

    return `// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.25;

import { Script, console } from "forge-std/Script.sol";
import { ActionRegistry, Capital } from "../../src/registries/Action.sol";

contract DeployActionsGenerated is Script {
    function run() external {
        vm.startBroadcast();
        
        ActionRegistry registry = ActionRegistry(${actionRegistryAddress});
        ${actionsCode}
        
        vm.stopBroadcast();
        console.log("All actions deployed successfully!");
    }
}`;
  }

  saveGardenDeploymentRecord(config, options) {
    const deploymentRecord = {
      ...config,
      timestamp: new Date().toISOString(),
      network: options.network,
      deployer: process.env.PRIVATE_KEY ? "configured" : "missing",
    };

    const recordPath = path.join(
      __dirname,
      "..",
      "deployments",
      "gardens",
      `${config.name.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.json`,
    );

    fs.mkdirSync(path.dirname(recordPath), { recursive: true });
    fs.writeFileSync(recordPath, JSON.stringify(deploymentRecord, null, 2));

    console.log(`Deployment record saved to: ${recordPath}`);
  }

  saveActionsDeploymentRecord(config, options) {
    const deploymentRecord = {
      actions: config.actions,
      timestamp: new Date().toISOString(),
      network: options.network,
      deployer: process.env.PRIVATE_KEY ? "configured" : "missing",
    };

    const recordPath = path.join(__dirname, "..", "deployments", "actions", `batch-${Date.now()}.json`);

    fs.mkdirSync(path.dirname(recordPath), { recursive: true });
    fs.writeFileSync(recordPath, JSON.stringify(deploymentRecord, null, 2));

    console.log(`Deployment record saved to: ${recordPath}`);
  }

  // ===== UTILITY METHODS =====

  /**
   * Get provider and signer for a network
   */
  getProviderAndSigner(network) {
    const networkConfig = networksConfig.networks[network];
    if (!networkConfig) {
      throw new Error(`Network ${network} not found in configuration`);
    }

    // Get RPC URL
    let rpcUrl = networkConfig.rpcUrl;
    if (rpcUrl.startsWith("${") && rpcUrl.endsWith("}")) {
      const envVar = rpcUrl.slice(2, -1);
      rpcUrl = process.env[envVar];
      if (!rpcUrl) {
        throw new Error(`Environment variable ${envVar} not set`);
      }
    }

    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("PRIVATE_KEY environment variable not set");
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const signer = new ethers.Wallet(privateKey, provider);

    return { provider, signer };
  }

  // ===== FACTORY METHODS =====

  /**
   * Setup factory with Gnosis Safe and emergency guardian
   */
  async setupFactory(options) {
    const dryRunFlag = options.dryRun ? "--dry-run" : "";
    const cmd = `node script/factory-operations.js setup --network ${options.network} ${dryRunFlag}`;

    try {
      execSync(cmd, { stdio: "inherit" });
    } catch (error) {
      throw new Error(`Factory setup failed: ${error.message}`);
    }
  }

  /**
   * Register a deployment template
   */
  async registerTemplate(contractPath, options) {
    const expirationDays = options.expires || 30;
    const templateName = options.name || path.basename(contractPath, ".sol");
    const dryRunFlag = options.dryRun ? "--dry-run" : "";

    const cmd = `node script/factory-operations.js register-template --network ${options.network} --contract ${contractPath} --name ${templateName} --expires ${expirationDays} ${dryRunFlag}`;

    try {
      execSync(cmd, { stdio: "inherit" });
    } catch (error) {
      throw new Error(`Template registration failed: ${error.message}`);
    }
  }

  /**
   * List all registered templates
   */
  async listTemplates(options) {
    const cmd = `node script/factory-operations.js list-templates --network ${options.network}`;

    try {
      execSync(cmd, { stdio: "inherit" });
    } catch (error) {
      throw new Error(`Template listing failed: ${error.message}`);
    }
  }

  /**
   * Deploy contract using approved template
   */
  async deployFromTemplate(templateHash, options) {
    const salt = options.salt || `${templateHash}-${Date.now()}`;
    const dryRunFlag = options.dryRun ? "--dry-run" : "";

    const cmd = `node script/factory-operations.js deploy-approved --network ${options.network} --template ${templateHash} --salt ${salt} ${dryRunFlag}`;

    try {
      execSync(cmd, { stdio: "inherit" });
    } catch (error) {
      throw new Error(`Template deployment failed: ${error.message}`);
    }
  }

  /**
   * Emergency template approval (guardian only)
   */
  async emergencyApproveTemplate(templateHash, options) {
    const cmd = `node script/factory-operations.js emergency-approve --network ${options.network} --template ${templateHash}`;

    try {
      execSync(cmd, { stdio: "inherit" });
    } catch (error) {
      throw new Error(`Emergency approval failed: ${error.message}`);
    }
  }

  /**
   * Emergency deployer revocation (guardian only)
   */
  async emergencyRevokeDeployer(deployerAddress, options) {
    const cmd = `node script/factory-operations.js emergency-revoke --network ${options.network} --deployer ${deployerAddress}`;

    try {
      execSync(cmd, { stdio: "inherit" });
    } catch (error) {
      throw new Error(`Emergency revocation failed: ${error.message}`);
    }
  }
}

// Main CLI logic
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    new DeploymentCLI().showHelp();
    process.exit(0);
  }

  const command = args[0];
  const cli = new DeploymentCLI();

  // Parse all options including deployment flags
  const options = cli.parseOptions(args);

  try {
    switch (command) {
      case "core":
        await cli.deployCoreContracts(options);
        break;

      case "garden":
        if (args.length < 2 || args[1].startsWith("-")) {
          console.error("❌ Garden config file required");
          process.exit(1);
        }
        await cli.deployGarden(args[1], options);
        break;

      case "onboard":
        if (args.length < 2 || args[1].startsWith("-")) {
          console.error("❌ Garden CSV file required");
          process.exit(1);
        }
        await cli.onboardGarden(args[1], options);
        break;

      case "actions":
        if (args.length < 2 || args[1].startsWith("-")) {
          console.error("❌ Actions config file required");
          process.exit(1);
        }
        await cli.deployActions(args[1], options);
        break;

      case "status": {
        const networkArg = args.find((arg) => !arg.startsWith("-") && arg !== "status");
        await cli.checkDeploymentStatus(networkArg);
        break;
      }

      case "fork": {
        const forkNetworkArg = args.find((arg) => !arg.startsWith("-") && arg !== "fork");
        if (!forkNetworkArg) {
          console.error("❌ Network required for fork");
          process.exit(1);
        }
        await cli.startFork(forkNetworkArg);
        break;
      }

      // Factory commands
      case "factory-setup":
        await cli.setupFactory(options);
        break;

      case "template-register":
        if (args.length < 2 || args[1].startsWith("-")) {
          console.error("❌ Contract path required");
          process.exit(1);
        }
        await cli.registerTemplate(args[1], options);
        break;

      case "template-list":
        await cli.listTemplates(options);
        break;

      case "deploy-approved":
        if (args.length < 2 || args[1].startsWith("-")) {
          console.error("❌ Template hash required");
          process.exit(1);
        }
        await cli.deployFromTemplate(args[1], options);
        break;

      case "emergency-approve":
        if (args.length < 2 || args[1].startsWith("-")) {
          console.error("❌ Template hash required");
          process.exit(1);
        }
        await cli.emergencyApproveTemplate(args[1], options);
        break;

      case "emergency-revoke":
        if (args.length < 2 || args[1].startsWith("-")) {
          console.error("❌ Deployer address required");
          process.exit(1);
        }
        await cli.emergencyRevokeDeployer(args[1], options);
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        cli.showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { DeploymentCLI };
