#!/usr/bin/env bun
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { CLC_TIMELOCK_SOURCE, inspectCLCTimelockArtifact, loadCLCTimelockArtifact } from "../utils/clc-release";
import { composeCLCMemberManifest } from "../utils/clc-member-inputs";
import { buildCLCReleasePlan, inspectCLCReleaseManifest, validateCLCReleasePlan } from "../utils/clc-member-release";
import { simulateCLCMemberPlan } from "../utils/clc-member-simulation";
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
      members: { type: "string" },
      receipts: { type: "string" },
      plan: { type: "string" },
      output: { type: "string" },
    },
  });
  if (
    [values.preflight, values["plan-only"], values.simulate].filter(Boolean).length !== 1 ||
    (values.preflight && (values.plan || values.output)) ||
    (values["plan-only"] && values.plan) ||
    (values.simulate && !values.plan) ||
    (values.receipts && !values.simulate)
  )
    throw new Error("Select exactly one CLC release mode with its required arguments");
  const manifestPath = releaseJsonPath(CONFIG_ROOT, values.manifest ?? "config/clc-pilot-release.json");
  const membersPath = values.members ? releaseJsonPath(CONFIG_ROOT, values.members) : null;
  const directory = path.join(CONTRACTS_ROOT, ".generated/clc-release");
  const planPath = values.plan ? releaseJsonPath(directory, values.plan) : null;
  const requestedOutput = values.output ? releaseJsonPath(directory, values.output) : null;
  const receiptsPath = values.receipts ? releaseJsonPath(directory, values.receipts) : null;
  const checkOutput = (output: string) => {
    if (
      [planPath, receiptsPath, manifestPath, membersPath].some((input) => input?.toLowerCase() === output.toLowerCase())
    )
      throw new Error("CLC output cannot overwrite its inputs or receipts");
  };
  if (requestedOutput) checkOutput(requestedOutput);
  const revision = values.preflight ? null : releaseRevision(CONTRACTS_ROOT, manifestPath);
  const checkRevision = () => {
    if (revision === null) throw new Error("CLC plan requires a committed revision");
    for (const file of [manifestPath, ...(membersPath ? [membersPath] : [])])
      if (releaseRevision(CONTRACTS_ROOT, file) !== revision)
        throw new Error("Release revision changed during CLC preparation");
  };
  if (!values.preflight) checkRevision();
  const base: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
  const inspected = inspectCLCReleaseManifest(
    membersPath ? composeCLCMemberManifest(base, JSON.parse(readFileSync(membersPath, "utf8"))) : base,
  );
  if (receiptsPath && inspected.manifest.schemaVersion !== 2)
    throw new Error("Receipt adoption is supported only for the member extension");
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
  checkRevision();
  if (revision === null) throw new Error("CLC plan requires a committed revision");
  if (values["plan-only"]) {
    const plan = buildCLCReleasePlan(inspected.manifest, artifact, revision);
    const output = requestedOutput ?? releaseJsonPath(directory, `.generated/clc-release/${plan.releaseId}.plan.json`);
    checkOutput(output);
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
  validateCLCReleasePlan(plan, inspected.manifest, artifact, revision);
  const rpc = new NetworkManager().getRpcUrl("gnosis");
  const result =
    plan.schemaVersion === 2 && inspected.manifest.schemaVersion === 2
      ? await simulateCLCMemberPlan(
          plan,
          inspected.manifest,
          artifact,
          rpc,
          receiptsPath ? JSON.parse(readFileSync(receiptsPath, "utf8")) : undefined,
        )
      : plan.schemaVersion === 1 && inspected.manifest.schemaVersion === 1
        ? await simulateCLCPilotPlan(plan, inspected.manifest, artifact, rpc)
        : (() => {
            throw new Error("CLC plan/manifest version mismatch");
          })();
  checkRevision();
  const output =
    requestedOutput ?? releaseJsonPath(directory, `.generated/clc-release/${plan.releaseId}.simulation.json`);
  checkOutput(output);
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
