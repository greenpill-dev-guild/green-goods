#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");

export const scopes = {
  guidance: [
    {
      id: "claude-guidance",
      label: "Claude guidance",
      command: ["bun", "run", "check:claude-guidance"],
      route: "audit-then-ship",
      severity: "medium",
    },
    {
      id: "codex-guidance",
      label: "Codex guidance",
      command: ["bun", "run", "check:codex-guidance"],
      route: "audit-then-ship",
      severity: "medium",
    },
    {
      id: "skills-mirror",
      label: "Skill mirror",
      command: ["bun", "run", "check:skills"],
      route: "audit-then-ship",
      severity: "medium",
    },
  ],
  plans: [
    {
      id: "plan-hub",
      label: "Plan hub",
      command: ["node", "scripts/harness/plan-hub.mjs", "validate"],
      route: "plan",
      severity: "medium",
    },
  ],
  design: [
    {
      id: "design-generated",
      label: "Design generated artifacts",
      command: ["bun", "run", "check:design-generated"],
      route: "design",
      severity: "medium",
    },
    {
      id: "design-tokens",
      label: "Design tokens",
      command: ["bun", "run", "check:design-tokens"],
      route: "design",
      severity: "medium",
    },
    {
      id: "vocab",
      label: "Banned vocabulary",
      command: ["bun", "run", "lint:vocab"],
      route: "design",
      severity: "medium",
    },
    {
      id: "docs-design-parity",
      label: "Docs design parity",
      command: ["bun", "run", "check:docs-design-parity"],
      route: "design",
      severity: "medium",
    },
  ],
  docs: [
    {
      id: "docs-audit",
      label: "Docs audit",
      command: ["bun", "run", "docs:audit:ci"],
      route: "audit-then-ship",
      severity: "medium",
      warningPattern: /docs-audit: [1-9]\d* warning\(s\)\./,
    },
  ],
  cleanup: [
    {
      id: "source-structure",
      label: "Source structure",
      command: ["bun", "run", "check:source-structure"],
      route: "clean --dry-run",
      severity: "medium",
    },
    {
      id: "react-patterns",
      label: "React pattern lint",
      command: ["bun", "run", "lint:rules"],
      route: "clean --dry-run",
      severity: "medium",
      warningPattern: /check-react-patterns: [1-9]\d* new warning\(s\):/,
    },
  ],
  quality: [
    {
      id: "test-quality",
      label: "Test quality",
      command: ["bun", "run", "check:test-quality"],
      route: "review",
      severity: "high",
    },
  ],
};

export const validScopes = new Set(["all", ...Object.keys(scopes)]);

export function usage(exitCode = 0) {
  const message = [
    "Usage: node scripts/quality/drift-check.mjs [--scope <all|guidance|plans|design|docs|cleanup|quality>] [--json]",
    "       node scripts/quality/drift-check.mjs <scope> [--json]",
  ].join("\n");
  if (exitCode === 0) console.log(message);
  else console.error(message);
  process.exit(exitCode);
}

export function parseArgs(argv) {
  let scope = "all";
  let json = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") usage(0);
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--scope") {
      scope = argv[index + 1];
      index += 1;
      continue;
    }
    if (!arg.startsWith("--")) {
      scope = arg;
      continue;
    }

    console.error(`Unknown option: ${arg}`);
    usage(2);
  }

  if (!validScopes.has(scope)) {
    console.error(`Unknown scope: ${scope}`);
    usage(2);
  }

  return { scope, json };
}

export function commandToString(command) {
  return command.join(" ");
}

export function fullOutput(stdout, stderr) {
  return [stdout, stderr].filter(Boolean).join("\n").trim();
}

export function tailOutput(stdout, stderr) {
  const output = fullOutput(stdout, stderr);
  if (!output) return "";
  return output.split("\n").slice(-16).join("\n");
}

export function checksForScope(scope) {
  if (scope !== "all") return scopes[scope].map((check) => ({ ...check, category: scope }));

  return Object.entries(scopes).flatMap(([category, checks]) =>
    checks.map((check) => ({ ...check, category })),
  );
}

export function statusForCheck(check, exitCode, output) {
  if (exitCode !== 0) return "fail";
  if (check.warningPattern?.test(output)) return "warn";
  return "pass";
}

export function checkResultFromOutput(check, { exitCode = 0, stdout = "", stderr = "", durationMs = 0 }) {
  const output = fullOutput(stdout, stderr);
  const outputTail = tailOutput(stdout, stderr);
  const status = statusForCheck(check, exitCode, output);

  return {
    id: check.id,
    label: check.label,
    category: check.category,
    status,
    exitCode,
    command: commandToString(check.command),
    summary:
      status === "pass"
        ? `${check.label} passed.`
        : status === "warn"
          ? `${check.label} reported warnings.`
          : `${check.label} failed.`,
    output_tail: outputTail,
    duration_ms: durationMs,
    route: check.route,
    severity: check.severity,
  };
}

export function runCheck(check) {
  const started = Date.now();
  const result = spawnSync(check.command[0], check.command.slice(1), {
    cwd: repoRoot,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });

  const exitCode = typeof result.status === "number" ? result.status : 1;
  return checkResultFromOutput(check, {
    exitCode,
    stdout: result.stdout,
    stderr: result.stderr || result.error?.message || "",
    durationMs: Date.now() - started,
  });
}

export function collectGitContext({ cwd = repoRoot, env = process.env } = {}) {
  if (env.DRIFT_CHECK_SKIP_GIT === "1") {
    return { available: false, dirty: false, entries: [], note: "git context skipped" };
  }

  if ("DRIFT_CHECK_FAKE_GIT_STATUS" in env) {
    const entries = env.DRIFT_CHECK_FAKE_GIT_STATUS.split("\n").filter(Boolean);
    return { available: true, dirty: entries.length > 0, entries };
  }

  const result = spawnSync("git", ["status", "--short"], {
    cwd,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });

  if (result.status !== 0) {
    return {
      available: false,
      dirty: false,
      entries: [],
      error: tailOutput(result.stdout, result.stderr || result.error?.message || ""),
    };
  }

  const entries = result.stdout.split("\n").filter(Boolean);
  return { available: true, dirty: entries.length > 0, entries };
}

export function findingFromCheck(check, index) {
  return {
    id: index + 1,
    severity: check.severity,
    category: check.category,
    status: check.status,
    title: `${check.label} drift detected`,
    evidence: check.command,
    recommended_route: check.route,
    summary: check.summary,
    output_tail: check.output_tail,
  };
}

export function buildReport({ scope = "all", run = runCheck, git = collectGitContext(), now = () => new Date() } = {}) {
  const checks = checksForScope(scope).map(run);
  const findings = checks.filter((check) => check.status !== "pass").map(findingFromCheck);

  return {
    ok: findings.length === 0,
    scope,
    generated_at: now().toISOString(),
    git,
    checks,
    findings,
  };
}

export function printText(report) {
  console.log(`# Drift Check — ${report.scope}`);
  console.log("");
  if (report.git.available) {
    const state = report.git.dirty ? `DIRTY (${report.git.entries.length} entries)` : "clean";
    console.log(`Working tree: ${state}`);
    console.log("");
  }

  console.log("## Checks");
  for (const check of report.checks) {
    const marker = check.status === "pass" ? "PASS" : check.status === "warn" ? "WARN" : "FAIL";
    console.log(`- [${marker}] ${check.category}/${check.id}: ${check.command}`);
  }

  console.log("");
  if (report.findings.length === 0) {
    console.log("No drift findings detected for this scope.");
    return;
  }

  console.log("## Findings");
  for (const finding of report.findings) {
    console.log(
      `${finding.id}. [${finding.severity.toUpperCase()}] ${finding.category}: ${finding.title}`,
    );
    console.log(`   Evidence: \`${finding.evidence}\``);
    console.log(`   Route: \`${finding.recommended_route}\``);
    if (finding.output_tail) {
      console.log("   Output:");
      for (const line of finding.output_tail.split("\n")) console.log(`   ${line}`);
    }
  }
}

function main() {
  const { scope, json } = parseArgs(process.argv.slice(2));
  const report = buildReport({ scope });

  if (json) console.log(JSON.stringify(report, null, 2));
  else printText(report);

  process.exit(report.ok ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
