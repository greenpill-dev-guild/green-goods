import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";

/**
 * GOODS Token Deployment Script
 *
 * Dual-mode deployment:
 * - standalone: Deploy simple ERC-20 GoodsToken (Sepolia, Celo)
 * - juicebox: Launch Juicebox project + deploy ERC-20 (Arbitrum)
 *
 * Usage:
 *   bun script/deploy/goods-token.ts --network sepolia --mode standalone --broadcast
 *   bun script/deploy/goods-token.ts --network arbitrum --mode juicebox --broadcast
 */

const CHAIN_ID_MAP: Record<string, string> = {
  sepolia: "11155111",
  arbitrum: "42161",
  celo: "42220",
  localhost: "31337",
};

const NETWORK_PROFILE_MAP: Record<string, string> = {
  sepolia: "sepolia",
  arbitrum: "arbitrum",
  celo: "celo",
};

interface Args {
  network: string;
  mode: "standalone" | "juicebox";
  broadcast: boolean;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let network = "sepolia";
  let mode: "standalone" | "juicebox" = "standalone";
  let broadcast = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--network" && args[i + 1]) {
      network = args[++i];
    } else if (args[i] === "--mode" && args[i + 1]) {
      const m = args[++i];
      if (m !== "standalone" && m !== "juicebox") {
        console.error(`Invalid mode: ${m}. Use 'standalone' or 'juicebox'.`);
        process.exit(1);
      }
      mode = m;
    } else if (args[i] === "--broadcast") {
      broadcast = true;
    }
  }

  return { network, mode, broadcast };
}

function updateDeploymentJson(chainId: string, updates: Record<string, string | number>): void {
  const deploymentsDir = path.join(__dirname, "../../deployments");
  const filePath = path.join(deploymentsDir, `${chainId}-latest.json`);

  let data: Record<string, unknown> = {};
  if (fs.existsSync(filePath)) {
    data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  }

  for (const [key, value] of Object.entries(updates)) {
    data[key] = value;
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`Updated ${filePath} with:`, updates);
}

async function deployStandaloneGoods(network: string, broadcast: boolean): Promise<void> {
  const chainId = CHAIN_ID_MAP[network] || network;
  const profile = NETWORK_PROFILE_MAP[network] || "default";

  console.log(`\nDeploying standalone GOODS token on ${network} (chain ${chainId})...`);

  // Use forge create for simple constructor-based deployment
  const broadcastFlag = broadcast ? "--broadcast" : "";
  const rpcFlag = broadcast ? `--rpc-url $${profile.toUpperCase()}_RPC_URL` : "";

  const cmd = [
    `cd ${path.join(__dirname, "../..")}`,
    `&&`,
    `FOUNDRY_PROFILE=${profile}`,
    `forge create`,
    `src/tokens/Goods.sol:GoodsToken`,
    `--constructor-args "Green Goods" "GOODS" $DEPLOYER_ADDRESS 1000000000000000000000000 100000000000000000000000000`,
    rpcFlag,
    broadcastFlag,
    broadcast ? "--private-key $DEPLOYER_PRIVATE_KEY" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (!broadcast) {
    console.log("\nDRY RUN - Would execute:");
    console.log(cmd);
    console.log(
      '\nConstructor args: name="Green Goods", symbol="GOODS", owner=DEPLOYER, initialSupply=1,000,000 GOODS, maxSupply=100,000,000 GOODS',
    );
    return;
  }

  try {
    const output = execSync(cmd, {
      stdio: "pipe",
      encoding: "utf8",
      env: { ...process.env },
    });

    // Parse deployed address from forge create output
    const match = output.match(/Deployed to:\s*(0x[a-fA-F0-9]{40})/);
    if (match) {
      const goodsTokenAddress = match[1];
      console.log(`GOODS token deployed to: ${goodsTokenAddress}`);
      updateDeploymentJson(chainId, { goodsToken: goodsTokenAddress });
    } else {
      console.error("Could not parse deployed address from output:", output);
    }
  } catch (error) {
    console.error("Deployment failed:", error);
    process.exit(1);
  }
}

async function deployJuiceboxGoods(network: string, broadcast: boolean): Promise<void> {
  const chainId = CHAIN_ID_MAP[network] || network;
  const profile = NETWORK_PROFILE_MAP[network] || "default";

  console.log(`\nDeploying Juicebox GOODS project on ${network} (chain ${chainId})...`);

  const broadcastFlag = broadcast ? "--broadcast" : "";

  const cmd = [
    `cd ${path.join(__dirname, "../..")}`,
    `&&`,
    `FOUNDRY_PROFILE=${profile}`,
    `forge script`,
    `script/DeployJuicebox.s.sol`,
    `--rpc-url $${profile.toUpperCase()}_RPC_URL`,
    broadcastFlag,
    "-vvv",
  ]
    .filter(Boolean)
    .join(" ");

  if (!broadcast) {
    console.log("\nDRY RUN - Would execute:");
    console.log(cmd);
    return;
  }

  try {
    execSync(cmd, {
      stdio: "inherit",
      env: { ...process.env },
    });
    console.log("Juicebox GOODS deployment complete");
  } catch (error) {
    console.error("Juicebox deployment failed:", error);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const { network, mode, broadcast } = parseArgs();

  console.log("=".repeat(60));
  console.log(`GOODS Token Deployment`);
  console.log(`Network: ${network}`);
  console.log(`Mode: ${mode}`);
  console.log(`Broadcast: ${broadcast}`);
  console.log("=".repeat(60));

  if (mode === "standalone") {
    await deployStandaloneGoods(network, broadcast);
  } else {
    if (network !== "arbitrum") {
      console.warn(`WARNING: Juicebox mode is intended for Arbitrum. ${network} may not have Juicebox deployed.`);
    }
    await deployJuiceboxGoods(network, broadcast);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
