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
import { loadSourceUpgradeCompilerJobs } from "../utils/source-upgrade-compiler";
import { validateSourceUpgradeMode } from "../cli/operations.mjs";
import { runSourceUpgradeOperator, sourceUpgradeOutputPath } from "../utils/source-upgrade-operator";
import { sourceUpgradePlanRevision } from "../utils/source-upgrade-resume";
import { sourceBatchBuilderFile } from "../utils/source-upgrade-batch";
import { simulateSourceSafeBatch } from "../utils/source-upgrade-batch-simulation";

async function main() {
  const { values } = parseArgs({
    strict: true,
    allowPositionals: false,
    options: {
      preflight: { type: "boolean" },
      "plan-only": { type: "boolean" },
      simulate: { type: "boolean" },
      "prepare-execution": { type: "boolean" },
      broadcast: { type: "boolean" },
      "export-safe": { type: "boolean" },
      "sign-safe": { type: "boolean" },
      "broadcast-safe": { type: "boolean" },
      "draft-safe-batch": { type: "boolean" },
      "simulate-safe-batch": { type: "boolean" },
      "export-safe-batch": { type: "boolean" },
      "adopt-safe-batch": { type: "boolean" },
      "resume-plan": { type: "boolean" },
      batch: { type: "string" },
      "batch-rehearsal": { type: "string" },
      "signer-account": { type: "string" },
      "owner-signature": { type: "string" },
      "signature-one": { type: "string" },
      "signature-two": { type: "string" },
      adopt: { type: "boolean" },
      "recover-lock": { type: "boolean" },
      manifest: { type: "string" },
      plan: { type: "string" },
      output: { type: "string" },
      rehearsal: { type: "string" },
      "safe-pins": { type: "string" },
      "other-reserved-wei": { type: "string" },
      envelope: { type: "string" },
      step: { type: "string" },
      "expected-nonce": { type: "string" },
      receipt: { type: "string" },
    },
  });
  const modes = {
    preflight: "preflight",
    "plan-only": "plan",
    simulate: "simulate",
    "prepare-execution": "prepare-execution",
    broadcast: "broadcast",
    "export-safe": "export-safe",
    "sign-safe": "sign-safe",
    "broadcast-safe": "broadcast-safe",
    "draft-safe-batch": "draft-safe-batch",
    "simulate-safe-batch": "simulate-safe-batch",
    "export-safe-batch": "export-safe-batch",
    "adopt-safe-batch": "adopt-safe-batch",
    adopt: "adopt",
  };
  const selected = Object.keys(modes).filter((key) => values[key as keyof typeof values]);
  if (selected.length !== 1) throw new Error("Select exactly one source upgrade release mode");
  const options = Object.fromEntries(
    Object.entries(values).filter(([key, value]) => !(key in modes) && value !== undefined),
  );
  options.mode = modes[selected[0] as keyof typeof modes];
  validateSourceUpgradeMode(options);
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
      env: { ...process.env, FOUNDRY_PROFILE: "production", FOUNDRY_BUILD_INFO: "true", FOUNDRY_AST: "true" },
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
    const output = sourceUpgradeOutputPath(
      directory,
      options,
      `.generated/source-upgrades/${plan.releaseId}.plan.json`,
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
  const plannedRevision = sourceUpgradePlanRevision(
    CONTRACTS_ROOT,
    manifestPath,
    revision,
    (plan as { sourceCommit: string }).sourceCommit,
    Boolean(values["resume-plan"]),
  );
  validateSourceUpgradePlan(plan, manifest, artifacts, plannedRevision);
  if (values["draft-safe-batch"] || values["simulate-safe-batch"]) {
    const result = values["draft-safe-batch"]
      ? sourceBatchBuilderFile(plan, false)
      : await simulateSourceSafeBatch(
          plan,
          manifest,
          artifacts,
          new NetworkManager().getRpcUrl("arbitrum"),
          loadSourceUpgradeCompilerJobs(getFoundryOutDir("production"), artifacts),
          revision,
        );
    const output = sourceUpgradeOutputPath(
      directory,
      options,
      `.generated/source-upgrades/${plan.releaseId}.${values["draft-safe-batch"] ? "safe-batch.draft" : "safe-batch.simulation"}.json`,
    );
    if (
      output !==
      path.join(
        directory,
        `${plan.releaseId}.${values["draft-safe-batch"] ? "safe-batch.draft" : "safe-batch.simulation"}.json`,
      )
    )
      throw new Error("Batch preparation must use its owned artifact path");
    if (releaseRevision(CONTRACTS_ROOT, manifestPath) !== revision)
      throw new Error("Revision changed during batch preparation");
    writeReleaseJsonAtomic(output, result);
    console.log(
      JSON.stringify({
        state: values["draft-safe-batch"] ? "predicted-batch-draft" : "atomic-batch-rehearsed",
        output: path.relative(CONTRACTS_ROOT, output),
        liveBroadcast: false,
      }),
    );
    return;
  }
  if (!values.simulate) {
    console.log(
      JSON.stringify(
        await runSourceUpgradeOperator({
          options,
          manifestPath,
          manifest,
          plan,
          artifacts,
          revision,
          rpcUrl: new NetworkManager().getRpcUrl("arbitrum"),
        }),
        null,
        2,
      ),
    );
    return;
  }
  const jobs = loadSourceUpgradeCompilerJobs(getFoundryOutDir("production"), artifacts);
  const result = await simulateSourceUpgradePlan(
    plan,
    manifest,
    artifacts,
    new NetworkManager().getRpcUrl("arbitrum"),
    jobs,
  );
  if (releaseRevision(CONTRACTS_ROOT, manifestPath) !== revision)
    throw new Error("Release revision changed during source upgrade simulation");
  const output = sourceUpgradeOutputPath(
    directory,
    options,
    `.generated/source-upgrades/${plan.releaseId}.simulation.json`,
  );
  writeReleaseJsonAtomic(output, { releaseId: manifest.releaseId, ...result });
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
