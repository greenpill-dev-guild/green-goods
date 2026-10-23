#!/usr/bin/env bun
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { redactRpcUrlsInText } from "../utils/cli-parser";
import { NetworkManager } from "../utils/network";
import { CONTRACTS_ROOT, getFoundryOutDir } from "../utils/paths";
import { writeReleaseJsonAtomic } from "../utils/release-artifacts";
import { releaseJsonPath, releaseRevision } from "../utils/release-inputs";
import {
  buildSourceUpgradePlan,
  inspectSourceUpgradeArtifacts,
  inspectSourceUpgradeManifest,
  loadSourceUpgradeArtifacts,
  SOURCE_UPGRADE_TARGETS,
  validateSourceUpgradePlan,
} from "../utils/source-upgrade-release";
import { simulateSourceUpgradePlan } from "../utils/source-upgrade-simulation";

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
    throw new Error("Select exactly one source upgrade release mode and its required arguments");
  const manifestPath = releaseJsonPath(
    path.join(CONTRACTS_ROOT, "config"),
    values.manifest ?? "config/source-upgrade-release.json",
  );
  const revision = values.preflight ? null : releaseRevision(CONTRACTS_ROOT, manifestPath);
  const { manifest, missing } = inspectSourceUpgradeManifest(JSON.parse(readFileSync(manifestPath, "utf8")));
  execFileSync("bun", ["run", "check:foundry-version"], { cwd: CONTRACTS_ROOT, stdio: "pipe" });
  execFileSync(
    "bun",
    [
      "run",
      "build",
      "--mode",
      "target",
      "--",
      ...Object.entries(SOURCE_UPGRADE_TARGETS)
        .filter(([target]) => target === "pooling" || manifest.settlement)
        .map(([, key]) => key.split(":")[0]),
    ],
    {
      cwd: CONTRACTS_ROOT,
      env: { ...process.env, FOUNDRY_PROFILE: "production" },
      stdio: "pipe",
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  const artifacts = loadSourceUpgradeArtifacts(getFoundryOutDir("production"), manifest);
  const inspected = inspectSourceUpgradeArtifacts(artifacts, manifest);
  if (values.preflight) {
    console.log(
      JSON.stringify(
        {
          state: "preflight",
          missing,
          ...inspected,
          endState: "paused-original-owner",
          liveBroadcast: false,
          activationIncluded: false,
        },
        null,
        2,
      ),
    );
    return;
  }
  if (revision === null || releaseRevision(CONTRACTS_ROOT, manifestPath) !== revision)
    throw new Error("Release revision changed during source upgrade compilation");
  const directory = path.join(CONTRACTS_ROOT, ".generated/source-upgrades");
  if (values["plan-only"]) {
    const plan = buildSourceUpgradePlan(manifest, artifacts, revision);
    const output = releaseJsonPath(
      directory,
      values.output ?? `.generated/source-upgrades/${plan.releaseId}.plan.json`,
    );
    writeReleaseJsonAtomic(output, plan);
    console.log(
      JSON.stringify(
        {
          state: "planned",
          output: path.relative(CONTRACTS_ROOT, output),
          liveBroadcast: false,
          activationIncluded: false,
        },
        null,
        2,
      ),
    );
    return;
  }
  const plan: unknown = JSON.parse(readFileSync(releaseJsonPath(directory, values.plan!), "utf8"));
  validateSourceUpgradePlan(plan, manifest, artifacts, revision);
  const result = await simulateSourceUpgradePlan(plan, manifest, artifacts, new NetworkManager().getRpcUrl("arbitrum"));
  if (releaseRevision(CONTRACTS_ROOT, manifestPath) !== revision)
    throw new Error("Release revision changed during source upgrade simulation");
  const output = releaseJsonPath(
    directory,
    values.output ?? `.generated/source-upgrades/${plan.releaseId}.simulation.json`,
  );
  writeReleaseJsonAtomic(output, { sourceCommit: revision, releaseId: manifest.releaseId, ...result });
  console.log(
    JSON.stringify(
      {
        state: "simulated",
        output: path.relative(CONTRACTS_ROOT, output),
        liveBroadcast: false,
        activationIncluded: false,
      },
      null,
      2,
    ),
  );
}
if (import.meta.main)
  main().catch((error) => {
    console.error(redactRpcUrlsInText(error instanceof Error ? error.message : "Source upgrade preparation failed"));
    process.exitCode = 1;
  });
