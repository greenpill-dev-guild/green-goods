import { type ChildProcess, spawn } from "node:child_process";
import * as http from "node:http";
import { NetworkManager } from "../utils/network";

/**
 * AnvilManager - Manages Anvil local blockchain lifecycle
 *
 * Extracted from deploy.js to handle Anvil process management.
 * Tracks spawned child processes and registers cleanup handlers
 * to prevent orphaned Anvil instances.
 */
export class AnvilManager {
  private networkManager: NetworkManager;
  /** PIDs of background Anvil processes spawned by this manager */
  private spawnedPids: number[] = [];

  constructor(networkManager?: NetworkManager) {
    this.networkManager = networkManager ?? new NetworkManager();
    this._registerCleanup();
  }

  /**
   * Register process-level cleanup to kill any Anvil processes we started.
   * Uses 'exit' (sync) since SIGINT/SIGTERM may not fire in all environments.
   */
  private _registerCleanup(): void {
    const cleanup = (): void => {
      for (const pid of this.spawnedPids) {
        try {
          process.kill(pid);
        } catch {
          // Process already exited — ignore
        }
      }
      this.spawnedPids = [];
    };

    process.on("exit", cleanup);
  }

  /** Track a spawned Anvil process for cleanup */
  private _trackProcess(child: ChildProcess): void {
    if (child.pid) {
      this.spawnedPids.push(child.pid);
      child.on("exit", () => {
        this.spawnedPids = this.spawnedPids.filter((p) => p !== child.pid);
      });
    }
  }

  /**
   * Check if Anvil is running
   * @returns True if Anvil is running
   */
  async isAnvilRunning(): Promise<boolean> {
    try {
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
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("Error checking anvil status:", errorMsg);
      return false;
    }
  }

  /**
   * Ensure Anvil is running, starting it if necessary
   * @param forkNetwork - Network to fork (optional)
   */
  async ensureAnvilRunning(forkNetwork: string | null = null): Promise<void> {
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
    this._trackProcess(anvil);

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
   * @param network - Network to fork
   * @param background - Run in background
   */
  async startFork(network: string, background = false): Promise<void> {
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
      // Mask the fork-url value to avoid leaking RPC API keys
      const safeArgs = anvilArgs.map((arg, i) =>
        anvilArgs[i - 1] === "--fork-url" ? arg.replace(/(\/v\d+\/)[^\s/]+/g, "$1***") : arg,
      );
      console.log("anvil", safeArgs.join(" "));
      console.log("\nPress Ctrl+C to stop the fork\n");
    }

    // Start anvil
    const anvil: ChildProcess = spawn("anvil", anvilArgs, {
      stdio: background ? "pipe" : "inherit",
      detached: background,
    });
    this._trackProcess(anvil);

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
