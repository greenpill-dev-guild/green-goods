#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { NetworkManager } from "./network";

const contractsRoot = path.resolve(import.meta.dir, "../..");
const reviewedSafeBindings = path.resolve(
  contractsRoot,
  "../../.plans/active/celo-garden-account-safe-ownership/evidence/garden-safe-final-bindings-2026-08-15.json",
);

loadDotenv({ path: path.resolve(contractsRoot, "../../.env"), override: false, quiet: true });

// The proof consumes the planner's own artifact, so the fixture is regenerated first and the fork
// runs against the exact condition tree the release would install.
const networks = new NetworkManager();
const environment = {
  ...process.env,
  CELO_RPC_URL: networks.getRpcUrl("celo"),
  FOUNDRY_PROFILE: "fork",
};

function run(command: string, args: string[], label: string): void {
  process.stdout.write(`[garden-roles-proof] ${label}\n`);
  const result = spawnSync(command, args, { cwd: contractsRoot, env: environment, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(
  process.execPath,
  ["script/deploy/garden-roles.ts", "plan", "--safe-plan", reviewedSafeBindings],
  "generating the reviewed permission fixture from checked-in Safe bindings",
);
run(
  "forge",
  ["test", "--isolate", "--match-path", "test/fork/CeloGardenRolesPermission.t.sol", "--threads", "1", "-vvv"],
  "running the pinned Celo Roles permission fork proof",
);
