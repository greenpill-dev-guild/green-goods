#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import path from "node:path";
import { config as loadDotenv } from "dotenv";

const contractsRoot = path.resolve(import.meta.dir, "../..");

loadDotenv({ path: path.resolve(contractsRoot, "../../.env"), override: false, quiet: true });

const environment = {
  ...process.env,
  ARBITRUM_RPC_URL: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
  CELO_RPC_URL: process.env.CELO_RPC_URL || "https://forno.celo.org",
  FOUNDRY_PROFILE: "fork",
};

function run(command: string, args: string[], label: string): void {
  process.stdout.write(`[garden-account-release] ${label}\n`);
  const result = spawnSync(command, args, { cwd: contractsRoot, env: environment, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(process.execPath, ["script/deploy/celo-garden-accounts.ts", "plan"], "generating reviewed runtime fixture");
run(
  "forge",
  ["test", "--match-path", "test/fork/CeloGardenAccountRelease.t.sol", "--threads", "1", "-vvv"],
  "running the pinned Celo release fork proof",
);
