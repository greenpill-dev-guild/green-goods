#!/usr/bin/env bun
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { redactRpcUrlsInText } from "../utils/cli-parser";
import { CONTRACTS_ROOT, getFoundryOutDir } from "../utils/paths";
import { writeReleaseJsonAtomic } from "../utils/release-artifacts";
import {
  buildVoucherPlan,
  inspectVoucherArtifacts,
  inspectVoucherManifest,
  loadVoucherArtifacts,
  validateVoucherPlan,
  VOUCHER_CONTRACTS,
} from "../utils/voucher-release";
import { simulateVoucherPlan } from "../utils/voucher-release-simulation";

export {
  releaseJsonPath as voucherJsonPath,
  assertReleaseSourcesCommitted as assertVoucherSourcesCommitted,
} from "../utils/release-inputs";
import { releaseJsonPath as voucherJsonPath, releaseRevision } from "../utils/release-inputs";

async function main() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
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
  if (positionals.length || [values.preflight, values["plan-only"], values.simulate].filter(Boolean).length !== 1)
    throw new Error("Select exactly one voucher operation mode");
  if (
    (values.preflight && (values.plan || values.output)) ||
    (values["plan-only"] && values.plan) ||
    (values.simulate && !values.plan)
  )
    throw new Error("Unexpected or missing voucher plan/output argument");
  const manifestPath = voucherJsonPath(
    path.join(CONTRACTS_ROOT, "config"),
    values.manifest ?? "config/voucher-pilot-release.json",
  );
  const commit = values.preflight ? null : releaseRevision(CONTRACTS_ROOT, manifestPath);
  const inspected = inspectVoucherManifest(JSON.parse(readFileSync(manifestPath, "utf8")));
  execFileSync("bun", ["run", "check:foundry-version"], { cwd: CONTRACTS_ROOT, stdio: "pipe" });
  execFileSync("bun", ["run", "build", "--mode", "target", "--", ...VOUCHER_CONTRACTS.map((c) => c.source)], {
    cwd: CONTRACTS_ROOT,
    env: { ...process.env, FOUNDRY_PROFILE: "production" },
    stdio: "pipe",
    maxBuffer: 16 * 1024 * 1024,
  });
  const artifacts = loadVoucherArtifacts(getFoundryOutDir("production"));
  const artifactHashes = inspectVoucherArtifacts(artifacts, inspected.manifest);
  if (values.preflight) {
    console.log(
      JSON.stringify(
        {
          state: "preflight",
          buildProfile: "production",
          artifactHashes,
          deploymentInputs: inspected.missing.length ? "pending" : "complete",
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
  // A plan names an exact source revision. Unrelated work outside this scope does not block it.
  if (commit === null || releaseRevision(CONTRACTS_ROOT, manifestPath) !== commit)
    throw new Error("Release revision changed during compilation");
  const directory = path.join(CONTRACTS_ROOT, ".generated/voucher-release");
  if (values["plan-only"]) {
    const plan = buildVoucherPlan(inspected.manifest, artifacts, commit);
    const output = voucherJsonPath(
      directory,
      values.output ?? `.generated/voucher-release/${plan.releaseId}.plan.json`,
    );
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
  const planPath = voucherJsonPath(directory, values.plan!);
  const plan: unknown = JSON.parse(readFileSync(planPath, "utf8"));
  validateVoucherPlan(plan, inspected.manifest, artifacts, commit);
  const result = await simulateVoucherPlan(plan, inspected.manifest);
  const output = voucherJsonPath(
    directory,
    values.output ?? `.generated/voucher-release/${plan.releaseId}.simulation.json`,
  );
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
    console.error(redactRpcUrlsInText(error instanceof Error ? error.message : "Voucher release preparation failed"));
    process.exitCode = 1;
  });
