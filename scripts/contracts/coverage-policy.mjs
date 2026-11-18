#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const CORE_TARGET = { line: 80, branch: 65 };
const EXCLUDED_PREFIXES = ["script/", "test/", "src/vendor/", "src/mocks/", "src/interfaces/"];
const CRITICAL_TARGETS = [
  { file: "src/registries/GreenWill.sol", line: 90, branch: 60 },
  { file: "src/modules/Octant.sol", line: 90, branch: 70 },
  { file: "src/resolvers/Yield.sol", line: 90, branch: 80 },
  { file: "src/strategies/AaveV3ERC4626.sol", line: 90, branch: 80 },
  { file: "src/accounts/Garden.sol", line: 90, branch: 75 },
  { file: "src/tokens/Garden.sol", line: 85, branch: 70 },
  { file: "src/registries/Action.sol", line: 90, branch: 70 },
  { file: "src/registries/Deployment.sol", line: 90, branch: 30 },
  { file: "src/registries/ENS.sol", line: 90, branch: 80 },
  { file: "src/registries/ENSReceiver.sol", line: 90, branch: 70 },
  { file: "src/registries/Power.sol", line: 80, branch: 60 },
  // Voucher pilot value paths (24 October 2026). Initial floors: ratchet them to the first measured
  // nightly run. StewardSafeReceiver is proved only by the gnosis-vouchers fork shard.
  { file: "src/modules/VoucherEntitlementModule.sol", line: 85, branch: 60 },
  { file: "src/modules/GnosisVoucherAdapter.sol", line: 85, branch: 60 },
  { file: "src/modules/VoucherRedemptionModule.sol", line: 85, branch: 60 },
  { file: "src/modules/VoucherRedemptionReceiver.sol", line: 85, branch: 60 },
  { file: "src/modules/GnosisVoucherEscrow.sol", line: 85, branch: 60 },
  { file: "src/lib/VoucherService/VoucherFinalAllocationLib.sol", line: 85, branch: 60 },
  { file: "src/lib/CommitmentPooling/ServiceOffersLib.sol", line: 85, branch: 60 },
  { file: "src/lib/CommitmentPooling/VoucherAcceptanceLib.sol", line: 85, branch: 60 },
  { file: "src/lib/Settlement/PersonalFundingLib.sol", line: 85, branch: 60 },
  { file: "src/lib/Settlement/PersonalPurchaseOutcomeLib.sol", line: 85, branch: 60 },
  { file: "src/accounts/StewardRolePublisher.sol", line: 85, branch: 60 },
];

const FAILING_TESTS_SHOWN = 5;
const REASON_MAX_LENGTH = 300;

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "");
    const value = argv[i + 1];
    if (!key || value === undefined) {
      throw new Error(`Invalid argument near ${argv[i] ?? "<end>"}`);
    }
    args[key] = value;
  }
  return args;
}

function normalizeSource(source) {
  return source.replaceAll("\\", "/").replace(/^.*\/packages\/contracts\//, "");
}

function isCoreSource(source) {
  return source.startsWith("src/") && !EXCLUDED_PREFIXES.some((prefix) => source.startsWith(prefix));
}

function emptyFileRecord() {
  return {
    lines: new Map(),
    branches: new Map(),
  };
}

function readLcov(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return new Map();

  const records = new Map();
  let currentSource = null;

  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    if (rawLine.startsWith("SF:")) {
      currentSource = normalizeSource(rawLine.slice(3));
      if (!records.has(currentSource)) records.set(currentSource, emptyFileRecord());
      continue;
    }

    if (!currentSource) continue;
    const record = records.get(currentSource);

    if (rawLine.startsWith("DA:")) {
      const [lineNumber, hits] = rawLine.slice(3).split(",");
      const key = Number(lineNumber);
      record.lines.set(key, Math.max(record.lines.get(key) ?? 0, Number(hits) || 0));
      continue;
    }

    if (rawLine.startsWith("BRDA:")) {
      const [lineNumber, block, branch, hits] = rawLine.slice(5).split(",");
      const key = `${lineNumber}:${block}:${branch}`;
      const hitCount = hits === "-" ? 0 : Number(hits) || 0;
      record.branches.set(key, Math.max(record.branches.get(key) ?? 0, hitCount));
    }
  }

  return records;
}

function mergeRecords(recordSets) {
  const merged = new Map();

  for (const records of recordSets) {
    for (const [source, record] of records) {
      if (!merged.has(source)) merged.set(source, emptyFileRecord());
      const mergedRecord = merged.get(source);

      for (const [lineNumber, hits] of record.lines) {
        mergedRecord.lines.set(lineNumber, Math.max(mergedRecord.lines.get(lineNumber) ?? 0, hits));
      }

      for (const [branchKey, hits] of record.branches) {
        mergedRecord.branches.set(branchKey, Math.max(mergedRecord.branches.get(branchKey) ?? 0, hits));
      }
    }
  }

  return merged;
}

function summarize(records, predicate = () => true) {
  let lineTotal = 0;
  let lineCovered = 0;
  let branchTotal = 0;
  let branchCovered = 0;

  for (const [source, record] of records) {
    if (!predicate(source)) continue;

    for (const hits of record.lines.values()) {
      lineTotal++;
      if (hits > 0) lineCovered++;
    }

    for (const hits of record.branches.values()) {
      branchTotal++;
      if (hits > 0) branchCovered++;
    }
  }

  return withPercentages({ lineCovered, lineTotal, branchCovered, branchTotal });
}

function summarizeFile(records, source) {
  const record = records.get(source) ?? emptyFileRecord();
  return summarize(new Map([[source, record]]));
}

function withPercentages(summary) {
  return {
    ...summary,
    linePercent: percentage(summary.lineCovered, summary.lineTotal),
    branchPercent: percentage(summary.branchCovered, summary.branchTotal),
  };
}

function percentage(covered, total) {
  return total > 0 ? Number(((covered / total) * 100).toFixed(2)) : 100;
}

function passes(summary, target) {
  return summary.linePercent >= target.line && summary.branchPercent >= target.branch;
}

function truncate(text) {
  return text.length > REASON_MAX_LENGTH ? `${text.slice(0, REASON_MAX_LENGTH)}...` : text;
}

function failingTests(log) {
  const section = log.split(/^Failing tests:\r?$/m)[1];
  if (!section) return [];

  const failures = [];
  let suite = "";
  for (const line of section.split(/\r?\n/)) {
    const header = /^Encountered \d+ failing tests? in \S+:(\w+)$/.exec(line);
    if (header) {
      suite = header[1];
      continue;
    }
    // Greedy up to the last "] name(" so a reason or counterexample in the brackets is skipped.
    const failure = /^\[FAIL.*\] (\w+)\(/.exec(line);
    if (failure) failures.push(suite ? `${suite}.${failure[1]}` : failure[1]);
  }
  return failures;
}

// A failed forge coverage run leaves every gate at 0/0, so name what stopped it.
function describeLocalFailure(log) {
  const timeout = /^TIMEOUT after (\d+)s$/m.exec(log);
  if (timeout) return `forge coverage timed out after ${timeout[1]}s`;

  const killed = /^KILLED by signal \(exit (\d+)\)/m.exec(log);
  if (killed) {
    return `forge coverage was killed by a signal (exit ${killed[1]}) before the audit's timeout; an out-of-memory kill looks like this`;
  }

  const compile = /^Error: Compiler run failed:\r?\n(?:Error: )?(.*)(?:\r?\n\s*--> (\S+))?/m.exec(log);
  if (compile) {
    const location = compile[2] ? ` at ${compile[2].replace(/:$/, "")}` : "";
    return truncate(`the coverage build did not compile: ${compile[1].trim()}${location}`);
  }

  const failures = failingTests(log);
  if (failures.length > 0) {
    const shown = failures.slice(0, FAILING_TESTS_SHOWN).join(", ");
    const more = failures.length > FAILING_TESTS_SHOWN ? `, and ${failures.length - FAILING_TESTS_SHOWN} more` : "";
    const noun = failures.length === 1 ? "test" : "tests";
    return `${failures.length} ${noun} failed under coverage: ${shown}${more}`;
  }

  const lastLine = log.trimEnd().split(/\r?\n/).at(-1)?.trim();
  return lastLine
    ? truncate(`no known failure pattern in the coverage log; it ends: ${lastLine}`)
    : "the coverage log is empty or missing";
}

function readLog(filePath) {
  return filePath && fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

const args = parseArgs(process.argv);
const localOk = args["local-ok"] === "true";
const localError = args["local-error"] ?? "";
// The runner passes a log only when forge coverage itself failed; any other local failure, such as a
// missing lcov.info after a clean run, is already named by --local-error.
const failedCommandLog = args["failed-command-log"];
let localFailure = "";
if (!localOk) localFailure = failedCommandLog ? describeLocalFailure(readLog(failedCommandLog)) : localError;

function shortfall(label, summary, target) {
  const misses = [];
  if (summary.linePercent < target.line) misses.push(`line ${summary.linePercent.toFixed(2)}% < ${target.line}%`);
  if (summary.branchPercent < target.branch) misses.push(`branch ${summary.branchPercent.toFixed(2)}% < ${target.branch}%`);
  return misses.length > 0 ? `${label} ${misses.join(", ")}` : null;
}

function formatCoverage(summary) {
  if (!localOk) return "not measured";
  return `${summary.linePercent.toFixed(2)}% (${summary.lineCovered}/${summary.lineTotal})`;
}

function formatBranch(summary) {
  if (!localOk) return "not measured";
  return `${summary.branchPercent.toFixed(2)}% (${summary.branchCovered}/${summary.branchTotal})`;
}

const localRecords = readLcov(args["local-lcov"]);
const combinedRecords = mergeRecords([localRecords]);

const rawLocal = summarize(localRecords);
const coreCombined = summarize(combinedRecords, isCoreSource);
const coreStatus = localOk && passes(coreCombined, CORE_TARGET) ? "PASS" : "FAIL";

const criticalRows = CRITICAL_TARGETS.map((target) => {
  const summary = summarizeFile(combinedRecords, target.file);
  const status = localOk && passes(summary, target) ? "PASS" : "FAIL";
  return { ...target, summary, status };
});

let overallStatus = coreStatus;
if (!localOk || criticalRows.some((row) => row.status !== "PASS")) {
  overallStatus = "FAIL";
}

const floorMisses = [
  shortfall("core src/**", coreCombined, CORE_TARGET),
  ...criticalRows.map((row) => shortfall(row.file, row.summary, row)),
].filter(Boolean);
const failureReason = localFailure || (floorMisses.length > 0 ? `below floor: ${floorMisses.join("; ")}` : "");

const summaryMd = `# Contracts Coverage Summary

Generated: ${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}

## Threshold Policy

Threshold math uses one LCOV run over all local non-fork, non-E2E Solidity tests and core production sources only.

Excluded from threshold math:
- \`script/**\`
- \`test/**\`
- \`src/vendor/**\`
- \`src/mocks/**\`
- \`src/interfaces/**\`

Fork and E2E suites remain pass/fail execution gates. They are intentionally not LCOV threshold inputs.

## Core Source Gate

| Gate | Line Coverage | Branch Coverage | Target | Status |
|---|---:|---:|---|---|
| Local core \`src/**\` | ${formatCoverage(coreCombined)} | ${formatBranch(coreCombined)} | line >= ${CORE_TARGET.line}%, branch >= ${CORE_TARGET.branch}% | ${coreStatus} |

## Critical Contract Gates

| Contract | Line Coverage | Branch Coverage | Target | Status |
|---|---:|---:|---|---|
${criticalRows
  .map(
    (row) =>
      `| \`${row.file}\` | ${formatCoverage(row.summary)} | ${formatBranch(row.summary)} | line >= ${row.line}%, branch >= ${row.branch}% | ${row.status} |`,
  )
  .join("\n")}

## Raw LCOV Command Output

These numbers are retained for diagnosis. Release thresholds use the filtered core subset above.

| Suite | Line Coverage | Branch Coverage | Command Status |
|---|---:|---:|---|
| Local non-fork, non-E2E Solidity tests | ${formatCoverage(rawLocal)} | ${formatBranch(rawLocal)} | ${localOk ? "OK" : "ERROR"} |

Execution Notes:
- Local: ${localError || "OK"}
${failureReason ? `- Reason: ${failureReason}\n` : ""}- Overall status: ${overallStatus}

Artifacts:
- output/contracts-test-audit/lcov-local.info
- output/contracts-test-audit/coverage-local.log
`;

const summaryJson = {
  generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  policy: {
    threshold_scope: "local non-fork, non-E2E LCOV over core production src/**",
    excluded_prefixes: EXCLUDED_PREFIXES,
    fork_e2e_policy: "pass/fail execution gates, not LCOV threshold inputs",
  },
  thresholds: {
    core_combined: CORE_TARGET,
    critical_contracts: Object.fromEntries(CRITICAL_TARGETS.map(({ file, line, branch }) => [file, { line, branch }])),
  },
  core_combined: {
    ...coreCombined,
    status: coreStatus,
  },
  critical_contracts: Object.fromEntries(
    criticalRows.map((row) => [
      row.file,
      {
        line_covered: row.summary.lineCovered,
        line_total: row.summary.lineTotal,
        line_percent: row.summary.linePercent,
        branch_covered: row.summary.branchCovered,
        branch_total: row.summary.branchTotal,
        branch_percent: row.summary.branchPercent,
        status: row.status,
      },
    ]),
  ),
  raw: {
    local: {
      ok: localOk,
      line_covered: rawLocal.lineCovered,
      line_total: rawLocal.lineTotal,
      line_percent: rawLocal.linePercent,
      branch_covered: rawLocal.branchCovered,
      branch_total: rawLocal.branchTotal,
      branch_percent: rawLocal.branchPercent,
      error: localError,
      failure_reason: failureReason,
    },
  },
  overall_status: overallStatus,
};

fs.mkdirSync(path.dirname(args["summary-md"]), { recursive: true });
fs.writeFileSync(args["summary-md"], summaryMd);
fs.writeFileSync(args["summary-json"], `${JSON.stringify(summaryJson, null, 2)}\n`);

console.log(`Coverage summary written: ${args["summary-md"]}`);
console.log(`Coverage JSON written: ${args["summary-json"]}`);
if (failureReason) console.log(`Coverage failure: ${failureReason}`);
console.log(`Coverage status: ${overallStatus}`);

process.exit(overallStatus === "PASS" ? 0 : 1);
