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
];

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

function formatCoverage(summary) {
  return `${summary.linePercent.toFixed(2)}% (${summary.lineCovered}/${summary.lineTotal})`;
}

function formatBranch(summary) {
  return `${summary.branchPercent.toFixed(2)}% (${summary.branchCovered}/${summary.branchTotal})`;
}

const args = parseArgs(process.argv);
const unitOk = args["unit-ok"] === "true";
const integrationOk = args["integration-ok"] === "true";
const unitError = args["unit-error"] ?? "";
const integrationError = args["integration-error"] ?? "";

const unitRecords = readLcov(args["unit-lcov"]);
const integrationRecords = readLcov(args["integration-lcov"]);
const combinedRecords = mergeRecords([unitRecords, integrationRecords]);

const rawUnit = summarize(unitRecords);
const rawIntegration = summarize(integrationRecords);
const coreCombined = summarize(combinedRecords, isCoreSource);
const coreStatus = unitOk && integrationOk && passes(coreCombined, CORE_TARGET) ? "PASS" : "FAIL";

const criticalRows = CRITICAL_TARGETS.map((target) => {
  const summary = summarizeFile(combinedRecords, target.file);
  const status = unitOk && integrationOk && passes(summary, target) ? "PASS" : "FAIL";
  return { ...target, summary, status };
});

let overallStatus = coreStatus;
if (!unitOk || !integrationOk || criticalRows.some((row) => row.status !== "PASS")) {
  overallStatus = "FAIL";
}

const summaryMd = `# Contracts Coverage Summary

Generated: ${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}

## Threshold Policy

Threshold math uses combined unit + integration LCOV over core production sources only.

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
| Combined core \`src/**\` | ${formatCoverage(coreCombined)} | ${formatBranch(coreCombined)} | line >= ${CORE_TARGET.line}%, branch >= ${CORE_TARGET.branch}% | ${coreStatus} |

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

These numbers are retained for diagnosis only. They are not release thresholds because each suite sees a partial execution slice.

| Suite | Line Coverage | Branch Coverage | Command Status |
|---|---:|---:|---|
| Unit \`test/unit/**\` | ${formatCoverage(rawUnit)} | ${formatBranch(rawUnit)} | ${unitOk ? "OK" : "ERROR"} |
| Integration \`test/integration/**\` | ${formatCoverage(rawIntegration)} | ${formatBranch(rawIntegration)} | ${integrationOk ? "OK" : "ERROR"} |

Execution Notes:
- Unit: ${unitError || "OK"}
- Integration: ${integrationError || "OK"}
- Overall status: ${overallStatus}

Artifacts:
- output/contracts-test-audit/lcov-unit.info
- output/contracts-test-audit/lcov-integration.info
- output/contracts-test-audit/coverage-unit.log
- output/contracts-test-audit/coverage-integration.log
`;

const summaryJson = {
  generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  policy: {
    threshold_scope: "combined unit + integration LCOV over core production src/**",
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
    unit: {
      ok: unitOk,
      line_covered: rawUnit.lineCovered,
      line_total: rawUnit.lineTotal,
      line_percent: rawUnit.linePercent,
      branch_covered: rawUnit.branchCovered,
      branch_total: rawUnit.branchTotal,
      branch_percent: rawUnit.branchPercent,
      error: unitError,
    },
    integration: {
      ok: integrationOk,
      line_covered: rawIntegration.lineCovered,
      line_total: rawIntegration.lineTotal,
      line_percent: rawIntegration.linePercent,
      branch_covered: rawIntegration.branchCovered,
      branch_total: rawIntegration.branchTotal,
      branch_percent: rawIntegration.branchPercent,
      error: integrationError,
    },
  },
  overall_status: overallStatus,
};

fs.mkdirSync(path.dirname(args["summary-md"]), { recursive: true });
fs.writeFileSync(args["summary-md"], summaryMd);
fs.writeFileSync(args["summary-json"], `${JSON.stringify(summaryJson, null, 2)}\n`);

console.log(`Coverage summary written: ${args["summary-md"]}`);
console.log(`Coverage JSON written: ${args["summary-json"]}`);
console.log(`Coverage status: ${overallStatus}`);

process.exit(overallStatus === "PASS" ? 0 : 1);
