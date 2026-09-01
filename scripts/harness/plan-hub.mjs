#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as yaml from "js-yaml";

import { isWorkBranchName } from "../quality/branch-name-policy.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "../..");
const PLANS_ROOT = join(REPO_ROOT, ".plans");
const VALIDATION_RECEIPT_DEBT_PATH = join(
  REPO_ROOT,
  "scripts/data/plan-hub-validation-receipt-debt.json",
);
const STAGES = ["ideas", "backlog", "active"];
const MOVE_STAGES = [...STAGES, "archive"];
const VALIDATION_STAGES = [...STAGES, "archive"];
const ALLOWED_PLAN_ROOT_ENTRIES = new Set(["README.md", "ARCHIVE.md", "_templates", ...VALIDATION_STAGES]);
const ARCHIVE_LEDGER_PATH = join(PLANS_ROOT, "ARCHIVE.md");
const ARCHIVE_LEDGER_HEADER = `# Archived Plan Ledger

Closed feature hubs are deleted from the working tree; Git history is the only archive.
Recover one with \`git log --oneline -- <historical path>\` and
\`git checkout <sha>^ -- <historical path>\` against its closeout commit.

| Archived (UTC) | Slug | Linear | Title | Resolution | Historical path | Closeout |
|---|---|---|---|---|---|---|
`;
const REQUIRED_LINK_ROLES = ["brief", "spec", "plan", "eval"];
const ARCHIVE_STATUS_KEYS = new Set([
  "version",
  "feature",
  "workflow",
  "links",
  "linear",
  "taxonomy",
  "lanes",
  "history",
]);
const ARCHIVE_LINEAR_KEYS = new Set([
  "syncDirection",
  "laneSyncMode",
  "lastSyncedAt",
  "issue",
  "parentIssue",
  "project",
  "initiative",
  "lanes",
]);
const STAGE_TO_STATUS = {
  ideas: "idea",
  backlog: "backlog",
  active: "active",
  archive: "done",
};
const VALID_PRIORITIES = new Set(["p0", "p1", "p2", "p3"]);
const VALID_LANE_STATUSES = new Set([
  "todo",
  "ready",
  "in_progress",
  "blocked",
  "passed",
  "failed",
  "n/a",
  "skipped",
  "completed",
]);
const DONE_LANE_STATUSES = new Set(["passed", "completed", "n/a", "skipped"]);
const VALID_ARCHIVE_RESOLUTIONS = new Set([
  "completed",
  "closed",
  "closed_stale",
  "superseded",
  "paused",
  "cancelled",
]);
const IMPLEMENTATION_LANES = new Set(["ui", "state_api", "contracts"]);
const PROOF_TERMINAL_STATUSES = new Set(["passed", "completed"]);
const VALID_TDD_MODES = new Set(["required", "not_applicable", "proof_limit", "legacy_unrecorded"]);
const VALID_TDD_STATUSES = new Set(["pending", "red_recorded", "green_recorded"]);
const TDD_POLICY_STARTED_AT = Date.parse("2026-05-01T00:00:00.000Z");
const HANDOFF_FILE_POLICY_STARTED_AT = Date.parse("2026-07-06T00:00:00.000Z");
const VALIDATION_RECEIPT_POLICY_STARTED_AT = Date.parse("2026-08-11T00:00:00.000Z");
const VALID_TAXONOMY_INITIATIVES = new Set([
  "agent-platform",
  "design-system",
  "engineering-quality",
  "environmental-data",
  "identity-ens",
  "identity-wallet",
  "protocol-readiness",
  "public-experience",
  "reputation",
  "seasons",
  "yield-to-impact",
]);
const VALID_TAXONOMY_TRACKS = new Set([
  "admin",
  "agent",
  "client",
  "client-browser",
  "client-pwa",
  "contracts",
  "docs",
  "indexer",
  "ops",
  "shared",
]);
const VALID_TAXONOMY_WORK_TYPES = new Set([
  "cleanup",
  "hardening",
  "implementation",
  "maintenance",
  "observability",
  "ops",
  "qa",
  "research",
  "review",
]);
const LANE_ALIASES = {
  ui: "ui",
  "state-api": "state_api",
  state_api: "state_api",
  contracts: "contracts",
  "qa-pass-1": "qa_pass_1",
  qa_pass_1: "qa_pass_1",
  "qa-pass-2": "qa_pass_2",
  qa_pass_2: "qa_pass_2",
};
const CANONICAL_LANES = ["ui", "state_api", "contracts", "qa_pass_1", "qa_pass_2"];
const CANONICAL_LANE_SET = new Set(CANONICAL_LANES);
const LINEAR_SYNC_DIRECTION = "plans_to_linear_visibility";
const LINEAR_LANE_SYNC_MODES = new Set(["lane_issues", "parent_only"]);
const DEFAULT_LINEAR_LANE_SYNC_MODE = "lane_issues";
const LINEAR_BASE_LABELS = ["protocol:green-goods", "source:plans"];
const LINEAR_PARENT_ACTIVITY_LABEL = "activity:architecture";
const LINEAR_LANE_SKIP_STATUSES = new Set(["n/a", "skipped", "passed", "completed"]);
const EXECUTION_SUB_LANE_NAME = /^[a-z][a-z0-9_]*$/;
const EXECUTION_SUB_LANE_OWNERS = new Set(["codex", "claude", "human"]);
const EXECUTION_SUB_LANE_PACKAGE_LABELS = {
  contracts: "package:contracts",
  settlement: "package:contracts",
  indexer: "package:indexer",
  state_api: "package:shared",
  ui_client: "package:client",
  ui_admin: "package:admin",
  editorial: "package:docs",
  docs: "package:docs",
  docs_guides: "package:docs",
  walkthrough_videos: "package:docs",
  community: "package:client",
};
// Human titles for mirrored lane issues. Linear titles are read by teammates
// scanning a board, so a lane mirror is titled by the work it covers, never by
// its lane slug — see `.claude/context/linear-routing-rules.md`. Lanes absent
// here fall back to "<Lane Name> for <Feature>", which still reads as a phrase.
const LANE_TITLE_PHRASES = {
  ui: "Build the interface for",
  ui_admin: "Build the admin interface for",
  ui_client: "Build the client interface for",
  state_api: "Build the data and API layer for",
  contracts: "Build the contracts for",
  indexer: "Build the indexer for",
  qa_pass_1: "Run the first QA pass on",
  qa_pass_2: "Run the second QA pass on",
  docs: "Write the documentation for",
  docs_guides: "Write the guides for",
  editorial: "Write the editorial surfaces for",
  walkthrough_videos: "Record the walkthrough videos for",
  community: "Run the community rollout for",
  release_ops: "Run release ops for",
};
const TRACK_TO_PACKAGE_LABEL = {
  admin: "package:admin",
  agent: "package:agent",
  client: "package:client",
  "client-browser": "package:client",
  "client-pwa": "package:client",
  contracts: "package:contracts",
  docs: "package:docs",
  indexer: "package:indexer",
  shared: "package:shared",
};
const LANE_PACKAGE_TRACK_PRIORITIES = {
  ui: ["admin", "client-browser", "client-pwa", "client"],
  state_api: ["shared", "indexer", "agent", "contracts", "docs", "admin", "client-browser", "client-pwa", "client"],
  contracts: ["contracts"],
};

function usage() {
  console.log(`Usage:
  node scripts/harness/plan-hub.mjs scaffold <feature-slug> [--title "Feature Title"] [--stage backlog]
  node scripts/harness/plan-hub.mjs move --feature <feature-slug> --to <ideas|backlog|active|archive> [--reason "closeout reason"] [--resolution <completed|closed|closed_stale|superseded|paused|cancelled>]
      (--to archive validates the hub, appends a row to .plans/ARCHIVE.md, and deletes the hub directory; git history is the only archive)
  node scripts/harness/plan-hub.mjs list --agent <claude|codex> --lane <lane> [--stage active] [--json]
  node scripts/harness/plan-hub.mjs set-lane --feature <feature-slug> --lane <lane> --status <status> [--actor human] [--branch <branch>] [--note "text"]
  node scripts/harness/plan-hub.mjs record-tdd --feature <feature-slug> --lane <ui|state-api|contracts> --red-command "..." --red-evidence "..." --green-command "..." --green-evidence "..." [--actor human]
  node scripts/harness/plan-hub.mjs linear-sync --feature <feature-slug> [--json]
  node scripts/harness/plan-hub.mjs record-linear --feature <feature-slug> [--parent PRD-123] [--lane ui=PRD-124] [--execution-lane contracts=PRD-125] [--lane-sync-mode <lane_issues|parent_only>] [--project <name-or-id>] [--initiative <name-or-id>] [--actor human]
  node scripts/harness/plan-hub.mjs confirm-linear-sync --feature <feature-slug> --actor <actor>
  node scripts/harness/plan-hub.mjs summary [--initiative <initiative>] [--track <track>] [--json]
  node scripts/harness/plan-hub.mjs stale [--days 14] [--json]
  node scripts/harness/plan-hub.mjs check-branch --feature <feature-slug> --lane <lane>
  node scripts/harness/plan-hub.mjs validate`);
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];

    const value = !next || next.startsWith("--") ? true : next;
    if (Object.hasOwn(flags, key)) {
      flags[key] = Array.isArray(flags[key]) ? [...flags[key], value] : [flags[key], value];
    } else {
      flags[key] = value;
    }

    if (value === true) {
      continue;
    }

    i += 1;
  }

  return { positional, flags };
}

function fail(message, exitCode = 1) {
  console.error(message);
  process.exit(exitCode);
}

function requireFlag(flags, key) {
  if (!flags[key]) {
    fail(`Missing required flag: --${key}`);
  }

  return flags[key];
}

function assertStage(stage) {
  if (!STAGES.includes(stage)) {
    fail(`Invalid stage "${stage}". Expected one of: ${STAGES.join(", ")}`);
  }
}

function assertMoveStage(stage) {
  if (!MOVE_STAGES.includes(stage)) {
    fail(`Invalid stage "${stage}". Expected one of: ${MOVE_STAGES.join(", ")}`);
  }
}

function normalizeLane(lane) {
  const normalized = LANE_ALIASES[lane];

  if (!normalized) {
    fail(`Invalid lane "${lane}". Expected one of: ${Object.keys(LANE_ALIASES).join(", ")}`);
  }

  return normalized;
}

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function titleFromSlug(slug) {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function slugFromPath(featureDir) {
  return featureDir.split("/").at(-1);
}

function statusPathForDir(featureDir) {
  return join(featureDir, "status.json");
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function saveJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function planStageDir(stage) {
  return join(PLANS_ROOT, stage);
}

function featureDir(stage, slug) {
  return join(planStageDir(stage), slug);
}

function findFeature(slug) {
  for (const stage of STAGES) {
    const candidate = featureDir(stage, slug);
    if (existsSync(candidate) && existsSync(statusPathForDir(candidate))) {
      return { stage, dir: candidate };
    }
  }

  fail(`Could not find feature "${slug}" in .plans/{ideas,backlog,active}/`);
}

function templatePath(relativePath) {
  return join(PLANS_ROOT, "_templates", "feature", relativePath);
}

function applyTemplate(relativePath, destinationDir, replacements) {
  const source = templatePath(relativePath);
  const destination = join(destinationDir, relativePath);
  let contents = readFileSync(source, "utf8");

  for (const [key, value] of Object.entries(replacements)) {
    contents = contents.replaceAll(`{{${key}}}`, value);
  }

  writeFileSync(destination, contents);
}

function ensureActiveHandoffFiles(destinationDir, replacements) {
  mkdirSync(join(destinationDir, "handoffs"), { recursive: true });
  for (const relativePath of [
    join("handoffs", "README.md"),
    join("handoffs", "claude-ui.md"),
    join("handoffs", "codex-state-api.md"),
    join("handoffs", "codex-contracts.md"),
    join("handoffs", "claude-qa-pass-1.md"),
    join("handoffs", "codex-qa-pass-2.md"),
  ]) {
    if (!existsSync(join(destinationDir, relativePath))) {
      applyTemplate(relativePath, destinationDir, replacements);
    }
  }
}


function isConfinedReportLink(link) {
  if (typeof link !== "string" || !link.startsWith("reports/") || link.includes("\\")) return false;
  const segments = link.split("/");
  return segments.length > 1 && segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

function reportsEntryError(featureDirPath) {
  const reportsPath = join(featureDirPath, "reports");
  let stats;
  try {
    stats = lstatSync(reportsPath);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    return `${reportsPath}: reports must be a real directory inside the feature hub before archive compaction`;
  }

  const directories = [reportsPath];
  while (directories.length > 0) {
    const directory = directories.pop();
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = join(directory, entry.name);
      const entryStats = lstatSync(entryPath);
      if (entryStats.isSymbolicLink()) {
        return `${entryPath}: reports must not contain symlinks before archive compaction`;
      }
      if (entryStats.isFile() && entryStats.nlink > 1) {
        return `${entryPath}: reports must not contain hard-linked files before archive compaction`;
      }
      if (entryStats.isDirectory()) directories.push(entryPath);
    }
  }

  return null;
}



function ledgerCell(value) {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll(/\r?\n/g, " ").trim();
}

function appendArchiveLedgerEntry(status, historicalPath) {
  const linearParent = canonicalLinearParentIssue(status.linear) || "—";
  const row = `| ${ledgerCell(status.workflow.archived_at)} | \`${ledgerCell(status.feature.slug)}\` | ${ledgerCell(linearParent)} | ${ledgerCell(status.feature.title)} | ${ledgerCell(status.workflow.resolution)} | \`${ledgerCell(historicalPath)}\` | ${ledgerCell(status.workflow.archive_reason)} |\n`;
  const existing = existsSync(ARCHIVE_LEDGER_PATH)
    ? readFileSync(ARCHIVE_LEDGER_PATH, "utf8")
    : ARCHIVE_LEDGER_HEADER;
  writeFileSync(ARCHIVE_LEDGER_PATH, `${existing.endsWith("\n") ? existing : `${existing}\n`}${row}`);
}

function compactArchiveStatus(status) {
  const slug = status.feature.slug;
  const archivedAt = status.workflow.archived_at || status.workflow.updated_at;
  const archiveEvent = [...(status.history || [])].reverse().find((entry) => entry.status === "moved_to_archive");

  status.workflow = {
    overall_status: "done",
    priority: status.workflow.priority,
    created_at: status.workflow.created_at,
    updated_at: status.workflow.updated_at,
    target_date: status.workflow.target_date ?? null,
    archived_at: archivedAt,
    archive_reason: status.workflow.archive_reason,
    resolution: status.workflow.resolution,
  };
  status.taxonomy.surfaces = status.taxonomy.surfaces.map((surface) =>
    surface === `.plans/active/${slug}` || surface === `.plans/backlog/${slug}` || surface === `.plans/ideas/${slug}`
      ? `.plans/archive/${slug}`
      : surface,
  );
  status.lanes = Object.fromEntries(
    Object.entries(status.lanes).map(([laneName, lane]) => [
      laneName,
      {
        owner: lane.owner,
        status: lane.status,
      },
    ]),
  );
  status.history = [
    archiveEvent || {
      timestamp: archivedAt,
      actor: "human",
      lane: "system",
      status: "archived",
      branch: null,
      note: status.workflow.archive_reason,
    },
  ];
  if (status.linear && typeof status.linear === "object" && !Array.isArray(status.linear)) {
    const compactLinear = Object.fromEntries(
      Object.entries(status.linear).filter(([key, value]) => ARCHIVE_LINEAR_KEYS.has(key) && value !== undefined),
    );
    if (compactLinear.lanes && typeof compactLinear.lanes === "object" && !Array.isArray(compactLinear.lanes)) {
      compactLinear.lanes = Object.fromEntries(
        Object.entries(compactLinear.lanes).map(([laneName, lane]) => [laneName, { issue: lane?.issue ?? null }]),
      );
    }
    status.linear = compactLinear;
  }
  for (const key of Object.keys(status)) {
    if (!ARCHIVE_STATUS_KEYS.has(key)) {
      delete status[key];
    }
  }
  return status;
}

function readFeatureStatus(featureDirPath) {
  const path = statusPathForDir(featureDirPath);
  const status = loadJson(path);
  return { path, status };
}

function withDirectoryLock(lockDir, work, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;

  while (true) {
    try {
      mkdirSync(lockDir);
      break;
    } catch (error) {
      if (error?.code !== "EEXIST") {
        throw error;
      }

      if (Date.now() >= deadline) {
        fail(`Timed out waiting for plan hub lock at ${lockDir}`);
      }

      sleep(100);
    }
  }

  try {
    return work();
  } finally {
    rmSync(lockDir, { recursive: true, force: true });
  }
}

function withFeatureLock(featureDirPath, work, timeoutMs = 5000) {
  return withDirectoryLock(join(featureDirPath, ".status.lock"), work, timeoutMs);
}

function withArchiveLock(work, timeoutMs = 5000) {
  try {
    return withDirectoryLock(join(PLANS_ROOT, "_templates", ".archive.lock"), work, timeoutMs);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

function laneDependenciesMet(status, laneName) {
  const lane = status.lanes[laneName];
  const dependencies = Array.isArray(lane.depends_on) ? lane.depends_on : [];

  return dependencies.every((dependency) => {
    const dependencyLane = status.lanes[dependency];
    return dependencyLane && DONE_LANE_STATUSES.has(dependencyLane.status);
  });
}

function branchExists(branchName) {
  const refs = [
    `refs/heads/${branchName}`,
    `refs/remotes/origin/${branchName}`,
    `refs/remotes/upstream/${branchName}`,
  ];

  for (const ref of refs) {
    try {
      execFileSync("git", ["show-ref", "--verify", "--quiet", ref], { cwd: REPO_ROOT, stdio: "ignore" });
      return true;
    } catch {
      // Keep checking other refs.
    }
  }

  return false;
}

function refreshLaneStatuses(status) {
  const stage = status.feature.stage;
  const activeStage = stage === "active";

  for (const [laneName, lane] of Object.entries(status.lanes)) {
    const currentStatus = lane.status;
    const terminal =
      currentStatus === "in_progress" ||
      currentStatus === "failed" ||
      DONE_LANE_STATUSES.has(currentStatus);

    if (terminal) {
      continue;
    }

    const dependenciesMet = laneDependenciesMet(status, laneName);
    const triggerMet = !lane.branch_trigger || branchExists(lane.branch_trigger);
    const canAutoReady =
      lane.manual_blocked !== true &&
      (lane.ready_when_dependencies_met === true || currentStatus === "todo");

    if (activeStage && dependenciesMet && triggerMet && canAutoReady) {
      lane.status = "ready";
      continue;
    }

    if (!activeStage && currentStatus === "ready") {
      lane.status = "todo";
      continue;
    }

    if (lane.ready_when_dependencies_met === true && currentStatus === "ready" && (!dependenciesMet || !triggerMet)) {
      lane.status = "blocked";
    }
  }

  const lanes = Object.values(status.lanes);
  const allDone = lanes.every((lane) => DONE_LANE_STATUSES.has(lane.status));
  const hasCompletedWork = lanes.some((lane) => lane.status === "passed" || lane.status === "completed");
  if (allDone) {
    if (status.workflow.overall_status === "blocked") {
      return status;
    }
    status.workflow.overall_status = hasCompletedWork ? "done" : STAGE_TO_STATUS[stage];
    return status;
  }

  if (status.workflow.overall_status === "done") {
    status.workflow.overall_status = STAGE_TO_STATUS[stage];
  }

  return status;
}

function featureRecords(stage) {
  const stageDir = planStageDir(stage);
  if (!existsSync(stageDir)) {
    return [];
  }

  return readdirSync(stageDir)
    .map((entry) => join(stageDir, entry))
    .filter((entryPath) => statSync(entryPath).isDirectory())
    .filter((entryPath) => existsSync(statusPathForDir(entryPath)))
    .map((entryPath) => {
      const { status } = readFeatureStatus(entryPath);
      const normalized = refreshLaneStatuses(structuredClone(status));
      return {
        dir: entryPath,
        slug: slugFromPath(entryPath),
        status: normalized,
      };
    });
}

function formalFeatureSlugs() {
  return new Set(STAGES.flatMap((stage) => featureRecords(stage).map((record) => record.status.feature.slug)));
}

function validatePlanRootStructure(failures) {
  if (!existsSync(PLANS_ROOT)) {
    failures.push(`${PLANS_ROOT}: missing plan hub`);
    return;
  }

  for (const entry of readdirSync(PLANS_ROOT)) {
    if (!ALLOWED_PLAN_ROOT_ENTRIES.has(entry)) {
      failures.push(
        `${join(PLANS_ROOT, entry)}: unsupported plan-hub root entry; expected README.md, _templates, or a lifecycle stage`,
      );
    }
  }
}

function validateStageStructure(stage, failures) {
  const stageDir = planStageDir(stage);
  if (!existsSync(stageDir)) {
    return;
  }

  for (const entry of readdirSync(stageDir)) {
    const entryPath = join(stageDir, entry);
    if (stage === "archive") {
      failures.push(
        `${entryPath}: archived hubs must not exist in the working tree; close hubs with move --to archive (ledger + deletion) — git history is the only archive`,
      );
      continue;
    }
    if (!statSync(entryPath).isDirectory()) {
      failures.push(`${entryPath}: unsupported loose file; plan stages contain feature directories only`);
      continue;
    }

    if (!existsSync(statusPathForDir(entryPath))) {
      failures.push(`${entryPath}: missing status.json`);
      continue;
    }
  }
}

function markdownFilesUnder(directory) {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory).flatMap((entry) => {
    const entryPath = join(directory, entry);
    if (entry === "reports") return [];
    const stats = statSync(entryPath);
    if (stats.isDirectory()) {
      return markdownFilesUnder(entryPath);
    }
    return stats.isFile() && entry.endsWith(".md") ? [entryPath] : [];
  });
}

function validateFencedYaml(failures) {
  const yamlFence = /^```ya?ml[^\S\r\n]*\r?\n([\s\S]*?)^```[^\S\r\n]*$/gim;

  for (const markdownPath of markdownFilesUnder(PLANS_ROOT)) {
    const source = readFileSync(markdownPath, "utf8");
    for (const match of source.matchAll(yamlFence)) {
      try {
        yaml.load(match[1]);
      } catch (error) {
        const fenceLine = source.slice(0, match.index).split(/\r?\n/).length;
        const yamlLine = Number.isInteger(error?.mark?.line) ? error.mark.line : 0;
        const line = fenceLine + yamlLine + 1;
        const reason = error?.reason || error?.message || String(error);
        failures.push(`${markdownPath}:${line}: invalid fenced YAML: ${reason}`);
      }
    }
  }
}

function valuesForFlag(flags, key) {
  if (!Object.hasOwn(flags, key)) {
    return [];
  }

  return Array.isArray(flags[key]) ? flags[key] : [flags[key]];
}

function normalizedLinearIssue(value) {
  return hasText(value) ? value.trim() : null;
}

function canonicalLinearParentIssue(linear) {
  return normalizedLinearIssue(linear?.parentIssue) || normalizedLinearIssue(linear?.issue);
}

function linearLaneIssue(linear, laneName) {
  return normalizedLinearIssue(linear?.lanes?.[laneName]?.issue);
}

function linearLaneSyncMode(linear) {
  return linear?.laneSyncMode || DEFAULT_LINEAR_LANE_SYNC_MODE;
}

function normalizeLinearLaneSyncMode(value) {
  if (value === undefined || value === null || value === false) {
    return null;
  }

  if (typeof value !== "string" || !LINEAR_LANE_SYNC_MODES.has(value)) {
    fail(`Invalid linear lane sync mode "${value}". Expected one of: ${Array.from(LINEAR_LANE_SYNC_MODES).join(", ")}`);
  }

  return value;
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter((value) => hasText(value)))).sort();
}

function packageLabelsForTracks(tracks, laneName = null) {
  if (!Array.isArray(tracks)) {
    return [];
  }

  const lanePriorities = LANE_PACKAGE_TRACK_PRIORITIES[laneName] || [];
  for (const track of lanePriorities) {
    if (tracks.includes(track)) {
      const label = TRACK_TO_PACKAGE_LABEL[track];
      if (hasText(label)) {
        return [label];
      }
    }
  }

  for (const track of tracks) {
    const label = TRACK_TO_PACKAGE_LABEL[track];
    if (hasText(label)) {
      return [label];
    }
  }

  return [];
}

function isResearchOnly(status) {
  const workTypes = status.taxonomy?.work_types;
  return (
    Array.isArray(workTypes) &&
    workTypes.length > 0 &&
    workTypes.every((workType) => workType === "research")
  );
}

function linearLabelsForStatus(status, activityLabel, laneName = null) {
  // package:* is a code-surface tag; omit it on research-only plans (Research team) —
  // they describe a research question, not work inside a code package.
  const packageLabels = isResearchOnly(status)
    ? []
    : packageLabelsForTracks(status.taxonomy?.tracks, laneName);
  return uniqueSorted([...LINEAR_BASE_LABELS, activityLabel, ...packageLabels]);
}

function linearLabelsForExecutionSubLane(status, laneName, lane) {
  const packageLabel = isResearchOnly(status) ? null : EXECUTION_SUB_LANE_PACKAGE_LABELS[laneName];
  const agentLabel = lane.status === "ready" && (lane.owner === "codex" || lane.owner === "claude")
    ? `ai:${lane.owner}`
    : null;
  return uniqueSorted([...LINEAR_BASE_LABELS, "activity:build", packageLabel, agentLabel]);
}

function linearLabelsForCanonicalLane(status, activityLabel, laneName, lane) {
  const agentLabel = lane.status === "ready" && (lane.owner === "codex" || lane.owner === "claude")
    ? `ai:${lane.owner}`
    : null;
  return uniqueSorted([...linearLabelsForStatus(status, activityLabel, laneName), agentLabel]);
}

function linearPriorityForStatus(status) {
  switch (status.workflow.priority) {
    case "p0":
      return 1;
    case "p1":
      return 2;
    case "p3":
      return 4;
    case "p2":
    default:
      return 3;
  }
}

function linearTeamForStatus(status) {
  return isResearchOnly(status) ? "Research" : "Product";
}

function linearStateForStage(stage) {
  return stage === "active" ? "Todo" : "Backlog";
}

function activeImplementationIsTerminal(status) {
  if (status.feature.stage !== "active") return false;
  const implementation = [...IMPLEMENTATION_LANES]
    .map((laneName) => status.lanes?.[laneName])
    .filter((lane) => lane && lane.status !== "n/a" && lane.status !== "skipped");
  return (
    implementation.length > 0 &&
    implementation.every((lane) => PROOF_TERMINAL_STATUSES.has(lane.status))
  );
}

function linearStateForLane(status, lane) {
  if (lane.status === "in_progress") {
    return "In Progress";
  }
  if (status.feature.stage === "active" && PROOF_TERMINAL_STATUSES.has(lane.status)) {
    return "In Review";
  }

  return linearStateForStage(status.feature.stage);
}

function linearStateForParent(status) {
  if (Object.values(status.lanes || {}).some((lane) => lane?.status === "in_progress")) {
    return "In Progress";
  }
  if (activeImplementationIsTerminal(status)) return "In Review";

  return linearStateForStage(status.feature.stage);
}

function planRelativeDir(status) {
  return `.plans/${status.feature.stage}/${status.feature.slug}/`;
}

function linearProjectForStatus(status, warnings) {
  const project = normalizedLinearIssue(status.linear?.project);
  if (project) {
    const legacyOnly = !normalizedLinearIssue(status.linear?.parentIssue) && normalizedLinearIssue(status.linear?.issue);
    if (legacyOnly) {
      warnings.push("Legacy linear.project ignored until canonical linear.parentIssue/project metadata is recorded.");
      return null;
    }

    return project;
  }

  warnings.push("No explicit linear.project; manifest leaves issues unprojected.");
  return null;
}

// Mirror bodies are read cold by teammates in Linear, so they are plain
// sentences, never a stack of `Key: value` lane metadata.
//
// Owner and blocked-ness still have to be said, because nothing else carries
// them: the manifest emits no assignee or delegate, and `linearStateForLane`
// maps everything except `in_progress` to the stage default, so a blocked,
// human-owned lane would otherwise render as an unassigned Todo that looks
// ready to pick up. Say it in a sentence rather than an `Owner/status:` line.
// Shape and caps: `.claude/context/linear-routing-rules.md`.
function laneOwnershipSentence(lane) {
  const parts = [];
  if (lane.status === "blocked") {
    // The schema requires blocked_reason on synced blocked lanes, and the
    // mirror is read cold — "blocked" without the why sends the reader
    // hunting. Fall back to pointing at the handoff for legacy hubs.
    const reason = hasText(lane.blocked_reason) ? lane.blocked_reason.trim() : null;
    parts.push(
      reason
        ? `This lane is blocked: ${reason}${/[.!?]$/.test(reason) ? "" : "."}`
        : "This lane is blocked; the handoff records what it is waiting on.",
    );
  }
  if (lane.owner === "human") {
    parts.push("A person owns it, not an agent.");
  } else if (lane.owner) {
    parts.push(`${lane.owner === "claude" ? "Claude" : lane.owner === "codex" ? "Codex" : lane.owner} owns it.`);
  }
  return parts.join(" ");
}
function buildLinearParentDescription(status, laneSyncMode = DEFAULT_LINEAR_LANE_SYNC_MODE) {
  const source = planRelativeDir(status);
  // Describe only what this record actually carries. The parent gets state and
  // priority; milestone, due date, and blocker relations are emitted on lane
  // records, and in parent_only mode those records do not exist at all — so a
  // blanket "dates and dependencies live on this issue" would send a reader to
  // a surface that does not have them. The parent's Linear state is
  // stage-derived (`linearStateForParent` never reads
  // `workflow.overall_status`), so the body must not claim this issue carries
  // the overall status either — the hub owns it.
  const whereTheRestLives = laneSyncMode === "parent_only"
    ? "Lanes are not mirrored as child issues, so lane progress, dates, and dependencies live in the hub too."
    : "Each lane's dates and dependencies sit on its own child issue.";

  return [
    `Tracker for the ${status.feature.title} plan, mirrored into Linear for visibility. ` +
      "The plan hub owns the overall status, scope, lane detail, and handoffs. " +
      whereTheRestLives,
    "",
    `Plan hub: \`${source}\``,
  ].join("\n");
}

// `lane.handoff` is stored plan-relative (`handoffs/codex-ui.md`), so the plan
// directory has to be prefixed here. Emitting the bare value would leave a
// Linear-dispatched agent unable to tell which of the many plan hubs owns the
// handoff — the old body only got away with it because it carried a separate
// `Source plan:` line.
function buildLinearLaneDescription(status, lane) {
  const source = planRelativeDir(status);
  const ownership = laneOwnershipSentence(lane);
  return [
    ["The scope, acceptance criteria, and validation for this lane live in its handoff.", ownership]
      .filter(Boolean)
      .join(" "),
    "",
    `Handoff: \`${source}${lane.handoff}\``,
  ].join("\n");
}

function buildLinearExecutionSubLaneDescription(status, lane) {
  const source = planRelativeDir(status);
  const ownership = laneOwnershipSentence(lane);
  return [
    ["The scope, acceptance criteria, and validation for this lane live in its handoff.", ownership]
      .filter(Boolean)
      .join(" "),
    "",
    `Handoff: \`${source}${lane.handoff}\``,
  ].join("\n");
}

// A plain, human lane title: the work it covers, never the lane slug.
function linearLaneTitle(status, laneName) {
  const phrase = LANE_TITLE_PHRASES[laneName];
  return phrase
    ? `${phrase} ${status.feature.title}`
    : `${titleFromSlug(laneName)} for ${status.feature.title}`;
}

function buildLinearSchedule(status, laneLinear) {
  const milestoneKey = hasText(laneLinear?.milestone) ? laneLinear.milestone.trim() : null;
  return {
    milestone: milestoneKey
      ? {
          key: milestoneKey,
          targetDate: status.linear?.milestones?.[milestoneKey] ?? null,
        }
      : null,
    dueDate: hasText(laneLinear?.dueDate) ? laneLinear.dueDate.trim() : null,
  };
}

function executionSubLanesForLinear(status) {
  const subLanes = status.execution_sub_lanes;
  if (!subLanes || typeof subLanes !== "object" || Array.isArray(subLanes)) {
    return [];
  }

  return Object.entries(subLanes).filter(([, lane]) => lane?.linear?.sync === true);
}

// Resolve a lane's depends_on (execution sub-lane names, or the qa_pass_* canonical
// lane names) to the Linear issue identifiers that should be set as `blockedBy`
// relations. Machine-lane aggregate names (e.g. "ui") are intentionally NOT expanded
// here: they map to several sub-lanes and would over-constrain the QA gate, so
// qa_pass_1's leaf blockers stay a curated manual set. Emitted in the sync manifest as
// `blockedByIssues` so an applier keeps the live Linear dependency graph in step with
// status.json depends_on as lanes are added or re-pointed.
function resolveBlockedByIssues(status, dependsOn) {
  if (!Array.isArray(dependsOn) || dependsOn.length === 0) {
    return [];
  }
  const subLanes =
    status.execution_sub_lanes &&
    typeof status.execution_sub_lanes === "object" &&
    !Array.isArray(status.execution_sub_lanes)
      ? status.execution_sub_lanes
      : {};
  const canonicalLanes =
    status.linear?.lanes && typeof status.linear.lanes === "object" ? status.linear.lanes : {};
  const issues = [];
  const seen = new Set();
  for (const dependency of dependsOn) {
    const issue =
      normalizedLinearIssue(subLanes[dependency]?.linear?.issue) ||
      normalizedLinearIssue(canonicalLanes[dependency]?.issue);
    if (issue && !seen.has(issue)) {
      seen.add(issue);
      issues.push(issue);
    }
  }
  return issues;
}

function buildExecutionSubLaneLinearRecord(status, laneName, lane, project, team, priority) {
  const linear = lane.linear;
  const issue = normalizedLinearIssue(linear.issue);
  const parentIssue = normalizedLinearIssue(linear.parentIssue);
  return {
    lane: laneName,
    machineLane: lane.machine_lane ?? null,
    action: issue ? "update" : "create",
    issue,
    parentId: parentIssue,
    parentRef: parentIssue ? null : null,
    title: linearLaneTitle(status, laneName),
    team,
    state: linearStateForLane(status, lane),
    priority,
    labels: linearLabelsForExecutionSubLane(status, laneName, lane),
    project,
    description: buildLinearExecutionSubLaneDescription(status, lane),
    handoff: lane.handoff,
    dependsOn: Array.isArray(lane.depends_on) ? lane.depends_on : [],
    blockedByIssues: resolveBlockedByIssues(status, lane.depends_on),
    ...buildLinearSchedule(status, linear),
  };
}

function linearLaneIsActionable(status, laneName) {
  if (status.feature.stage !== "active") {
    return false;
  }

  const lane = status.lanes[laneName];
  if (!lane || LINEAR_LANE_SKIP_STATUSES.has(lane.status)) {
    if (
      lane &&
      IMPLEMENTATION_LANES.has(laneName) &&
      PROOF_TERMINAL_STATUSES.has(lane.status)
    ) {
      return Boolean(linearLaneIssue(status.linear, laneName));
    }
    return false;
  }

  if (IMPLEMENTATION_LANES.has(laneName)) {
    return true;
  }

  if (laneName === "qa_pass_1" || laneName === "qa_pass_2") {
    return lane.manual_blocked === true || laneDependenciesMet(status, laneName);
  }

  return false;
}

function buildLinearSyncManifest(status) {
  const normalized = refreshLaneStatuses(structuredClone(status));
  const warnings = [];
  const linear = normalized.linear || {};
  const laneSyncMode = linearLaneSyncMode(linear);
  const parentIssue = canonicalLinearParentIssue(linear);
  const project = linearProjectForStatus(normalized, warnings);
  const team = linearTeamForStatus(normalized);
  const priority = linearPriorityForStatus(normalized);

  if (!normalizedLinearIssue(linear.parentIssue) && normalizedLinearIssue(linear.issue)) {
    warnings.push("Using legacy linear.issue as parent issue; run record-linear to persist linear.parentIssue.");
  }

  if (!parentIssue) {
    warnings.push("Plan is missing Linear parent issue.");
  }

  const parent = {
    action: parentIssue ? "update" : "create",
    issue: parentIssue,
    title: `${normalized.feature.title} roadmap`,
    team,
    state: linearStateForParent(normalized),
    priority,
    labels: linearLabelsForStatus(normalized, LINEAR_PARENT_ACTIVITY_LABEL),
    project,
    description: buildLinearParentDescription(normalized, laneSyncMode),
  };

  const executionSubLanes = executionSubLanesForLinear(normalized);
  const canonicalLaneNames = executionSubLanes.length > 0
    ? ["qa_pass_1", "qa_pass_2"]
    : CANONICAL_LANES;
  const canonicalLanes = laneSyncMode === "parent_only"
    ? []
    : canonicalLaneNames
      .filter((laneName) =>
        linearLaneIsActionable(normalized, laneName) ||
        (executionSubLanes.length > 0 && normalizedLinearIssue(linear?.lanes?.[laneName]?.issue)))
      .map((laneName) => {
        const lane = normalized.lanes[laneName];
        const issue = linearLaneIssue(linear, laneName);
        if (!issue) {
          warnings.push(`Plan is missing Linear issue for lane ${laneName}.`);
        }

        return {
          lane: laneName,
          action: issue ? "update" : "create",
          issue,
          parentId: parentIssue,
          parentRef: "parent",
          title: linearLaneTitle(normalized, laneName),
          team,
          state: linearStateForLane(normalized, lane),
          priority,
          labels: linearLabelsForCanonicalLane(
            normalized,
            laneName === "qa_pass_1" || laneName === "qa_pass_2" ? "activity:qa" : "activity:build",
            laneName,
            lane,
          ),
          project,
          description: buildLinearLaneDescription(normalized, lane),
          handoff: lane.handoff,
          dependsOn: Array.isArray(lane.depends_on) ? lane.depends_on : [],
          blockedByIssues: resolveBlockedByIssues(normalized, lane.depends_on),
          ...buildLinearSchedule(normalized, linear?.lanes?.[laneName]),
        };
      });
  const executionLanes = laneSyncMode === "parent_only"
    ? []
    : executionSubLanes.map(([laneName, lane]) =>
      buildExecutionSubLaneLinearRecord(normalized, laneName, lane, project, team, priority));
  const lanes = [...executionLanes, ...canonicalLanes];

  return {
    version: 1,
    syncDirection: LINEAR_SYNC_DIRECTION,
    feature: {
      slug: normalized.feature.slug,
      title: normalized.feature.title,
      stage: normalized.feature.stage,
      path: planRelativeDir(normalized),
    },
    routing: {
      team,
      project,
      initiative: normalizedLinearIssue(linear.initiative),
    },
    schedule: {
      milestones: linear.milestones || {},
      operationalCheckpoints: linear.operationalCheckpoints || {},
    },
    laneSyncMode,
    parent,
    lanes,
    warnings,
  };
}

function isDateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validateLinearDateMap(value, path, errors) {
  if (value === undefined || value === null) {
    return;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${path} must be an object when present`);
    return;
  }

  for (const [key, date] of Object.entries(value)) {
    if (!EXECUTION_SUB_LANE_NAME.test(key)) {
      errors.push(`${path} has invalid key "${key}"`);
    }
    if (!isDateOnly(date)) {
      errors.push(`${path}.${key} must be a YYYY-MM-DD date`);
    }
  }
}

function validateLinearSchedule(status, laneLinear, path, errors) {
  if (laneLinear.milestone !== undefined && laneLinear.milestone !== null) {
    if (!hasText(laneLinear.milestone)) {
      errors.push(`${path}.milestone must be a string or null`);
    } else if (!Object.hasOwn(status.linear?.milestones || {}, laneLinear.milestone)) {
      errors.push(`${path}.milestone must reference linear.milestones.${laneLinear.milestone}`);
    }
  }

  if (laneLinear.dueDate !== undefined && laneLinear.dueDate !== null && !isDateOnly(laneLinear.dueDate)) {
    errors.push(`${path}.dueDate must be a YYYY-MM-DD date or null`);
  }
}

function validateLinear(status, errors) {
  const linear = status.linear;
  if (linear === undefined) {
    return;
  }

  if (!linear || typeof linear !== "object" || Array.isArray(linear)) {
    errors.push("linear must be an object when present");
    return;
  }

  if (
    linear.syncDirection !== undefined &&
    linear.syncDirection !== null &&
    linear.syncDirection !== LINEAR_SYNC_DIRECTION
  ) {
    errors.push(`linear.syncDirection must be "${LINEAR_SYNC_DIRECTION}"`);
  }

  if (
    linear.laneSyncMode !== undefined &&
    linear.laneSyncMode !== null &&
    !LINEAR_LANE_SYNC_MODES.has(linear.laneSyncMode)
  ) {
    errors.push(`linear.laneSyncMode must be one of ${Array.from(LINEAR_LANE_SYNC_MODES).join(", ")}`);
  }

  for (const field of ["issue", "parentIssue", "project", "initiative", "lastSyncedAt"]) {
    if (linear[field] !== undefined && linear[field] !== null && typeof linear[field] !== "string") {
      errors.push(`linear.${field} must be a string or null`);
    }
  }

  validateLinearDateMap(linear.milestones, "linear.milestones", errors);
  validateLinearDateMap(linear.operationalCheckpoints, "linear.operationalCheckpoints", errors);

  if (linear.lanes === undefined || linear.lanes === null) {
    return;
  }

  if (typeof linear.lanes !== "object" || Array.isArray(linear.lanes)) {
    errors.push("linear.lanes must be an object when present");
    return;
  }

  for (const [laneName, laneLinear] of Object.entries(linear.lanes)) {
    if (!CANONICAL_LANES.includes(laneName)) {
      errors.push(`linear.lanes has unknown lane "${laneName}"`);
      continue;
    }

    if (!laneLinear || typeof laneLinear !== "object" || Array.isArray(laneLinear)) {
      errors.push(`linear.lanes.${laneName} must be an object`);
      continue;
    }

    const extraLaneLinearKeys = Object.keys(laneLinear).filter(
      (key) => !["issue", "milestone", "dueDate"].includes(key),
    );
    if (extraLaneLinearKeys.length > 0) {
      errors.push(`linear.lanes.${laneName} has unsupported fields: ${extraLaneLinearKeys.join(", ")}`);
    }

    if (laneLinear.issue !== undefined && laneLinear.issue !== null && typeof laneLinear.issue !== "string") {
      errors.push(`linear.lanes.${laneName}.issue must be a string or null`);
    }
    validateLinearSchedule(status, laneLinear, `linear.lanes.${laneName}`, errors);
  }
}

function validateExecutionSubLanes(status, featureDirPath, stage, errors) {
  const subLanes = status.execution_sub_lanes;
  if (subLanes === undefined || subLanes === null) {
    return;
  }

  if (typeof subLanes !== "object" || Array.isArray(subLanes)) {
    errors.push("execution_sub_lanes must be an object when present");
    return;
  }

  const names = new Set(Object.keys(subLanes));
  const canonicalParent = canonicalLinearParentIssue(status.linear || {});
  const issueOwners = new Map();
  for (const [laneName, laneLinear] of Object.entries(status.linear?.lanes || {})) {
    const issue = normalizedLinearIssue(laneLinear?.issue);
    if (issue) {
      const previousOwner = issueOwners.get(issue);
      if (previousOwner) {
        errors.push(`linear.lanes.${laneName}.issue duplicates ${issue} already used by ${previousOwner}`);
      } else {
        issueOwners.set(issue, `linear.lanes.${laneName}`);
      }
    }
  }
  for (const [laneName, lane] of Object.entries(subLanes)) {
    if (!EXECUTION_SUB_LANE_NAME.test(laneName)) {
      errors.push(`execution_sub_lanes has invalid name "${laneName}"`);
    }
    if (!lane || typeof lane !== "object" || Array.isArray(lane)) {
      errors.push(`execution_sub_lanes.${laneName} must be an object`);
      continue;
    }
    if (lane.machine_lane !== null && !CANONICAL_LANES.includes(lane.machine_lane)) {
      errors.push(`execution_sub_lanes.${laneName}.machine_lane must reference a canonical machine lane or null`);
    }
    if (!EXECUTION_SUB_LANE_OWNERS.has(lane.owner)) {
      errors.push(`execution_sub_lanes.${laneName}.owner must be codex, claude, or human`);
    }
    if (!VALID_LANE_STATUSES.has(lane.status)) {
      errors.push(`execution_sub_lanes.${laneName}.status is invalid`);
    }
    if (status.version >= 2 && lane.branch !== null && lane.branch !== undefined) {
      if (!hasText(lane.branch)) {
        errors.push(`execution_sub_lanes.${laneName}.branch must be a string or null`);
      } else if (!isWorkBranchName(lane.branch)) {
        errors.push(`execution_sub_lanes.${laneName}.branch must use <type>/<work-description>`);
      }
    }
    if (lane.linear && lane.status === "ready" && lane.owner === "human") {
      errors.push(`execution_sub_lanes.${laneName} cannot be ready with a human owner`);
    }
    if (lane.linear && lane.status === "blocked" && !hasText(lane.blocked_reason)) {
      errors.push(`execution_sub_lanes.${laneName}.blocked_reason is required for blocked status`);
    }
    if (lane.depends_on === undefined && lane.linear) {
      errors.push(`execution_sub_lanes.${laneName}.depends_on must be an array of lane names`);
    } else if (
      lane.depends_on !== undefined &&
      (!Array.isArray(lane.depends_on) || lane.depends_on.some((dependency) => !hasText(dependency)))
    ) {
      errors.push(`execution_sub_lanes.${laneName}.depends_on must be an array of lane names`);
    } else if (Array.isArray(lane.depends_on)) {
      const unknownDependencies = lane.depends_on.filter(
        (dependency) => !names.has(dependency) && !CANONICAL_LANES.includes(dependency),
      );
      if (unknownDependencies.length > 0) {
        errors.push(
          `execution_sub_lanes.${laneName}.depends_on references unknown lanes: ${unknownDependencies.join(", ")}`,
        );
      }
    }
    if (lane.handoff !== null && lane.handoff !== undefined && !hasText(lane.handoff)) {
      errors.push(`execution_sub_lanes.${laneName}.handoff must be a path or null`);
    } else if (
      hasText(lane.handoff) &&
      stage === "active" &&
      !existsSync(join(featureDirPath, lane.handoff))
    ) {
      errors.push(`execution_sub_lanes.${laneName} handoff file is missing: ${lane.handoff}`);
    }

    if (
      lane.linear_issues !== undefined &&
      (!Array.isArray(lane.linear_issues) || lane.linear_issues.some((issue) => !hasText(issue)))
    ) {
      errors.push(`execution_sub_lanes.${laneName}.linear_issues must be an array of issue identifiers`);
    }

    if (lane.linear === undefined || lane.linear === null) {
      continue;
    }
    if (typeof lane.linear !== "object" || Array.isArray(lane.linear)) {
      errors.push(`execution_sub_lanes.${laneName}.linear must be an object`);
      continue;
    }
    const extraLinearKeys = Object.keys(lane.linear).filter(
      (key) => !["sync", "issue", "parentIssue", "milestone", "dueDate"].includes(key),
    );
    if (extraLinearKeys.length > 0) {
      errors.push(`execution_sub_lanes.${laneName}.linear has unsupported fields: ${extraLinearKeys.join(", ")}`);
    }
    if (typeof lane.linear.sync !== "boolean") {
      errors.push(`execution_sub_lanes.${laneName}.linear.sync must be boolean`);
    }
    for (const field of ["issue", "parentIssue"]) {
      if (!Object.hasOwn(lane.linear, field)) {
        errors.push(`execution_sub_lanes.${laneName}.linear.${field} is required and may be null`);
      } else if (lane.linear[field] !== null && !hasText(lane.linear[field])) {
        errors.push(`execution_sub_lanes.${laneName}.linear.${field} must be a string or null`);
      }
    }
    validateLinearSchedule(status, lane.linear, `execution_sub_lanes.${laneName}.linear`, errors);
    const issue = normalizedLinearIssue(lane.linear.issue);
    const parentIssue = normalizedLinearIssue(lane.linear.parentIssue);
    if (Array.isArray(lane.linear_issues)) {
      const compatibilityIssues = new Set(lane.linear_issues.map(normalizedLinearIssue).filter(Boolean));
      if (issue && !compatibilityIssues.has(issue)) {
        errors.push(`execution_sub_lanes.${laneName}.linear_issues must include linear.issue ${issue}`);
      }
      if (parentIssue && !compatibilityIssues.has(parentIssue)) {
        errors.push(`execution_sub_lanes.${laneName}.linear_issues must include linear.parentIssue ${parentIssue}`);
      }
    }
    if (lane.linear.sync === true && parentIssue) {
      if (!canonicalParent) {
        errors.push(
          `execution_sub_lanes.${laneName}.linear.parentIssue cannot be set without a canonical linear.parentIssue`,
        );
      } else if (parentIssue !== canonicalParent) {
        errors.push(
          `execution_sub_lanes.${laneName}.linear.parentIssue must match canonical parent ${canonicalParent} or be null`,
        );
      }
    }
    if (issue && issue === canonicalParent) {
      errors.push(`execution_sub_lanes.${laneName}.linear.issue cannot reuse the canonical parent issue`);
    }
    if (issue) {
      const previousOwner = issueOwners.get(issue);
      if (previousOwner) {
        errors.push(
          `execution_sub_lanes.${laneName}.linear.issue duplicates ${issue} already used by ${previousOwner}`,
        );
      } else {
        issueOwners.set(issue, `execution_sub_lanes.${laneName}`);
      }
    }
    if (lane.linear.sync === true && !hasText(lane.handoff)) {
      errors.push(`execution_sub_lanes.${laneName}.handoff is required when linear.sync is true`);
    }
  }
}

function historyEntry({ timestamp, actor, lane, status, branch, note }) {
  return {
    timestamp: timestamp || nowIso(),
    actor,
    lane,
    status,
    branch: branch || null,
    note: note || null,
  };
}

function printFeatureList(records, laneName, asJson) {
  const list = records.map((record) => {
    const lane = record.status.lanes[laneName];
    const linearManifest = buildLinearSyncManifest(record.status);
    return {
      slug: record.status.feature.slug,
      title: record.status.feature.title,
      stage: record.status.feature.stage,
      priority: record.status.workflow.priority,
      overall_status: record.status.workflow.overall_status,
      lane: laneName,
      lane_status: lane.status,
      branch: lane.branch,
      branch_trigger: lane.branch_trigger || null,
      handoff: lane.handoff,
      linear_sync_warnings: linearManifest.warnings,
      path: record.dir,
    };
  });

  if (asJson) {
    console.log(JSON.stringify(list, null, 2));
    return;
  }

  if (list.length === 0) {
    console.log("No matching features.");
    return;
  }

  for (const item of list) {
    console.log(
      `${item.slug} | ${item.priority} | ${item.lane_status} | ${item.branch} | linear_warnings:${item.linear_sync_warnings.length} | ${item.path}`,
    );
  }
}

function printFeatureSummary(records, asJson) {
  const list = records.map((record) => ({
    slug: record.status.feature.slug,
    title: record.status.feature.title,
    stage: record.status.feature.stage,
    priority: record.status.workflow.priority,
    overall_status: record.status.workflow.overall_status,
    initiative: record.status.taxonomy.initiative,
    tracks: record.status.taxonomy.tracks,
    work_types: record.status.taxonomy.work_types,
    surfaces: record.status.taxonomy.surfaces,
    depends_on_features: record.status.taxonomy.depends_on_features,
    path: record.dir,
  }));

  if (asJson) {
    console.log(JSON.stringify(list, null, 2));
    return;
  }

  if (list.length === 0) {
    console.log("No matching features.");
    return;
  }

  for (const item of list) {
    console.log(
      `${item.slug} | ${item.stage} | ${item.priority} | ${item.initiative} | ${item.tracks.join(",")} | ${item.overall_status} | ${item.path}`,
    );
  }
}

function priorityWeight(priority) {
  switch (priority) {
    case "p0":
      return 0;
    case "p1":
      return 1;
    case "p2":
      return 2;
    case "p3":
      return 3;
    default:
      return 9;
  }
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

let cachedValidationReceiptDebt;
const matchedValidationReceiptDebt = new Set();
const acceptedValidationReceiptDebt = new Map();

function validationReceiptDebtKey(feature, lane) {
  return `${feature}/${lane}`;
}

function loadValidationReceiptDebt() {
  if (cachedValidationReceiptDebt) {
    return cachedValidationReceiptDebt;
  }

  const state = { entries: new Map(), errors: [] };
  cachedValidationReceiptDebt = state;

  if (!existsSync(VALIDATION_RECEIPT_DEBT_PATH)) {
    state.errors.push("missing Validation Receipt debt baseline");
    return state;
  }

  let document;
  try {
    document = JSON.parse(readFileSync(VALIDATION_RECEIPT_DEBT_PATH, "utf8"));
  } catch (error) {
    state.errors.push(`invalid JSON: ${error.message}`);
    return state;
  }

  if (!document || typeof document !== "object" || Array.isArray(document)) {
    state.errors.push("baseline must be a JSON object");
    return state;
  }

  const extraRootKeys = Object.keys(document).filter((key) => !["version", "entries"].includes(key));
  if (extraRootKeys.length > 0) {
    state.errors.push(`baseline has unsupported fields: ${extraRootKeys.join(", ")}`);
  }
  if (document.version !== 1) {
    state.errors.push('baseline version must be 1');
  }
  if (!Array.isArray(document.entries)) {
    state.errors.push("baseline entries must be an array");
    return state;
  }

  const seenKeys = new Set();
  for (const [index, entry] of document.entries.entries()) {
    const entryPrefix = `entries[${index}]`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      state.errors.push(`${entryPrefix} must be an object`);
      continue;
    }

    const allowedFields = new Set(["feature", "lane", "owner", "expires_at", "burn_down"]);
    const extraFields = Object.keys(entry).filter((key) => !allowedFields.has(key));
    let valid = true;
    if (extraFields.length > 0) {
      state.errors.push(`${entryPrefix} has unsupported fields: ${extraFields.join(", ")}`);
      valid = false;
    }
    if (!hasText(entry.feature) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.feature)) {
      state.errors.push(`${entryPrefix}.feature must be a kebab-case feature slug`);
      valid = false;
    }
    if (!CANONICAL_LANE_SET.has(entry.lane)) {
      state.errors.push(`${entryPrefix}.lane must be a canonical lane`);
      valid = false;
    }
    if (!EXECUTION_SUB_LANE_OWNERS.has(entry.owner)) {
      state.errors.push(`${entryPrefix}.owner must be codex, claude, or human`);
      valid = false;
    }
    if (!hasText(entry.burn_down)) {
      state.errors.push(`${entryPrefix}.burn_down must name the concrete proof needed to remove the debt`);
      valid = false;
    }
    if (
      !hasText(entry.expires_at) ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(entry.expires_at) ||
      !Number.isFinite(Date.parse(entry.expires_at))
    ) {
      state.errors.push(`${entryPrefix}.expires_at must be an ISO-8601 UTC timestamp ending in Z`);
      valid = false;
    }

    if (!valid) {
      continue;
    }

    const key = validationReceiptDebtKey(entry.feature, entry.lane);
    if (seenKeys.has(key)) {
      state.errors.push(`${entryPrefix} duplicates ${key}`);
      state.entries.delete(key);
      continue;
    }
    seenKeys.add(key);
    state.entries.set(key, entry);
  }

  if (state.errors.length > 0) {
    state.entries.clear();
  }

  return state;
}

function resetValidationReceiptDebtObservations() {
  matchedValidationReceiptDebt.clear();
  acceptedValidationReceiptDebt.clear();
}

function applyValidationReceiptDebt(status, laneName, lane, receiptErrors, errors) {
  if (receiptErrors.length === 0) {
    return;
  }

  const key = validationReceiptDebtKey(status.feature.slug, laneName);
  const entry = loadValidationReceiptDebt().entries.get(key);
  if (!entry) {
    errors.push(...receiptErrors);
    return;
  }

  matchedValidationReceiptDebt.add(key);
  if (entry.owner !== lane.owner) {
    errors.push(
      `lane "${laneName}" Validation Receipt debt baseline owner "${entry.owner}" does not match lane owner "${lane.owner}"`,
    );
    return;
  }
  if (Date.parse(entry.expires_at) <= Date.now()) {
    errors.push(
      `lane "${laneName}" Validation Receipt debt baseline expired at ${entry.expires_at}; complete its burn-down before making another terminal claim`,
    );
    return;
  }

  acceptedValidationReceiptDebt.set(key, entry);
}

function proofHasCommandAndEvidence(proof) {
  return proof && hasText(proof.command) && hasText(proof.evidence);
}

function laneRequiresValidationReceipt(status, laneName, lane) {
  if (!PROOF_TERMINAL_STATUSES.has(lane.status)) {
    return false;
  }

  const laneTransitions = Array.isArray(status.history)
    ? status.history.filter(
        (entry) =>
          entry?.lane === laneName &&
          VALID_LANE_STATUSES.has(entry.status) &&
          Number.isFinite(Date.parse(entry.timestamp)),
      )
    : [];
  const latestTransition = [...laneTransitions]
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp))
    .at(-1);
  if (latestTransition) {
    const transitionedAt = Date.parse(latestTransition.timestamp);
    return transitionedAt >= VALIDATION_RECEIPT_POLICY_STARTED_AT;
  }

  const createdAt = Date.parse(status.workflow.created_at);
  return Number.isFinite(createdAt) && createdAt >= VALIDATION_RECEIPT_POLICY_STARTED_AT;
}

function validationReceiptSection(markdown) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s+Validation Receipt\s*$/.test(line));
  if (start < 0) return "";
  const endOffset = lines.slice(start + 1).findIndex((line) => /^#{1,2}\s+/.test(line));
  const end = endOffset < 0 ? lines.length : start + 1 + endOffset;
  return lines.slice(start + 1, end).join("\n");
}

const VALIDATION_RECEIPT_FIELDS = new Map([
  ["tested implementation commit sha", "testedSha"],
  ["run at (utc)", "runAtUtc"],
  ["exact command(s)", "command"],
  ["exact command", "command"],
  ["command", "command"],
  ["result", "result"],
  ["validated paths", "validatedPaths"],
  ["worktree identity command and result", "worktreeIdentity"],
  ["evidence-only diff command and result (if applicable)", "evidenceDiff"],
  ["evidence-only worktree-status command and result (if applicable)", "evidenceWorktree"],
]);

function parseValidationReceipt(section) {
  const fields = {};
  let currentField = null;

  for (const line of section.split(/\r?\n/)) {
    const fieldMatch = line.match(/^\s*-\s+(?:\*\*)?([^:*]+?)(?:\*\*)?:\s*(.*)$/);
    const normalizedLabel = fieldMatch?.[1].trim().toLowerCase();
    const fieldName = normalizedLabel ? VALIDATION_RECEIPT_FIELDS.get(normalizedLabel) : null;
    if (fieldName) {
      currentField = fieldName;
      fields[currentField] = fieldMatch[2].trim();
      continue;
    }
    if (currentField && line.trim()) {
      fields[currentField] = `${fields[currentField]}\n${line.trim()}`.trim();
    }
  }

  return fields;
}

function isReceiptPlaceholder(value) {
  if (!hasText(value)) return true;
  const normalized = value.replaceAll("`", "").trim();
  return /^(?:pending|todo|tbd|unknown|<[^>]+>)$/i.test(normalized);
}

function isNotApplicable(value) {
  return hasText(value) && /^(?:not applicable|n\/a)$/i.test(value.replaceAll("`", "").trim());
}

function hasPathScopedStatusCommand(value) {
  return /git status --porcelain=v1 --untracked-files=all --\s+(?!<)[^`\s][^`\n]*/.test(value);
}

function reportsCleanWorktree(value) {
  return /(?:empty|no output|clean)/i.test(value);
}

function reportsNoDiff(value) {
  return /(?:empty|no output|clean|exit(?:ed)?(?: with)?\s+(?:code\s+)?0|status\s+0)/i.test(value);
}

function validateValidationReceipt(status, featureDirPath, laneName, lane, errors) {
  if (!laneRequiresValidationReceipt(status, laneName, lane)) {
    return;
  }

  const prefix = `lane "${laneName}" Validation Receipt`;
  const receiptErrors = [];
  const finish = () => applyValidationReceiptDebt(status, laneName, lane, receiptErrors, errors);
  if (!hasText(lane.handoff)) {
    receiptErrors.push(`${prefix} requires a handoff path`);
    finish();
    return;
  }

  const handoffPath = join(featureDirPath, lane.handoff);
  if (!existsSync(handoffPath)) {
    receiptErrors.push(`${prefix} handoff file is missing: ${lane.handoff}`);
    finish();
    return;
  }

  const section = validationReceiptSection(readFileSync(handoffPath, "utf8"));
  if (!hasText(section)) {
    receiptErrors.push(`${prefix} is missing from ${lane.handoff}`);
    finish();
    return;
  }

  const receipt = parseValidationReceipt(section);
  const validFields = new Set();
  for (const [fieldName, label] of [
    ["testedSha", "Tested implementation commit SHA"],
    ["runAtUtc", "Run at (UTC)"],
    ["command", "Exact command(s)"],
    ["result", "Result"],
    ["validatedPaths", "Validated paths"],
    ["worktreeIdentity", "Worktree identity command and result"],
  ]) {
    if (isReceiptPlaceholder(receipt[fieldName])) {
      receiptErrors.push(`${prefix} requires a non-placeholder ${label} field`);
    } else {
      validFields.add(fieldName);
    }
  }

  if (validFields.has("command") && !/`[^`\n]+`/.test(receipt.command)) {
    receiptErrors.push(
      `${prefix} Exact command(s) must preserve at least one exact command in code formatting`,
    );
  }

  const testedSha = receipt.testedSha ?? "";
  const hasTestedSha = validFields.has("testedSha") && /\b[0-9a-f]{7,40}\b/i.test(testedSha);
  const hasDirtyTreeLimitation =
    validFields.has("testedSha") &&
    /(?:not commit-attributable|not commit attributable|uncommitted)/i.test(testedSha) &&
    /dirty(?:-tree| tree| worktree| checkout| shared)/i.test(testedSha);
  if (validFields.has("testedSha") && !hasTestedSha && !hasDirtyTreeLimitation) {
    receiptErrors.push(
      `${prefix} requires a tested SHA or an explicit non-commit dirty-tree limitation`,
    );
  }

  const runAtUtc = (receipt.runAtUtc ?? "").replaceAll("`", "").trim();
  if (
    validFields.has("runAtUtc") &&
    (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(runAtUtc) ||
      !Number.isFinite(Date.parse(runAtUtc)))
  ) {
    receiptErrors.push(`${prefix} Run at (UTC) must be an ISO-8601 UTC timestamp ending in Z`);
  }

  const worktreeIdentity = receipt.worktreeIdentity ?? "";
  if (validFields.has("worktreeIdentity") && !hasPathScopedStatusCommand(worktreeIdentity)) {
    receiptErrors.push(
      `${prefix} worktree evidence must use git status --porcelain=v1 --untracked-files=all -- <validated paths>`,
    );
  } else if (
    validFields.has("worktreeIdentity") &&
    hasTestedSha &&
    !reportsCleanWorktree(worktreeIdentity)
  ) {
    receiptErrors.push(`${prefix} commit-attributed worktree evidence must report a clean/empty result`);
  } else if (
    validFields.has("worktreeIdentity") &&
    hasDirtyTreeLimitation &&
    !/dirty|(?:^|\n)[ MADRCU?!]{1,2}\s+\S+/im.test(worktreeIdentity)
  ) {
    receiptErrors.push(`${prefix} dirty-tree limitation must summarize the path-scoped dirty result`);
  }

  if (hasText(receipt.evidenceDiff) && !isNotApplicable(receipt.evidenceDiff)) {
    if (!/git diff --exit-code\s+\S+\.\.HEAD\s+--\s+(?!<)[^`\s][^`\n]*/.test(receipt.evidenceDiff)) {
      receiptErrors.push(
        `${prefix} evidence-only diff must use git diff --exit-code <tested>..HEAD -- <validated paths>`,
      );
    }
    if (!reportsNoDiff(receipt.evidenceDiff)) {
      receiptErrors.push(`${prefix} evidence-only diff must report no validated-path changes`);
    }
    if (
      isNotApplicable(receipt.evidenceWorktree) ||
      !hasPathScopedStatusCommand(receipt.evidenceWorktree ?? "") ||
      !reportsCleanWorktree(receipt.evidenceWorktree ?? "")
    ) {
      receiptErrors.push(`${prefix} evidence-only reuse requires clean path-scoped worktree-status evidence`);
    }
  }

  finish();
}

function validateRequiredTdd(laneName, lane, errors) {
  const tdd = lane.tdd;

  if (tdd.status === "red_recorded" && !proofHasCommandAndEvidence(tdd.red)) {
    errors.push(`lane "${laneName}" TDD status red_recorded requires RED command and evidence`);
  }

  if (tdd.status === "green_recorded") {
    if (!proofHasCommandAndEvidence(tdd.red)) {
      errors.push(`lane "${laneName}" TDD status green_recorded requires RED command and evidence`);
    }
    if (!proofHasCommandAndEvidence(tdd.green)) {
      errors.push(`lane "${laneName}" TDD status green_recorded requires GREEN command and evidence`);
    }
  }

  if (PROOF_TERMINAL_STATUSES.has(lane.status) && tdd.status !== "green_recorded") {
    errors.push(`lane "${laneName}" TDD required lane cannot be ${lane.status} without green_recorded RED/GREEN evidence`);
  }
}

function validateLegacyTdd(status, laneName, lane, stage, errors) {
  const createdAt = Date.parse(status.workflow.created_at);

  if (stage !== "active") {
    errors.push(`lane "${laneName}" legacy_unrecorded TDD mode is only allowed on active hubs`);
  }

  if (!PROOF_TERMINAL_STATUSES.has(lane.status)) {
    errors.push(`lane "${laneName}" legacy_unrecorded TDD mode is only allowed for completed pre-policy work`);
  }

  if (!Number.isFinite(createdAt) || createdAt >= TDD_POLICY_STARTED_AT) {
    errors.push(`lane "${laneName}" legacy_unrecorded TDD mode is only allowed for pre-policy active work`);
  }

  if (!hasText(lane.tdd.note)) {
    errors.push(`lane "${laneName}" legacy_unrecorded TDD mode requires a note`);
  }
}

function requiresHandoffFile(status) {
  const createdAt = Date.parse(status.workflow.created_at);

  return Number.isFinite(createdAt) && createdAt >= HANDOFF_FILE_POLICY_STARTED_AT;
}

function validateLaneTdd(status, laneName, lane, stage, errors) {
  if (!IMPLEMENTATION_LANES.has(laneName)) {
    return;
  }

  if (!lane.tdd) {
    if (stage === "active") {
      errors.push(`lane "${laneName}" is missing TDD proof metadata`);
    }
    return;
  }

  const tdd = lane.tdd;
  if (!VALID_TDD_MODES.has(tdd.mode)) {
    errors.push(`lane "${laneName}" has invalid TDD mode "${tdd.mode}"`);
  }
  if (!VALID_TDD_STATUSES.has(tdd.status)) {
    errors.push(`lane "${laneName}" has invalid TDD status "${tdd.status}"`);
  }

  if (!tdd.red || typeof tdd.red !== "object") {
    errors.push(`lane "${laneName}" TDD red proof must be an object`);
  }
  if (!tdd.green || typeof tdd.green !== "object") {
    errors.push(`lane "${laneName}" TDD green proof must be an object`);
  }
  if (typeof tdd.note !== "string") {
    errors.push(`lane "${laneName}" TDD note must be a string`);
  }

  switch (tdd.mode) {
    case "required":
      validateRequiredTdd(laneName, lane, errors);
      break;
    case "not_applicable":
      if (!hasText(tdd.note)) {
        errors.push(`lane "${laneName}" TDD mode not_applicable requires a note`);
      }
      break;
    case "proof_limit":
      if (!hasText(tdd.note)) {
        errors.push(`lane "${laneName}" TDD mode proof_limit requires a note`);
      }
      if (!proofHasCommandAndEvidence(tdd.green)) {
        errors.push(`lane "${laneName}" TDD mode proof_limit requires fallback validation command and evidence`);
      }
      break;
    case "legacy_unrecorded":
      validateLegacyTdd(status, laneName, lane, stage, errors);
      break;
  }
}

function arrayOfStrings(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validateTaxonomy(status, knownSlugs, errors) {
  const taxonomy = status.taxonomy;
  if (!taxonomy || typeof taxonomy !== "object" || Array.isArray(taxonomy)) {
    errors.push("taxonomy is required");
    return;
  }

  if (!VALID_TAXONOMY_INITIATIVES.has(taxonomy.initiative)) {
    errors.push(
      `taxonomy.initiative must be one of ${Array.from(VALID_TAXONOMY_INITIATIVES).join(", ")}`,
    );
  }

  for (const [field, validValues] of [
    ["tracks", VALID_TAXONOMY_TRACKS],
    ["work_types", VALID_TAXONOMY_WORK_TYPES],
  ]) {
    if (!arrayOfStrings(taxonomy[field])) {
      errors.push(`taxonomy.${field} must be an array of strings`);
      continue;
    }

    const invalid = taxonomy[field].filter((value) => !validValues.has(value));
    if (invalid.length > 0) {
      errors.push(`taxonomy.${field} has invalid values: ${invalid.join(", ")}`);
    }
  }

  if (!arrayOfStrings(taxonomy.surfaces)) {
    errors.push("taxonomy.surfaces must be an array of repo-relative paths");
  } else {
    const invalidSurfaces = taxonomy.surfaces.filter(
      (surface) => surface.trim().length === 0 || surface.startsWith("/") || surface.includes(".."),
    );
    if (invalidSurfaces.length > 0) {
      errors.push(`taxonomy.surfaces has invalid repo-relative paths: ${invalidSurfaces.join(", ")}`);
    }
  }

  if (!arrayOfStrings(taxonomy.depends_on_features)) {
    errors.push("taxonomy.depends_on_features must be an array of feature slugs");
    return;
  }

  const missingDependencies = taxonomy.depends_on_features.filter((slug) => !knownSlugs.has(slug));
  if (missingDependencies.length > 0) {
    errors.push(`taxonomy.depends_on_features references unknown feature slugs: ${missingDependencies.join(", ")}`);
  }
}

function validateFeatureStatus(status, featureDirPath, stage, knownSlugs = formalFeatureSlugs()) {
  const errors = [];
  const slug = slugFromPath(featureDirPath);

  if (status.feature.slug !== slug) {
    errors.push(`feature.slug must match folder name (${slug})`);
  }

  if (status.feature.stage !== stage) {
    errors.push(`feature.stage must match parent directory (${stage})`);
  }

  if (!VALID_PRIORITIES.has(status.workflow.priority)) {
    errors.push(`workflow.priority must be one of ${Array.from(VALID_PRIORITIES).join(", ")}`);
  }

  if (!status.links || typeof status.links !== "object" || Array.isArray(status.links)) {
    errors.push("links is required");
  } else {
    for (const role of REQUIRED_LINK_ROLES) {
      if (typeof status.links[role] !== "string" || status.links[role].length === 0) {
        errors.push(`links.${role} is required`);
      }
    }

    if (stage === "archive") {
      const nestedCanonicalLinks = REQUIRED_LINK_ROLES.filter((role) => {
        const link = status.links[role];
        return typeof link === "string" && (link.includes("/") || link.includes("\\"));
      });
      if (nestedCanonicalLinks.length > 0) {
        errors.push(
          `archive canonical links must reference top-level files: ${nestedCanonicalLinks.join(", ")}`,
        );
      }
      const nestedLinks = Object.values(status.links).filter(
        (link) =>
          typeof link === "string" &&
          (link.includes("/") || link.includes("\\")) &&
          !isConfinedReportLink(link),
      );
      if (nestedLinks.length > 0) {
        errors.push(
          `archive links must reference top-level files or confined reports/ paths: ${nestedLinks.join(", ")}`,
        );
      }
    }
  }

  if (stage === "archive") {
    if (status.workflow.overall_status !== "done") {
      errors.push('archive workflow.overall_status must be "done"');
    }
    if (!hasText(status.workflow.archived_at) || Number.isNaN(Date.parse(status.workflow.archived_at))) {
      errors.push("archive workflow.archived_at must be an ISO date");
    }
    if (!hasText(status.workflow.archive_reason)) {
      errors.push("archive workflow.archive_reason is required");
    }
    if (!VALID_ARCHIVE_RESOLUTIONS.has(status.workflow.resolution)) {
      errors.push(
        `archive workflow.resolution must be one of ${Array.from(VALID_ARCHIVE_RESOLUTIONS).join(", ")}`,
      );
    }
    if (
      status.workflow.resolution === "completed" &&
      Object.values(status.lanes).some((lane) => !DONE_LANE_STATUSES.has(lane.status))
    ) {
      errors.push("archive resolution completed requires every lane to be terminal");
    }
    if (status.notes !== undefined) {
      errors.push("archive status must fold notes into the final plan or archive_reason");
    }
    const extraStatusKeys = Object.keys(status).filter((key) => !ARCHIVE_STATUS_KEYS.has(key));
    if (extraStatusKeys.length > 0) {
      errors.push(`archive status has noncanonical fields: ${extraStatusKeys.join(", ")}`);
    }
    const extraLinearKeys = Object.keys(status.linear || {}).filter((key) => !ARCHIVE_LINEAR_KEYS.has(key));
    if (extraLinearKeys.length > 0) {
      errors.push(`archive Linear metadata has noncanonical fields: ${extraLinearKeys.join(", ")}`);
    }
    if ((status.history || []).length > 1) {
      errors.push("archive status history must contain only the final archive event");
    }
    for (const [laneName, lane] of Object.entries(status.lanes)) {
      const extraKeys = Object.keys(lane).filter((key) => key !== "owner" && key !== "status");
      if (extraKeys.length > 0) {
        errors.push(`archive lane "${laneName}" has operational fields: ${extraKeys.join(", ")}`);
      }
    }
    if (/\.plans\/(active|backlog|ideas)\//.test(JSON.stringify(status))) {
      errors.push("archive status must not reference live plan paths");
    }
  }

  validateTaxonomy(status, knownSlugs, errors);
  validateLinear(status, errors);
  validateExecutionSubLanes(status, featureDirPath, stage, errors);

  if (stage !== "archive") {
    for (const requiredLane of CANONICAL_LANES) {
      if (!status.lanes[requiredLane]) {
        errors.push(`missing lane "${requiredLane}"`);
        continue;
      }

      const lane = status.lanes[requiredLane];
      if (!VALID_LANE_STATUSES.has(lane.status)) {
        errors.push(`lane "${requiredLane}" has invalid status "${lane.status}"`);
      }

      if (lane.branch !== null && !hasText(lane.branch)) {
        errors.push(`lane "${requiredLane}" branch must be a string or null`);
      } else if (status.version >= 2 && hasText(lane.branch) && !isWorkBranchName(lane.branch)) {
        errors.push(`lane "${requiredLane}" branch must use <type>/<work-description>`);
      }
    }
  }

  if (status.links && typeof status.links === "object" && !Array.isArray(status.links)) {
    for (const linkKey of Object.keys(status.links)) {
      const linkPath = join(featureDirPath, status.links[linkKey]);
      if (!existsSync(linkPath)) {
        errors.push(`missing linked file "${status.links[linkKey]}"`);
      }
    }
  }

  if (stage !== "archive") {
    for (const [laneName, lane] of Object.entries(status.lanes)) {
      if (typeof lane.handoff !== "string" || lane.handoff.length === 0) {
        errors.push(`lane "${laneName}" is missing a handoff path`);
        continue;
      }

      if (!lane.handoff.startsWith("handoffs/")) {
        errors.push(`lane "${laneName}" handoff must live under handoffs/`);
      } else if (
        stage === "active" &&
        requiresHandoffFile(status) &&
        !existsSync(join(featureDirPath, lane.handoff))
      ) {
        errors.push(`lane "${laneName}" handoff file is missing: ${lane.handoff}`);
      }

      validateLaneTdd(status, laneName, lane, stage, errors);
      validateValidationReceipt(status, featureDirPath, laneName, lane, errors);
    }
  }

  return errors;
}

function scaffoldFeature(slug, flags) {
  const stage = flags.stage || "backlog";
  const title = flags.title || titleFromSlug(slug);
  const date = nowIso();

  assertStage(stage);

  const targetDir = featureDir(stage, slug);
  if (existsSync(targetDir)) {
    fail(`Feature "${slug}" already exists at ${targetDir}`);
  }

  mkdirSync(targetDir, { recursive: true });

  const replacements = {
    FEATURE_SLUG: slug,
    FEATURE_TITLE: title,
    STAGE: stage,
    DATE: date,
    WORKFLOW_STATUS: STAGE_TO_STATUS[stage],
  };

  applyTemplate("brief.md", targetDir, replacements);
  applyTemplate("spec.md", targetDir, replacements);
  applyTemplate("plan.todo.md", targetDir, replacements);
  applyTemplate("eval.md", targetDir, replacements);
  applyTemplate("status.json", targetDir, replacements);
  if (stage === "active") {
    ensureActiveHandoffFiles(targetDir, replacements);
  }

  const statusFile = statusPathForDir(targetDir);
  const status = loadJson(statusFile);
  status.history.push(
    historyEntry({
      actor: "human",
      lane: "system",
      status: "scaffolded",
      note: `Scaffolded feature hub in ${stage}`,
    }),
  );
  refreshLaneStatuses(status);
  saveJson(statusFile, status);

  console.log(`Scaffolded ${targetDir}`);
}

function moveFeature(flags, archiveLockHeld = false) {
  const slug = requireFlag(flags, "feature");
  const toStage = requireFlag(flags, "to");
  assertMoveStage(toStage);
  if (toStage === "archive" && !archiveLockHeld) {
    return withArchiveLock(() => moveFeature(flags, true));
  }
  if (toStage === "archive" && flags.resolution && !VALID_ARCHIVE_RESOLUTIONS.has(flags.resolution)) {
    fail(
      `Invalid archive resolution "${flags.resolution}". Expected one of: ${Array.from(VALID_ARCHIVE_RESOLUTIONS).join(", ")}`,
    );
  }

  const found = findFeature(slug);
  if (found.stage === toStage) {
    fail(`Feature "${slug}" is already in ${toStage}`);
  }

  const destinationDir = featureDir(toStage, slug);
  if (toStage !== "archive" && existsSync(destinationDir)) {
    fail(`Destination already exists: ${destinationDir}`);
  }

  const { status } = readFeatureStatus(found.dir);
  if (toStage === "archive" && canonicalLinearParentIssue(status.linear)) {
    const lastSyncedAt = status.linear?.lastSyncedAt;
    const latestHistoryEntry = status.history?.at(-1);
    const confirmedCurrentState =
      latestHistoryEntry?.status === "linear_sync_confirmed" &&
      latestHistoryEntry?.timestamp === lastSyncedAt &&
      latestHistoryEntry?.timestamp === status.workflow.updated_at;
    if (!hasText(lastSyncedAt) || !confirmedCurrentState) {
      throw new Error(
        `Mirrored feature "${slug}" changed after its last confirmed Linear sync. Apply the current linear-sync manifest, then run confirm-linear-sync --feature ${slug} --actor <actor> before archiving.`,
      );
    }
  }
  const reportsError = toStage === "archive" ? reportsEntryError(found.dir) : null;
  if (reportsError) {
    fail(reportsError);
  }
  const movedAt = nowIso();
  status.feature.stage = toStage;
  status.workflow.overall_status = STAGE_TO_STATUS[toStage];
  status.workflow.updated_at = movedAt;
  if (toStage === "archive") {
    const allLanesDone = Object.values(status.lanes).every((lane) => DONE_LANE_STATUSES.has(lane.status));
    const resolution = flags.resolution || (allLanesDone ? "completed" : "closed");
    status.workflow.archived_at = movedAt;
    status.workflow.archive_reason = flags.reason || (allLanesDone ? "Completed and archived." : "Closed and archived.");
    status.workflow.resolution = resolution;
  }
  status.history.push(
    historyEntry({
      actor: "human",
      lane: "system",
      status: `moved_to_${toStage}`,
      note: `Moved feature hub from ${found.stage} to ${toStage}`,
    }),
  );
  refreshLaneStatuses(status);

  if (toStage === "archive") {
    const errors = validateFeatureStatus(compactArchiveStatus(structuredClone(status)), found.dir, toStage);
    if (errors.length > 0) {
      fail(errors.join("\n"));
    }
  }

  if (toStage === "archive") {
    const historicalPath = `.plans/${found.stage}/${slug}`;
    compactArchiveStatus(status);
    appendArchiveLedgerEntry(status, historicalPath);
    rmSync(found.dir, { recursive: true, force: true });
    console.log(
      `Closed ${slug}: deleted ${historicalPath} and recorded it in .plans/ARCHIVE.md (git history is the archive).`,
    );
    return;
  }

  mkdirSync(planStageDir(toStage), { recursive: true });
  renameSync(found.dir, destinationDir);
  if (toStage === "active") {
    ensureActiveHandoffFiles(destinationDir, {
      FEATURE_SLUG: slug,
      FEATURE_TITLE: status.feature.title,
      STAGE: toStage,
      DATE: movedAt,
      WORKFLOW_STATUS: STAGE_TO_STATUS[toStage],
    });
  }
  saveJson(statusPathForDir(destinationDir), status);

  console.log(`Moved ${slug} to .plans/${toStage}/`);
  if (toStage === "backlog" || toStage === "active") {
    const manifest = buildLinearSyncManifest(status);
    if (manifest.warnings.length > 0) {
      console.error("Linear sync warning:");
      for (const warning of manifest.warnings) {
        console.error(`- ${warning}`);
      }
    }
  }
}

function listReady(flags) {
  const agent = requireFlag(flags, "agent");
  const laneName = normalizeLane(requireFlag(flags, "lane"));
  const stage = flags.stage || "active";
  assertStage(stage);

  const matches = featureRecords(stage)
    .filter((record) => record.status.lanes[laneName]?.owner === agent)
    .filter((record) => record.status.lanes[laneName]?.status === "ready")
    .filter((record) => record.status.workflow.overall_status === "active")
    .sort((left, right) => {
      const leftPriority = priorityWeight(left.status.workflow.priority);
      const rightPriority = priorityWeight(right.status.workflow.priority);
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      const leftCreated = Date.parse(left.status.workflow.created_at);
      const rightCreated = Date.parse(right.status.workflow.created_at);
      return leftCreated - rightCreated;
    });

  printFeatureList(matches, laneName, Boolean(flags.json));
}

function summary(flags) {
  if (flags.initiative && !VALID_TAXONOMY_INITIATIVES.has(flags.initiative)) {
    fail(`Invalid initiative "${flags.initiative}". Expected one of: ${Array.from(VALID_TAXONOMY_INITIATIVES).join(", ")}`);
  }

  if (flags.track && !VALID_TAXONOMY_TRACKS.has(flags.track)) {
    fail(`Invalid track "${flags.track}". Expected one of: ${Array.from(VALID_TAXONOMY_TRACKS).join(", ")}`);
  }

  const matches = STAGES.flatMap((stage) => featureRecords(stage))
    .filter((record) => !flags.initiative || record.status.taxonomy.initiative === flags.initiative)
    .filter((record) => !flags.track || record.status.taxonomy.tracks.includes(flags.track))
    .sort((left, right) => {
      const leftStage = STAGES.indexOf(left.status.feature.stage);
      const rightStage = STAGES.indexOf(right.status.feature.stage);
      if (leftStage !== rightStage) {
        return rightStage - leftStage;
      }

      const leftPriority = priorityWeight(left.status.workflow.priority);
      const rightPriority = priorityWeight(right.status.workflow.priority);
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return left.status.feature.slug.localeCompare(right.status.feature.slug);
    });

  printFeatureSummary(matches, Boolean(flags.json));
}

function stale(flags) {
  const days = flags.days === undefined ? 14 : Number(flags.days);
  if (!Number.isFinite(days) || days <= 0) {
    fail("--days must be a positive number");
  }

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const matches = STAGES.flatMap((stage) => featureRecords(stage))
    .map((record) => {
      const updatedAt = Date.parse(record.status.workflow.updated_at);
      return {
        slug: record.status.feature.slug,
        title: record.status.feature.title,
        stage: record.status.feature.stage,
        priority: record.status.workflow.priority,
        overall_status: record.status.workflow.overall_status,
        updated_at: record.status.workflow.updated_at,
        age_days: Number.isNaN(updatedAt) ? null : Math.floor((Date.now() - updatedAt) / (24 * 60 * 60 * 1000)),
        path: record.dir,
        updatedAt,
      };
    })
    .filter((record) => Number.isNaN(record.updatedAt) || record.updatedAt < cutoff)
    .sort((left, right) => (left.updatedAt || 0) - (right.updatedAt || 0));

  const output = matches.map(({ updatedAt: _updatedAt, ...record }) => record);
  if (flags.json) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  if (output.length === 0) {
    console.log(`No live plan hubs are older than ${days} days.`);
    return;
  }

  for (const record of output) {
    console.log(
      `${record.slug} | ${record.stage} | ${record.priority} | ${record.age_days ?? "invalid-date"}d | ${record.updated_at} | ${record.path}`,
    );
  }
}


function setLane(flags) {
  const slug = requireFlag(flags, "feature");
  const laneName = normalizeLane(requireFlag(flags, "lane"));
  const laneStatus = flags.status;
  const actor = flags.actor || "human";

  if (!laneStatus || !VALID_LANE_STATUSES.has(laneStatus)) {
    fail(`Invalid lane status "${laneStatus}". Expected one of: ${Array.from(VALID_LANE_STATUSES).join(", ")}`);
  }

  const found = findFeature(slug);
  let validationErrors = [];
  withFeatureLock(found.dir, () => {
    const { path, status } = readFeatureStatus(found.dir);

    status.lanes[laneName].status = laneStatus;
    status.lanes[laneName].manual_blocked = laneStatus === "blocked";
    if (flags.branch) {
      status.lanes[laneName].branch = flags.branch;
    }

    status.workflow.updated_at = nowIso();
    status.history.push(
      historyEntry({
        actor,
        lane: laneName,
        status: laneStatus,
        branch: flags.branch || status.lanes[laneName].branch,
        note: flags.note || null,
      }),
    );
    refreshLaneStatuses(status);
    const errors = validateFeatureStatus(status, found.dir, found.stage);
    if (errors.length > 0) {
      validationErrors = errors;
      return;
    }
    saveJson(path, status);
  });

  if (validationErrors.length > 0) {
    fail(validationErrors.join("\n"));
  }

  console.log(`Updated ${slug} lane ${laneName} -> ${laneStatus}`);
}

function recordTdd(flags) {
  const slug = requireFlag(flags, "feature");
  const laneName = normalizeLane(requireFlag(flags, "lane"));
  const actor = flags.actor || "human";

  if (!IMPLEMENTATION_LANES.has(laneName)) {
    fail(`TDD proof can only be recorded for implementation lanes: ${Array.from(IMPLEMENTATION_LANES).join(", ")}`);
  }

  const red = {
    command: requireFlag(flags, "red-command"),
    evidence: requireFlag(flags, "red-evidence"),
  };
  const green = {
    command: requireFlag(flags, "green-command"),
    evidence: requireFlag(flags, "green-evidence"),
  };

  const found = findFeature(slug);
  let validationErrors = [];
  withFeatureLock(found.dir, () => {
    const { path, status } = readFeatureStatus(found.dir);
    status.lanes[laneName].tdd = {
      mode: "required",
      status: "green_recorded",
      red,
      green,
      note: flags.note || "",
    };
    status.workflow.updated_at = nowIso();
    status.history.push(
      historyEntry({
        actor,
        lane: laneName,
        status: "tdd_recorded",
        branch: status.lanes[laneName].branch,
        note: flags.note || "Recorded RED/GREEN TDD proof",
      }),
    );

    const errors = validateFeatureStatus(status, found.dir, found.stage);
    if (errors.length > 0) {
      validationErrors = errors;
      return;
    }
    saveJson(path, status);
  });

  if (validationErrors.length > 0) {
    fail(validationErrors.join("\n"));
  }

  console.log(`Recorded TDD proof for ${slug} lane ${laneName}`);
}

function printLinearSyncManifest(manifest, asJson) {
  if (asJson) {
    console.log(JSON.stringify(manifest, null, 2));
    return;
  }

  console.log(`${manifest.feature.slug} | ${manifest.parent.action} parent | ${manifest.lanes.length} lane issue(s)`);
  console.log(`team=${manifest.routing.team} project=${manifest.routing.project || "unprojected"}`);
  for (const lane of manifest.lanes) {
    console.log(`${lane.lane} | ${lane.action} | ${lane.issue || "new"} | ${lane.title}`);
  }

  if (manifest.warnings.length > 0) {
    console.log("Warnings:");
    for (const warning of manifest.warnings) {
      console.log(`- ${warning}`);
    }
  }
}

function linearSync(flags) {
  const slug = requireFlag(flags, "feature");
  const found = findFeature(slug);
  const { status } = readFeatureStatus(found.dir);
  const normalized = refreshLaneStatuses(structuredClone(status));
  const errors = validateFeatureStatus(normalized, found.dir, found.stage);
  if (errors.length > 0) {
    fail(errors.join("\n"));
  }

  printLinearSyncManifest(buildLinearSyncManifest(normalized), Boolean(flags.json));
}

function parseLaneIssueSpec(spec) {
  if (typeof spec !== "string" || !spec.includes("=")) {
    fail(`Invalid --lane value "${spec}". Expected <lane>=<Linear issue>, for example ui=PRD-124.`);
  }

  const [rawLane, ...issueParts] = spec.split("=");
  const issue = issueParts.join("=").trim();
  const laneName = normalizeLane(rawLane.trim());
  if (!hasText(issue)) {
    fail(`Invalid --lane value "${spec}". Linear issue id is required.`);
  }

  return { laneName, issue };
}

function parseExecutionLaneIssueSpec(spec) {
  if (typeof spec !== "string" || !spec.includes("=")) {
    fail(`Invalid --execution-lane value "${spec}". Expected <sub-lane>=<Linear issue>.`);
  }

  const [rawLane, ...issueParts] = spec.split("=");
  const laneName = rawLane.trim();
  const issue = issueParts.join("=").trim();
  if (!EXECUTION_SUB_LANE_NAME.test(laneName) || !hasText(issue)) {
    fail(`Invalid --execution-lane value "${spec}". Expected <sub-lane>=<Linear issue>.`);
  }

  return { laneName, issue };
}

function recordLinear(flags) {
  const slug = requireFlag(flags, "feature");
  const actor = flags.actor || "human";
  const parentIssue = normalizedLinearIssue(flags.parent);
  const laneIssues = valuesForFlag(flags, "lane").map(parseLaneIssueSpec);
  const executionLaneIssues = valuesForFlag(flags, "execution-lane").map(parseExecutionLaneIssueSpec);
  const laneSyncMode = normalizeLinearLaneSyncMode(flags["lane-sync-mode"]);
  const project = normalizedLinearIssue(flags.project);
  const initiative = normalizedLinearIssue(flags.initiative);

  if (
    !parentIssue &&
    laneIssues.length === 0 &&
    executionLaneIssues.length === 0 &&
    !laneSyncMode &&
    !project &&
    !initiative
  ) {
    fail("record-linear requires --parent, --lane, --execution-lane, --lane-sync-mode, --project, or --initiative.");
  }

  const found = findFeature(slug);
  let validationErrors = [];
  withFeatureLock(found.dir, () => {
    const { path, status } = readFeatureStatus(found.dir);
    const linear = status.linear && typeof status.linear === "object" && !Array.isArray(status.linear)
      ? status.linear
      : {};
    const hasLegacyParentAlias = !normalizedLinearIssue(linear.parentIssue) && normalizedLinearIssue(linear.issue);
    const effectiveLaneSyncMode = laneSyncMode || linearLaneSyncMode(linear);

    if ((laneIssues.length > 0 || executionLaneIssues.length > 0) && effectiveLaneSyncMode === "parent_only") {
      validationErrors = [
        "record-linear cannot record lane issue IDs while linear.laneSyncMode is parent_only. Pass --lane-sync-mode lane_issues only after explicitly expanding the Linear footprint.",
      ];
      return;
    }

    const recordedAt = nowIso();
    linear.syncDirection = LINEAR_SYNC_DIRECTION;
    if (laneSyncMode) {
      linear.laneSyncMode = laneSyncMode;
    }
    if (parentIssue) {
      linear.parentIssue = parentIssue;
    } else if (hasLegacyParentAlias) {
      linear.parentIssue = normalizedLinearIssue(linear.issue);
    }
    if (project) {
      linear.project = project;
    } else if (hasLegacyParentAlias) {
      delete linear.project;
    }
    if (initiative) {
      linear.initiative = initiative;
    }
    if (!linear.lanes || typeof linear.lanes !== "object" || Array.isArray(linear.lanes)) {
      linear.lanes = {};
    }

    for (const { laneName, issue } of laneIssues) {
      linear.lanes[laneName] = {
        ...(linear.lanes[laneName] && typeof linear.lanes[laneName] === "object" ? linear.lanes[laneName] : {}),
        issue,
      };
    }

    for (const { laneName, issue } of executionLaneIssues) {
      const lane = status.execution_sub_lanes?.[laneName];
      if (!lane) {
        validationErrors = [`record-linear cannot find execution sub-lane "${laneName}".`];
        return;
      }
      const previousIssue = normalizedLinearIssue(lane.linear?.issue);
      lane.linear = {
        ...(lane.linear && typeof lane.linear === "object" && !Array.isArray(lane.linear) ? lane.linear : {}),
        issue,
      };
      const parentIssue = normalizedLinearIssue(lane.linear.parentIssue);
      const retainedCompatibilityIssues = Array.isArray(lane.linear_issues)
        ? lane.linear_issues
            .map(normalizedLinearIssue)
            .filter(
              (candidate) =>
                candidate && candidate !== previousIssue && candidate !== issue && candidate !== parentIssue,
            )
        : [];
      lane.linear_issues = [...new Set([issue, parentIssue, ...retainedCompatibilityIssues].filter(Boolean))];
    }

    status.linear = linear;
    status.workflow.updated_at = recordedAt;
    status.history.push(
      historyEntry({
        timestamp: recordedAt,
        actor,
        lane: "system",
        status: "linear_recorded",
        note: "Recorded Linear parent/lane issue identifiers",
      }),
    );

    const errors = validateFeatureStatus(status, found.dir, found.stage);
    if (errors.length > 0) {
      validationErrors = errors;
      return;
    }
    saveJson(path, status);
  });

  if (validationErrors.length > 0) {
    fail(validationErrors.join("\n"));
  }

  console.log(`Recorded Linear sync metadata for ${slug}`);
}

function confirmLinearSync(flags) {
  const slug = requireFlag(flags, "feature");
  const actor = requireFlag(flags, "actor");
  const found = findFeature(slug);
  let validationErrors = [];

  withFeatureLock(found.dir, () => {
    const { path, status } = readFeatureStatus(found.dir);
    if (!canonicalLinearParentIssue(status.linear)) {
      validationErrors = [
        `confirm-linear-sync requires a canonical Linear parent issue for feature "${slug}".`,
      ];
      return;
    }

    const confirmedAt = nowIso();
    status.linear.syncDirection = LINEAR_SYNC_DIRECTION;
    status.linear.lastSyncedAt = confirmedAt;
    status.workflow.updated_at = confirmedAt;
    status.history.push(
      historyEntry({
        timestamp: confirmedAt,
        actor,
        lane: "system",
        status: "linear_sync_confirmed",
        note: "Confirmed that the current Plan Hub state is reflected in Linear",
      }),
    );

    const errors = validateFeatureStatus(status, found.dir, found.stage);
    if (errors.length > 0) {
      validationErrors = errors;
      return;
    }
    saveJson(path, status);
  });

  if (validationErrors.length > 0) fail(validationErrors.join("\n"));
  console.log(`Confirmed Linear sync for ${slug}`);
}

function checkBranch(flags) {
  const slug = requireFlag(flags, "feature");
  const laneName = normalizeLane(requireFlag(flags, "lane"));
  const found = findFeature(slug);
  const { status } = readFeatureStatus(found.dir);
  const lane = status.lanes[laneName];
  const branchToCheck = lane.branch_trigger || lane.branch;

  if (!hasText(branchToCheck)) {
    fail(`No branch recorded for lane: ${laneName}`);
  }

  if (!branchExists(branchToCheck)) {
    fail(`Missing branch signal: ${branchToCheck}`);
  }

  console.log(branchToCheck);
}

function validate() {
  const failures = [];
  let checked = 0;
  resetValidationReceiptDebtObservations();
  const receiptDebt = loadValidationReceiptDebt();
  for (const error of receiptDebt.errors) {
    failures.push(`${VALIDATION_RECEIPT_DEBT_PATH}: ${error}`);
  }
  validatePlanRootStructure(failures);
  for (const stage of VALIDATION_STAGES) {
    validateStageStructure(stage, failures);
  }
  validateFencedYaml(failures);

  const records = STAGES.flatMap((stage) => featureRecords(stage));
  const knownSlugs = new Set(records.map((record) => record.status.feature.slug));

  for (const record of records) {
    checked += 1;
    const errors = validateFeatureStatus(record.status, record.dir, record.status.feature.stage, knownSlugs);
    for (const error of errors) {
      failures.push(`${record.dir}: ${error}`);
    }
  }

  for (const [key, entry] of receiptDebt.entries) {
    if (Date.parse(entry.expires_at) <= Date.now()) {
      failures.push(
        `${VALIDATION_RECEIPT_DEBT_PATH}: Validation Receipt debt baseline entry ${key} expired at ${entry.expires_at}`,
      );
      continue;
    }
    if (!matchedValidationReceiptDebt.has(key)) {
      failures.push(
        `${VALIDATION_RECEIPT_DEBT_PATH}: stale Validation Receipt debt baseline entry ${key}; remove it because the lane is compliant, nonterminal, or no longer exists`,
      );
    }
  }

  if (acceptedValidationReceiptDebt.size > 0) {
    console.log(
      `Validation Receipt debt (${acceptedValidationReceiptDebt.size} temporarily baselined lane gap${acceptedValidationReceiptDebt.size === 1 ? "" : "s"}):`,
    );
    for (const [key, entry] of [...acceptedValidationReceiptDebt].sort(([left], [right]) => left.localeCompare(right))) {
      console.log(`- ${key} | owner=${entry.owner} | expires=${entry.expires_at} | burn-down=${entry.burn_down}`);
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(failure);
    }
    process.exit(1);
  }

  console.log(`Validated ${checked} feature hub${checked === 1 ? "" : "s"}.`);
}

const [, , command, ...rest] = process.argv;

if (!command || command === "help" || command === "--help") {
  usage();
  process.exit(0);
}

const { positional, flags } = parseArgs(rest);

switch (command) {
  case "scaffold":
    if (positional.length === 0) {
      fail("Missing feature slug for scaffold.");
    }
    scaffoldFeature(positional[0], flags);
    break;
  case "move":
    moveFeature(flags);
    break;
  case "list":
    listReady(flags);
    break;
  case "set-lane":
    setLane(flags);
    break;
  case "record-tdd":
    recordTdd(flags);
    break;
  case "linear-sync":
    linearSync(flags);
    break;
  case "record-linear":
    recordLinear(flags);
    break;
  case "confirm-linear-sync":
    confirmLinearSync(flags);
    break;
  case "summary":
    summary(flags);
    break;
  case "stale":
    stale(flags);
    break;
  case "check-branch":
    checkBranch(flags);
    break;
  case "validate":
    validate();
    break;
  default:
    usage();
    fail(`Unknown command "${command}"`);
}
