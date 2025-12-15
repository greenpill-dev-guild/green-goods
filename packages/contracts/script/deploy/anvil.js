const { spawn } = require("node:child_process");
const { NetworkManager } = require("../utils/network");

/**
 * AnvilManager - Manages Anvil local blockchain lifecycle
 *
 * Extracted from deploy.js to handle Anvil process management
 */
class AnvilManager {
  constructor() {
    this.networkManager = new NetworkManager();
  }

  /**
   * Check if Anvil is running
   * @returns {Promise<boolean>} True if Anvil is running
   */
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

  /**
   * Ensure Anvil is running, starting it if necessary
   * @param {string|null} forkNetwork - Network to fork (optional)
   */
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

  /**
   * Start Anvil fork for a network
   * @param {string} network - Network to fork
   * @param {boolean} background - Run in background
   */
  async startFork(network, background = false) {
    const networkConfig = this.networkManager.getNetwork(network);
    console.log(`Starting fork for ${network} (chainId: ${networkConfig.chainId})`);

    // Get RPC URL with env var substitution
    const rpcUrl = this.networkManager.getRpcUrl(network);

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
}

module.exports = { AnvilManager };
