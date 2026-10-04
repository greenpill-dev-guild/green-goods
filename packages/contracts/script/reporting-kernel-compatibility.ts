#!/usr/bin/env bun
import { execFileSync } from "node:child_process";
import * as path from "node:path";
import { config } from "dotenv";
import { redactRpcUrlsInText } from "./utils/cli-parser";
import { NetworkManager } from "./utils/network";
import { reportingCompatibilityOptions, startReportingFork } from "./utils/reporting-compatibility-boundary";
import { verifyReportingCompatibility } from "./utils/reporting-compatibility-scenarios";
import { writePolicyJson } from "./utils/single-attestation-operation";
import { reportingSourceDigest } from "./utils/reporting-compatibility-provenance";

const contracts = path.resolve(import.meta.dir, "..");
async function main() {
  reportingCompatibilityOptions(process.argv.slice(2));
  process.env.VITE_CHAIN_ID = "42161";
  config({ path: path.resolve(contracts, "../../.env"), quiet: true });
  const repository = path.resolve(contracts, "../..");
  const inputs = [
    "bun.lock",
    "packages/shared/package.json",
    "packages/shared/src",
    "packages/contracts/foundry.toml",
    "packages/contracts/foundry.lock",
    "packages/contracts/src/modules/SingleAttestationPolicy.sol",
    "packages/contracts/script/ReportingKernelFixtures.s.sol",
    "packages/contracts/script/reporting-kernel-compatibility.ts",
    "packages/contracts/script/utils/build-target.ts",
    "scripts/contracts/check-foundry-version.mjs",
    ...["boundary", "fixture", "evidence", "sdk", "scenarios", "provenance"].map(
      (name) => `packages/contracts/script/utils/reporting-compatibility-${name}.ts`,
    ),
  ];
  const sources = reportingSourceDigest(repository, inputs);
  execFileSync("bun", ["run", "check:foundry-version"], { cwd: contracts, stdio: "pipe" });
  execFileSync(
    "bun",
    [
      "run",
      "build",
      "--mode",
      "target",
      "--",
      "script/ReportingKernelFixtures.s.sol",
      "src/modules/SingleAttestationPolicy.sol",
    ],
    {
      cwd: contracts,
      env: { ...process.env, FOUNDRY_PROFILE: "production" },
      stdio: "pipe",
    },
  );
  const fork = await startReportingFork(new NetworkManager().getRpcUrl("arbitrum"));
  const stop = () => {
    void fork.stop().then(() => process.exit(130));
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    const result = {
      ...(await verifyReportingCompatibility(contracts, fork.rpc, (name) =>
        console.log(`Verified on isolated fork: ${name}`),
      )),
      forkBlock: fork.forkBlock,
      network: "arbitrum",
      chainId: 42161,
      commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: contracts, encoding: "utf8" }).trim(),
      verifiedAt: new Date().toISOString(),
      ...sources,
      workingTreeDirty: Boolean(
        execFileSync("git", ["status", "--porcelain", "--", ...inputs], { cwd: repository, encoding: "utf8" }).trim(),
      ),
    };
    if (reportingSourceDigest(repository, inputs).sourceDigest !== sources.sourceDigest)
      throw new Error("Reporting proof sources changed during verification; rerun on the stable source");
    writePolicyJson(contracts, path.join(contracts, ".generated/runtime/reporting-kernel-compatibility.json"), result);
    console.log(
      JSON.stringify({ ...result, sourceFiles: undefined, sourceFileCount: sources.sourceFiles.length }, null, 2),
    );
  } finally {
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
    await fork.stop();
  }
}
if (import.meta.main)
  main().catch((error) => {
    console.error(redactRpcUrlsInText(error instanceof Error ? error.message : "Reporting fork verification failed"));
    process.exitCode = 1;
  });
