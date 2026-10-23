#!/usr/bin/env bun
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { CLC_TIMELOCK_SOURCE, loadCLCTimelockArtifact } from "../utils/clc-release";
import { redactRpcUrlsInText } from "../utils/cli-parser";
import {
  buildLivePilotPackage,
  inspectLivePilotPackageConfig,
  inspectLivePilotPackageInputs,
  type LivePilotManifests,
} from "../utils/live-pilot-package";
import { CONFIG_ROOT, CONTRACTS_ROOT, getFoundryOutDir } from "../utils/paths";
import { writeReleaseJsonAtomic } from "../utils/release-artifacts";
import { releaseJsonPath, releaseRevision } from "../utils/release-inputs";
import {
  inspectSourceUpgradeManifest,
  loadSourceUpgradeArtifacts,
  SOURCE_UPGRADE_TARGETS,
} from "../utils/source-upgrade-release";
import { loadStewardArtifacts, STEWARD_CONTRACTS } from "../utils/steward-safe-release";
import { loadVoucherArtifacts, VOUCHER_CONTRACTS } from "../utils/voucher-release";

async function main() {
  const { values } = parseArgs({
    strict: true,
    allowPositionals: false,
    options: {
      preflight: { type: "boolean" },
      "plan-only": { type: "boolean" },
      manifest: { type: "string" },
      "source-upgrades-plan": { type: "string" },
      "steward-safe-plan": { type: "string" },
      "vouchers-plan": { type: "string" },
      "clc-plan": { type: "string" },
      output: { type: "string" },
    },
  });
  const planArguments = [
    values["source-upgrades-plan"],
    values["steward-safe-plan"],
    values["vouchers-plan"],
    values["clc-plan"],
  ];
  if (
    [values.preflight, values["plan-only"]].filter(Boolean).length !== 1 ||
    (values.preflight && [...planArguments, values.output].some(Boolean)) ||
    (values["plan-only"] && planArguments.some((value) => !value))
  )
    throw new Error("Pilot preflight accepts its manifest; plan mode requires all four component plans");
  const manifestPath = releaseJsonPath(CONFIG_ROOT, values.manifest ?? "config/live-pilot-release.json");
  const revision = values.preflight ? null : releaseRevision(CONTRACTS_ROOT, manifestPath);
  const config = inspectLivePilotPackageConfig(JSON.parse(readFileSync(manifestPath, "utf8")));
  const componentPaths = {
    sourceUpgrades: releaseJsonPath(CONFIG_ROOT, config.manifests.sourceUpgrades),
    stewardSafe: releaseJsonPath(CONFIG_ROOT, config.manifests.stewardSafe),
    vouchers: releaseJsonPath(CONFIG_ROOT, config.manifests.vouchers),
    clc: releaseJsonPath(CONFIG_ROOT, config.manifests.clc),
  };
  const checkRevision = () => {
    if (revision === null) throw new Error("Pilot plan requires a committed revision");
    for (const file of [manifestPath, ...Object.values(componentPaths)])
      if (releaseRevision(CONTRACTS_ROOT, file) !== revision) throw new Error("Pilot release revision changed");
  };
  if (!values.preflight) checkRevision();
  const manifests: LivePilotManifests = {
    sourceUpgrades: JSON.parse(readFileSync(componentPaths.sourceUpgrades, "utf8")),
    stewardSafe: JSON.parse(readFileSync(componentPaths.stewardSafe, "utf8")),
    vouchers: JSON.parse(readFileSync(componentPaths.vouchers, "utf8")),
    clc: JSON.parse(readFileSync(componentPaths.clc, "utf8")),
  };
  const inspected = inspectLivePilotPackageInputs(config, manifests);
  if (values.preflight) {
    console.log(
      JSON.stringify(
        {
          state: "preflight",
          ...inspected,
          compilationIncluded: false,
          liveBroadcast: false,
          activationIncluded: false,
        },
        null,
        2,
      ),
    );
    return;
  }
  if (revision === null) throw new Error("Pilot plan requires a committed revision");
  const readPlan = (directory: string, input: string | undefined): unknown => {
    if (!input) throw new Error("Missing component plan");
    return JSON.parse(readFileSync(releaseJsonPath(path.join(CONTRACTS_ROOT, directory), input), "utf8"));
  };
  // Resolve every confined input and output before compilation or artifact writes.
  const plans = {
    sourceUpgrades: readPlan(".generated/source-upgrades", values["source-upgrades-plan"]),
    stewardSafe: readPlan(".generated/steward-safe", values["steward-safe-plan"]),
    vouchers: readPlan(".generated/voucher-release", values["vouchers-plan"]),
    clc: readPlan(".generated/clc-release", values["clc-plan"]),
  };
  const output = releaseJsonPath(
    path.join(CONTRACTS_ROOT, ".generated/live-pilot"),
    values.output ?? `.generated/live-pilot/${config.releaseId}.package.json`,
  );
  const sourceManifest = inspectSourceUpgradeManifest(manifests.sourceUpgrades).manifest;
  const sources = [
    ...Object.entries(SOURCE_UPGRADE_TARGETS)
      .filter(([target]) => target === "pooling" || sourceManifest.settlement)
      .map(([, target]) => target.split(":")[0]),
    ...STEWARD_CONTRACTS.map((name) => `src/accounts/${name}.sol`),
    ...VOUCHER_CONTRACTS.map(({ source }) => source),
    CLC_TIMELOCK_SOURCE,
  ];
  execFileSync("bun", ["run", "check:foundry-version"], { cwd: CONTRACTS_ROOT, stdio: "pipe" });
  execFileSync("bun", ["run", "build", "--mode", "target", "--", ...new Set(sources)], {
    cwd: CONTRACTS_ROOT,
    env: { ...process.env, FOUNDRY_PROFILE: "production" },
    stdio: "pipe",
    maxBuffer: 16 * 1024 * 1024,
  });
  checkRevision();
  const out = getFoundryOutDir("production");
  const artifacts = {
    sourceUpgrades: loadSourceUpgradeArtifacts(out, sourceManifest),
    stewardSafe: loadStewardArtifacts(out),
    vouchers: loadVoucherArtifacts(out),
    clc: loadCLCTimelockArtifact(out),
  };
  const result = buildLivePilotPackage({ config, manifests, plans, artifacts, sourceCommit: revision });
  checkRevision();
  writeReleaseJsonAtomic(output, result);
  console.log(
    JSON.stringify(
      {
        state: "planned",
        output: path.relative(CONTRACTS_ROOT, output),
        sourceCommit: revision,
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
    console.error(
      redactRpcUrlsInText(error instanceof Error ? error.message : "Live pilot package preparation failed"),
    );
    process.exitCode = 1;
  });
