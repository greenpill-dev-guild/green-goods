#!/usr/bin/env bun
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  buildCLCPilotPlan,
  CLC_TIMELOCK_SOURCE,
  inspectCLCPilotManifest,
  inspectCLCTimelockArtifact,
  loadCLCTimelockArtifact,
  validateCLCPilotPlan,
} from "../utils/clc-release";
import { simulateCLCPilotPlan } from "../utils/clc-release-simulation";
import { redactRpcUrlsInText } from "../utils/cli-parser";
import { NetworkManager } from "../utils/network";
import { CONFIG_ROOT, CONTRACTS_ROOT, getFoundryOutDir } from "../utils/paths";
import { writeReleaseJsonAtomic } from "../utils/release-artifacts";
import { releaseJsonPath, releaseRevision } from "../utils/release-inputs";

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
    throw new Error("Select exactly one CLC release mode with its required arguments");
  const manifestPath = releaseJsonPath(CONFIG_ROOT, values.manifest ?? "config/clc-pilot-release.json");
  const directory = path.join(CONTRACTS_ROOT, ".generated/clc-release");
  const planPath = values.plan ? releaseJsonPath(directory, values.plan) : null;
  const requestedOutput = values.output ? releaseJsonPath(directory, values.output) : null;
  const revision = values.preflight ? null : releaseRevision(CONTRACTS_ROOT, manifestPath);
  const inspected = inspectCLCPilotManifest(JSON.parse(readFileSync(manifestPath, "utf8")));
  execFileSync("bun", ["run", "check:foundry-version"], { cwd: CONTRACTS_ROOT, stdio: "pipe" });
  execFileSync("bun", ["run", "build", "--mode", "target", "--", CLC_TIMELOCK_SOURCE], {
    cwd: CONTRACTS_ROOT,
    env: { ...process.env, FOUNDRY_PROFILE: "production" },
    stdio: "pipe",
    maxBuffer: 16 * 1024 * 1024,
  });
  const artifact = loadCLCTimelockArtifact(getFoundryOutDir("production"));
  const artifactHash = inspectCLCTimelockArtifact(artifact);
  if (values.preflight) {
    console.log(
      JSON.stringify(
        {
          state: "preflight",
          buildProfile: "production",
          artifactHash,
          deploymentMissing: inspected.deploymentMissing,
          activationMissing: inspected.activationMissing,
          activationIncluded: false,
          liveBroadcast: false,
        },
        null,
        2,
      ),
    );
    return;
  }
  if (revision === null || releaseRevision(CONTRACTS_ROOT, manifestPath) !== revision)
    throw new Error("Release revision changed during CLC compilation");
  if (values["plan-only"]) {
    const plan = buildCLCPilotPlan(inspected.manifest, artifact, revision);
    const output = requestedOutput ?? releaseJsonPath(directory, `.generated/clc-release/${plan.releaseId}.plan.json`);
    writeReleaseJsonAtomic(output, plan);
    console.log(
      JSON.stringify(
        {
          state: "planned",
          output: path.relative(CONTRACTS_ROOT, output),
          transactions: plan.transactions.length,
          activationIncluded: false,
          liveBroadcast: false,
        },
        null,
        2,
      ),
    );
    return;
  }
  if (planPath === null) throw new Error("CLC simulation requires its bound plan");
  const plan: unknown = JSON.parse(readFileSync(planPath, "utf8"));
  validateCLCPilotPlan(plan, inspected.manifest, artifact, revision);
  const result = await simulateCLCPilotPlan(
    plan,
    inspected.manifest,
    artifact,
    new NetworkManager().getRpcUrl("gnosis"),
  );
  if (releaseRevision(CONTRACTS_ROOT, manifestPath) !== revision)
    throw new Error("Release revision changed during CLC simulation");
  const output =
    requestedOutput ?? releaseJsonPath(directory, `.generated/clc-release/${plan.releaseId}.simulation.json`);
  writeReleaseJsonAtomic(output, result);
  console.log(
    JSON.stringify(
      {
        state: "simulated",
        output: path.relative(CONTRACTS_ROOT, output),
        activationIncluded: false,
        liveBroadcast: false,
      },
      null,
      2,
    ),
  );
}
if (import.meta.main)
  main().catch((error) => {
    console.error(redactRpcUrlsInText(error instanceof Error ? error.message : "CLC release preparation failed"));
    process.exitCode = 1;
  });
