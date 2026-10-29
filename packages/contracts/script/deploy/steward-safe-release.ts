#!/usr/bin/env bun
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { redactRpcUrlsInText } from "../utils/cli-parser";
import { NetworkManager } from "../utils/network";
import { CONTRACTS_ROOT, getFoundryOutDir } from "../utils/paths";
import { writeReleaseJsonAtomic } from "../utils/release-artifacts";
import { releaseRevision, releaseJsonPath } from "../utils/release-inputs";
import {
  buildStewardPlan,
  inspectStewardArtifacts,
  inspectStewardManifest,
  loadStewardArtifacts,
  stewardContracts,
  validateStewardPlan,
} from "../utils/steward-safe-release";
import { simulateStewardNetwork } from "../utils/steward-safe-simulation";
import { voucherDigest } from "../utils/voucher-release";

async function main() {
  const { values } = parseArgs({
    strict: true,
    allowPositionals: false,
    options: {
      preflight: { type: "boolean" },
      "plan-only": { type: "boolean" },
      simulate: { type: "boolean" },
      manifest: { type: "string" },
      plan: { type: "string" },
      output: { type: "string" },
    },
  });
  if (
    [values.preflight, values["plan-only"], values.simulate].filter(Boolean).length !== 1 ||
    (values.preflight && (values.plan || values.output)) ||
    (values["plan-only"] && values.plan) ||
    (values.simulate && !values.plan)
  )
    throw new Error("Select one steward release mode with its required arguments");
  const manifestPath = releaseJsonPath(
    path.join(CONTRACTS_ROOT, "config"),
    values.manifest ?? "config/steward-safe-release.json",
  );
  const commit = values.preflight ? null : releaseRevision(CONTRACTS_ROOT, manifestPath);
  const inspected = inspectStewardManifest(JSON.parse(readFileSync(manifestPath, "utf8")));
  execFileSync("bun", ["run", "check:foundry-version"], { cwd: CONTRACTS_ROOT, stdio: "pipe" });
  execFileSync(
    "bun",
    [
      "run",
      "build",
      "--mode",
      "target",
      "--",
      ...stewardContracts(inspected.manifest).map((n) => `src/accounts/${n}.sol`),
    ],
    {
      cwd: CONTRACTS_ROOT,
      env: { ...process.env, FOUNDRY_PROFILE: "production" },
      stdio: "pipe",
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  const artifacts = loadStewardArtifacts(getFoundryOutDir("production"), inspected.manifest.schemaVersion === 2),
    artifactHashes = inspectStewardArtifacts(artifacts, inspected.manifest.schemaVersion === 2);
  if (values.preflight) {
    console.log(
      JSON.stringify(
        {
          state: "preflight",
          buildProfile: "production",
          artifactHashes,
          missing: inspected.missing,
          activationMissing: inspected.activationMissing,
          authorityEnabled: false,
          liveBroadcast: false,
        },
        null,
        2,
      ),
    );
    return;
  }
  if (commit === null || releaseRevision(CONTRACTS_ROOT, manifestPath) !== commit)
    throw new Error("Release revision changed during compilation");
  const directory = path.join(CONTRACTS_ROOT, ".generated/steward-safe");
  if (values["plan-only"]) {
    const plan = buildStewardPlan(inspected.manifest, artifacts, commit);
    const output = releaseJsonPath(directory, values.output ?? `.generated/steward-safe/${plan.releaseId}.plan.json`);
    writeReleaseJsonAtomic(output, plan);
    console.log(
      JSON.stringify(
        {
          state: "planned",
          output: path.relative(CONTRACTS_ROOT, output),
          activationIncluded: Boolean(inspected.manifest.bootstrapSigner),
          liveBroadcast: false,
        },
        null,
        2,
      ),
    );
    return;
  }
  const input: unknown = JSON.parse(readFileSync(releaseJsonPath(directory, values.plan!), "utf8"));
  validateStewardPlan(input, inspected.manifest, artifacts, commit);
  const rows = [];
  for (const network of ["arbitrum", "gnosis"] as const)
    rows.push(
      await simulateStewardNetwork(
        input,
        inspected.manifest,
        artifacts,
        network,
        new NetworkManager().getRpcUrl(network),
      ),
    );
  const output = releaseJsonPath(
    directory,
    values.output ?? `.generated/steward-safe/${input.releaseId}.simulation.json`,
  );
  writeReleaseJsonAtomic(output, {
    sourceCommit: commit,
    releaseId: input.releaseId,
    planHash: voucherDigest(input),
    rows,
    liveBroadcast: false,
    activationIncluded: Boolean(inspected.manifest.bootstrapSigner),
  });
  console.log(
    JSON.stringify(
      {
        state: "simulated",
        output: path.relative(CONTRACTS_ROOT, output),
        liveBroadcast: false,
        activationIncluded: Boolean(inspected.manifest.bootstrapSigner),
      },
      null,
      2,
    ),
  );
}
if (import.meta.main)
  main().catch((error) => {
    console.error(redactRpcUrlsInText(error instanceof Error ? error.message : "Steward release failed"));
    process.exitCode = 1;
  });
