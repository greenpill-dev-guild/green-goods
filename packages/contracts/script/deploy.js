#!/usr/bin/env node

const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { DeploymentAddresses } = require("./utils/deployment-addresses");
const { GasOptimizer } = require("./utils/gas-optimizer");
const { GardenOnboarding } = require("./garden-onboarding");

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

Options:
  --network, -n <network>  Network to deploy to (default: localhost)
  --broadcast, -b          Broadcast transactions
  --verify, -v             Verify contracts after deployment
  --gas-optimize, -g       Enable gas optimization
  --gas-strategy <strategy> Gas strategy (conservative/standard/aggressive)
  --save-report, -r        Generate deployment report
  --dry-run               Validate configuration without deploying
  --help, -h               Show this help

Examples:
  node deploy.js core --network sepolia --broadcast --verify
  node deploy.js garden config/garden.json --network arbitrum --broadcast
  node deploy.js onboard config/garden-onboarding-example.csv --network sepolia --broadcast
  node deploy.js actions config/actions.json --network base --broadcast
  node deploy.js status sepolia
  node deploy.js fork arbitrum

Local Development:
  When deploying to localhost with --broadcast, anvil will automatically start with a Celo fork.
  This provides access to real tokenbound registry and EAS contracts for testing.
  No need to manually run 'pnpm chain' before deployment commands.

Garden Onboarding CSV Format:
  - Line 1: Instructions (skipped)
  - Line 2-5: Garden info (Name, Description, Location, Banner Image URL/Path)
  - Line 6: Headers (must include "Garden Operators" and "Gardeners")
  - Line 7+: Data rows with operator and gardener email/phone identifiers

Available networks: ${Object.keys(networksConfig.networks).join(", ")}
    `);
  }

  async deployCoreContracts(options) {
    console.log(`Deploying core contracts to ${options.network}`);

    const networkConfig = networksConfig.networks[options.network];
    if (!networkConfig) {
      throw new Error(`Network ${options.network} not found in configuration`);
    }

    // Auto-start anvil with Celo fork for localhost deployments
    if (options.network === "localhost" && options.broadcast) {
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
    let cmd = "forge script script/Deploy.s.sol:Deploy";
    cmd += ` --chain-id ${networkConfig.chainId}`;
    cmd += ` --rpc-url ${rpcUrl}`;

    if (options.broadcast) {
      cmd += " --broadcast";
      if (!process.env.DEPLOYER_PRIVATE_KEY) {
        throw new Error("DEPLOYER_PRIVATE_KEY not set in .env file");
      }
      cmd += ` --private-key ${process.env.DEPLOYER_PRIVATE_KEY}`;
    }

    if (options.verify && networkConfig.verifyApiUrl) {
      cmd += " --verify";
      cmd += ` --verifier-url ${networkConfig.verifyApiUrl}`;

      if (networkConfig.verifyApiKey) {
        let apiKey = networkConfig.verifyApiKey;
        if (apiKey.startsWith("${") && apiKey.endsWith("}")) {
          const envVar = apiKey.slice(2, -1);
          apiKey = process.env[envVar];
          if (apiKey) {
            cmd += ` --etherscan-api-key ${apiKey}`;
          }
        }
      }
    }

    // Gas optimization
    if (options.gasOptimize) {
      const gasOptimizer = new GasOptimizer(options.network, options.gasStrategy || "standard");
      await gasOptimizer.initialize();
      const optimalGasPrice = await gasOptimizer.getOptimalGasPrice();
      cmd += ` --gas-price ${Math.floor(optimalGasPrice * 1e9)}`;
    }

    console.log("\nExecuting deployment command:");
    console.log(cmd.replace(process.env.DEPLOYER_PRIVATE_KEY || "", "[REDACTED]"));

    try {
      execSync(cmd, {
        stdio: "inherit",
        env: process.env,
        cwd: path.join(__dirname, ".."),
      });

      console.log("\n✅ Core contracts deployed successfully!");

      if (options.saveReport) {
        console.log("📊 Generating deployment report...");
        // Report generation would be implemented here
      }
    } catch (error) {
      console.error("\n❌ Core contract deployment failed:", error.message);
      process.exit(1);
    }
  }

  async deployGarden(configPath, options) {
    console.log(`Deploying garden from ${configPath} to ${options.network}`);

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
      const networks = ["localhost", "sepolia", "arbitrum", "base", "optimism", "celo"];

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

    // Auto-start anvil with Celo fork for localhost deployments
    if (options.network === "localhost" && options.broadcast) {
      await this.ensureAnvilRunning("celo");
    }

    let cmd = `forge script ${scriptPath}`;

    if (options.network !== "localhost") {
      let rpcUrl = networkConfig.rpcUrl;
      if (rpcUrl.startsWith("${") && rpcUrl.endsWith("}")) {
        const envVar = rpcUrl.slice(2, -1);
        rpcUrl = process.env[envVar];
        if (!rpcUrl) {
          throw new Error(`Environment variable ${envVar} not set`);
        }
      }
      cmd += ` --rpc-url ${rpcUrl}`;
      cmd += ` --chain-id ${networkConfig.chainId}`;
    } else {
      cmd += " --rpc-url http://localhost:8545";
    }

    if (options.broadcast) {
      cmd += " --broadcast";
      if (!process.env.DEPLOYER_PRIVATE_KEY) {
        throw new Error("DEPLOYER_PRIVATE_KEY not set in .env file");
      }
      cmd += ` --private-key ${process.env.DEPLOYER_PRIVATE_KEY}`;
    }

    if (options.verify && networkConfig.verifyApiUrl) {
      cmd += " --verify";
      cmd += ` --verifier-url ${networkConfig.verifyApiUrl}`;
      if (process.env.ETHERSCAN_API_KEY) {
        cmd += ` --etherscan-api-key ${process.env.ETHERSCAN_API_KEY}`;
      }
    }

    console.log("\nExecuting deployment...");

    execSync(cmd, {
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
      deployer: process.env.DEPLOYER_PRIVATE_KEY ? "configured" : "missing",
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
      deployer: process.env.DEPLOYER_PRIVATE_KEY ? "configured" : "missing",
    };

    const recordPath = path.join(__dirname, "..", "deployments", "actions", `batch-${Date.now()}.json`);

    fs.mkdirSync(path.dirname(recordPath), { recursive: true });
    fs.writeFileSync(recordPath, JSON.stringify(deploymentRecord, null, 2));

    console.log(`Deployment record saved to: ${recordPath}`);
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

  // Parse options
  const options = {
    network: "localhost",
    broadcast: false,
    verify: false,
    gasOptimize: false,
    gasStrategy: "standard",
    saveReport: false,
    dryRun: false,
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--network" || arg === "-n") {
      options.network = args[++i];
    } else if (arg === "--broadcast" || arg === "-b") {
      options.broadcast = true;
    } else if (arg === "--verify" || arg === "-v") {
      options.verify = true;
    } else if (arg === "--gas-optimize" || arg === "-g") {
      options.gasOptimize = true;
    } else if (arg === "--gas-strategy") {
      options.gasStrategy = args[++i];
    } else if (arg === "--save-report" || arg === "-r") {
      options.saveReport = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    }
  }

  try {
    switch (command) {
      case "core":
        await cli.deployCoreContracts(options);
        break;

      case "garden":
        if (args.length < 2) {
          console.error("❌ Garden config file required");
          process.exit(1);
        }
        await cli.deployGarden(args[1], options);
        break;

      case "onboard":
        if (args.length < 2) {
          console.error("❌ Garden CSV file required");
          process.exit(1);
        }
        await cli.onboardGarden(args[1], options);
        break;

      case "actions":
        if (args.length < 2) {
          console.error("❌ Actions config file required");
          process.exit(1);
        }
        await cli.deployActions(args[1], options);
        break;

      case "status":
        await cli.checkDeploymentStatus(args[1]);
        break;

      case "fork":
        if (args.length < 2) {
          console.error("❌ Network required for fork");
          process.exit(1);
        }
        await cli.startFork(args[1]);
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
