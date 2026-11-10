#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { NetworkManager } from "./network";

const contractsRoot = path.resolve(import.meta.dir, "../..");

// The block CeloGardenAccountRelease.t.sol forks Celo at (its CELO_BLOCK). The release has since
// run on Celo, so a plan against the live head reports the deployed accounts as blockers. The
// planner reads the state the proof forks instead.
const PROOF_CELO_BLOCK = 74_938_820;

loadDotenv({ path: path.resolve(contractsRoot, "../../.env"), override: false, quiet: true });

// This proof pins historical blocks, so it needs archive-capable endpoints. Resolving through
// NetworkManager reuses the repository's env -> alias -> Alchemy resolution and raises a clear
// error when nothing is configured. Hardcoding the public endpoints here instead silently sent the
// run to non-archive nodes, which reported the pinned state as unavailable and was long
// misread as the sandbox being unable to reach the network at all.
const networks = new NetworkManager();
const environment = {
  ...process.env,
  ARBITRUM_RPC_URL: networks.getRpcUrl("arbitrum"),
  CELO_RPC_URL: networks.getRpcUrl("celo"),
  FOUNDRY_PROFILE: "fork",
};

function run(command: string, args: string[], label: string, profile = environment.FOUNDRY_PROFILE): void {
  process.stdout.write(`[garden-account-release] ${label}\n`);
  const result = spawnSync(command, args, {
    cwd: contractsRoot,
    env: { ...environment, FOUNDRY_PROFILE: profile },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// The planner derives the coordinator's address and code hashes from the production artifact and
// refuses to plan without it, so a clean checkout has to build it first.
run(
  process.execPath,
  ["script/utils/build-target.ts", "src/accounts/CeloGardenAccountDeploymentCoordinator.sol"],
  "building the production coordinator artifact the planner reads",
  "production",
);
run(
  process.execPath,
  ["script/deploy/celo-garden-accounts.ts", "plan", "--block", String(PROOF_CELO_BLOCK)],
  "generating reviewed runtime fixture",
);
run(
  "forge",
  ["test", "--match-path", "test/fork/CeloGardenAccountRelease.t.sol", "--threads", "1", "-vvv"],
  "running the pinned Celo release fork proof",
);
