/**
 * Release gas gate for the frozen commitment-release source-acknowledgment boundary.
 *
 * Runs the three boundary fixtures named in config/commitment-pooling-release.json
 * against the exact release codegen and cold-path execution semantics:
 *
 *   - `FOUNDRY_PROFILE=production` — via_ir, optimizer_runs = 1, the frozen artifact.
 *   - `forge test --isolate` — every top-level call executes as its own transaction with
 *     a fresh access list, so acknowledgment delivery pays true cold gas like a live CCIP
 *     delivery. `vm.cool` is not sufficient: in normal (non-tracing) runs it leaves
 *     accounts and slots warm (measured 2026-08-12, forge 1.5.1).
 *
 * Fail-closed guarantees:
 *   - The fixture list comes from the release config, so a renamed or deleted boundary
 *     test cannot silently drop out of the gate: `forge test --list` must resolve every
 *     configured fixture before anything runs.
 *   - The production `src` tree is built first (unlinked, full), which is also the exact
 *     artifact set the release lock derivation reads.
 */

import * as fs from "node:fs";
import { resolve } from "path";

const contractsDir = resolve(import.meta.dir, "../..");
const RELEASE_CONFIG_PATH = resolve(contractsDir, "config/commitment-pooling-release.json");

function log(message: string) {
  console.log(`[release-gas-gate] ${message}`);
}

function fail(message: string): never {
  console.error(`[release-gas-gate] ${message}`);
  process.exit(1);
}

interface FixtureRef {
  contract: string;
  test: string;
}

function parseFixture(label: string, value: unknown): FixtureRef {
  if (typeof value !== "string" || !/^[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/.test(value)) {
    fail(`${label} must be an exact "Contract.testName" reference, got: ${String(value)}`);
  }
  const [contract, test] = value.split(".");
  return { contract, test };
}

function loadFixtures(): FixtureRef[] {
  const config = JSON.parse(fs.readFileSync(RELEASE_CONFIG_PATH, "utf8"));
  const measurement = config?.batching?.sourceAcknowledgmentMeasurement;
  if (!measurement) fail("release config is missing batching.sourceAcknowledgmentMeasurement");
  const fixtures = [
    parseFixture("acceptedFixture", measurement.acceptedFixture),
    parseFixture("firstRejectedFixture", measurement.firstRejectedFixture),
    parseFixture("hardMaxFixture", measurement.hardMaxFixture),
  ];
  const contracts = new Set(fixtures.map((fixture) => fixture.contract));
  if (contracts.size !== 1) {
    fail(`boundary fixtures must live in one test contract, found: ${[...contracts].join(", ")}`);
  }
  const tests = new Set(fixtures.map((fixture) => fixture.test));
  if (tests.size !== fixtures.length) fail("boundary fixtures must name three distinct tests");
  return fixtures;
}

async function runForge(args: string[], capture: boolean): Promise<{ code: number; stdout: string }> {
  const proc = Bun.spawn(["forge", ...args], {
    cwd: contractsDir,
    stdout: capture ? "pipe" : "inherit",
    stderr: "inherit",
    env: { ...process.env, FOUNDRY_PROFILE: "production" },
  });
  const stdout = capture ? await new Response(proc.stdout).text() : "";
  const code = await proc.exited;
  return { code, stdout };
}

function extractListedTests(stdout: string, contract: string): string[] {
  // `forge test --list --json` emits one JSON object mapping source file -> contract -> tests.
  // Parse the last JSON-looking line so stray compiler output cannot break the check.
  const lines = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("{"));
  for (const line of lines.reverse()) {
    try {
      const parsed = JSON.parse(line) as Record<string, Record<string, string[]>>;
      for (const contracts of Object.values(parsed)) {
        for (const [name, tests] of Object.entries(contracts)) {
          if (name === contract || name.endsWith(`:${contract}`)) return tests;
        }
      }
      return [];
    } catch {
      // Not the JSON payload; keep looking.
    }
  }
  fail("could not parse `forge test --list --json` output");
}

async function main() {
  const fixtures = loadFixtures();
  const contract = fixtures[0].contract;
  const matchContract = `^${contract}$`;
  // forge matches test filters against the full signature ("testFoo()"), so the
  // anchor must close over the parameterless parentheses, never the bare name.
  const matchTest = `^(${fixtures.map((fixture) => fixture.test).join("|")})\\(\\)$`;

  log(`boundary fixtures: ${fixtures.map((fixture) => fixture.test).join(", ")}`);
  log("building full production src artifacts (unlinked; shared with the release lock derivation)");
  const build = await runForge(["build", "-q", "--skip", "test", "--skip", "script"], false);
  if (build.code !== 0) fail(`production build failed with exit code ${build.code}`);

  log("verifying every configured fixture still resolves before running");
  const list = await runForge(
    ["test", "--list", "--json", "--match-contract", matchContract, "--match-test", matchTest],
    true,
  );
  if (list.code !== 0) fail(`forge test --list failed with exit code ${list.code}`);
  const listed = extractListedTests(list.stdout, contract);
  const missing = fixtures.filter((fixture) => !listed.some((name) => name.replace(/\(\)$/, "") === fixture.test));
  if (missing.length > 0) {
    fail(
      `configured boundary fixtures missing from ${contract}: ${missing.map((fixture) => fixture.test).join(", ")}. ` +
        "A drifted fixture name must be fixed in config/commitment-pooling-release.json and the test together.",
    );
  }
  if (listed.length !== fixtures.length) {
    fail(`expected exactly ${fixtures.length} boundary tests, forge resolved ${listed.length}: ${listed.join(", ")}`);
  }

  log("running the production-codegen cold-path boundary proof (--isolate)");
  const run = await runForge(
    ["test", "--isolate", "--match-contract", matchContract, "--match-test", matchTest, "-vv"],
    false,
  );
  if (run.code !== 0) fail(`release gas boundary proof failed with exit code ${run.code}`);
  log("release gas boundary proven against the production artifact");
}

await main();
