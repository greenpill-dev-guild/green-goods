#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  existsSync,
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

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "../..");
const PLANS_ROOT = join(REPO_ROOT, ".plans");
const STAGES = ["ideas", "backlog", "active"];
const MOVE_STAGES = [...STAGES, "archive"];
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
const IMPLEMENTATION_LANES = new Set(["ui", "state_api", "contracts"]);
const TDD_TERMINAL_STATUSES = new Set(["passed", "completed"]);
const VALID_TDD_MODES = new Set(["required", "not_applicable", "proof_limit", "legacy_unrecorded"]);
const VALID_TDD_STATUSES = new Set(["pending", "red_recorded", "green_recorded"]);
const TDD_POLICY_STARTED_AT = Date.parse("2026-05-01T00:00:00.000Z");
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
const LANE_BRANCHES = {
  ui: (slug) => `claude/ui/${slug}`,
  state_api: (slug) => `codex/state-api/${slug}`,
  contracts: (slug) => `codex/contracts/${slug}`,
  qa_pass_1: (slug) => `claude/qa-pass-1/${slug}`,
  qa_pass_2: (slug) => `codex/qa-pass-2/${slug}`,
};
const LINEAR_SYNC_DIRECTION = "plans_to_linear_visibility";
const LINEAR_BASE_LABELS = ["protocol:green-goods", "source:plans"];
const LINEAR_PARENT_ACTIVITY_LABEL = "activity:architecture";
const LINEAR_LANE_SKIP_STATUSES = new Set(["n/a", "skipped", "passed", "completed"]);
const LANE_DISPLAY_NAMES = {
  ui: "UI",
  state_api: "State/API",
  contracts: "Contracts",
  qa_pass_1: "QA Pass 1",
  qa_pass_2: "QA Pass 2",
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
  node scripts/harness/plan-hub.mjs move --feature <feature-slug> --to <ideas|backlog|active|archive>
  node scripts/harness/plan-hub.mjs list --agent <claude|codex> --lane <lane> [--stage active] [--json]
  node scripts/harness/plan-hub.mjs set-lane --feature <feature-slug> --lane <lane> --status <status> [--actor human] [--branch <branch>] [--note "text"]
  node scripts/harness/plan-hub.mjs record-tdd --feature <feature-slug> --lane <ui|state-api|contracts> --red-command "..." --red-evidence "..." --green-command "..." --green-evidence "..." [--actor human]
  node scripts/harness/plan-hub.mjs linear-sync --feature <feature-slug> [--json]
  node scripts/harness/plan-hub.mjs record-linear --feature <feature-slug> [--parent PRD-123] [--lane ui=PRD-124] [--lane state-api=PRD-125] [--project <name-or-id>] [--initiative <name-or-id>] [--actor human]
  node scripts/harness/plan-hub.mjs summary [--initiative <initiative>] [--track <track>] [--json]
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
    .split("-")
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

function readFeatureStatus(featureDirPath) {
  const path = statusPathForDir(featureDirPath);
  const status = loadJson(path);
  return { path, status };
}

function withFeatureLock(featureDirPath, work, timeoutMs = 5000) {
  const lockDir = join(featureDirPath, ".status.lock");
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

function linearStateForLane(status, lane) {
  if (lane.status === "in_progress") {
    return "In Progress";
  }

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

function buildLinearParentDescription(status) {
  const source = planRelativeDir(status);
  return [
    `Source plan: \`${source}\``,
    `Status JSON: \`${source}status.json\``,
    "",
    "Plan-level tracker for Linear visibility. Keep execution detail and lane truth in `.plans/status.json`; child issues track actionable lanes.",
  ].join("\n");
}

function buildLinearLaneDescription(status, laneName, lane) {
  const source = planRelativeDir(status);
  return [
    `Source plan: \`${source}\``,
    `Lane: \`${laneName}\``,
    `Owner: \`${lane.owner || "unassigned"}\``,
    `Branch signal: \`${lane.branch || "n/a"}\``,
    `Handoff: \`${lane.handoff}\``,
    "",
    "This issue mirrors an actionable plan lane for Linear visibility. Keep implementation proof, lane state, and validation evidence in `.plans/status.json` and the lane handoff.",
  ].join("\n");
}

function linearLaneIsActionable(status, laneName) {
  const lane = status.lanes[laneName];
  if (!lane || LINEAR_LANE_SKIP_STATUSES.has(lane.status)) {
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
    title: `plan: ${normalized.feature.title}`,
    team,
    state: linearStateForStage(normalized.feature.stage),
    priority,
    labels: linearLabelsForStatus(normalized, LINEAR_PARENT_ACTIVITY_LABEL),
    project,
    description: buildLinearParentDescription(normalized),
  };

  const lanes = Object.keys(LANE_BRANCHES)
    .filter((laneName) => linearLaneIsActionable(normalized, laneName))
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
        title: `${LANE_DISPLAY_NAMES[laneName]}: ${normalized.feature.title}`,
        team,
        state: linearStateForLane(normalized, lane),
        priority,
        labels: linearLabelsForStatus(
          normalized,
          laneName === "qa_pass_1" || laneName === "qa_pass_2" ? "activity:qa" : "activity:build",
          laneName,
        ),
        project,
        description: buildLinearLaneDescription(normalized, laneName, lane),
        branch: lane.branch || null,
        handoff: lane.handoff,
        dependsOn: Array.isArray(lane.depends_on) ? lane.depends_on : [],
      };
    });

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
    parent,
    lanes,
    warnings,
  };
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

  for (const field of ["issue", "parentIssue", "project", "initiative", "lastSyncedAt"]) {
    if (linear[field] !== undefined && linear[field] !== null && typeof linear[field] !== "string") {
      errors.push(`linear.${field} must be a string or null`);
    }
  }

  if (linear.lanes === undefined || linear.lanes === null) {
    return;
  }

  if (typeof linear.lanes !== "object" || Array.isArray(linear.lanes)) {
    errors.push("linear.lanes must be an object when present");
    return;
  }

  for (const [laneName, laneLinear] of Object.entries(linear.lanes)) {
    if (!Object.hasOwn(LANE_BRANCHES, laneName)) {
      errors.push(`linear.lanes has unknown lane "${laneName}"`);
      continue;
    }

    if (!laneLinear || typeof laneLinear !== "object" || Array.isArray(laneLinear)) {
      errors.push(`linear.lanes.${laneName} must be an object`);
      continue;
    }

    if (laneLinear.issue !== undefined && laneLinear.issue !== null && typeof laneLinear.issue !== "string") {
      errors.push(`linear.lanes.${laneName}.issue must be a string or null`);
    }
  }
}

function historyEntry({ actor, lane, status, branch, note }) {
  return {
    timestamp: nowIso(),
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

function proofHasCommandAndEvidence(proof) {
  return proof && hasText(proof.command) && hasText(proof.evidence);
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

  if (TDD_TERMINAL_STATUSES.has(lane.status) && tdd.status !== "green_recorded") {
    errors.push(`lane "${laneName}" TDD required lane cannot be ${lane.status} without green_recorded RED/GREEN evidence`);
  }
}

function validateLegacyTdd(status, laneName, lane, stage, errors) {
  const createdAt = Date.parse(status.workflow.created_at);

  if (stage !== "active") {
    errors.push(`lane "${laneName}" legacy_unrecorded TDD mode is only allowed on active hubs`);
  }

  if (!TDD_TERMINAL_STATUSES.has(lane.status)) {
    errors.push(`lane "${laneName}" legacy_unrecorded TDD mode is only allowed for completed pre-policy work`);
  }

  if (!Number.isFinite(createdAt) || createdAt >= TDD_POLICY_STARTED_AT) {
    errors.push(`lane "${laneName}" legacy_unrecorded TDD mode is only allowed for pre-policy active work`);
  }

  if (!hasText(lane.tdd.note)) {
    errors.push(`lane "${laneName}" legacy_unrecorded TDD mode requires a note`);
  }
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

  validateTaxonomy(status, knownSlugs, errors);
  validateLinear(status, errors);

  for (const requiredLane of Object.keys(LANE_BRANCHES)) {
    if (!status.lanes[requiredLane]) {
      errors.push(`missing lane "${requiredLane}"`);
      continue;
    }

    const lane = status.lanes[requiredLane];
    if (!VALID_LANE_STATUSES.has(lane.status)) {
      errors.push(`lane "${requiredLane}" has invalid status "${lane.status}"`);
    }

    const expectedBranch = LANE_BRANCHES[requiredLane](slug);
    if (lane.branch !== expectedBranch) {
      errors.push(`lane "${requiredLane}" branch must be "${expectedBranch}"`);
    }
  }

  if (status.lanes.qa_pass_2?.branch_trigger !== LANE_BRANCHES.qa_pass_1(slug)) {
    errors.push(`qa_pass_2.branch_trigger must be "${LANE_BRANCHES.qa_pass_1(slug)}"`);
  }

  for (const linkKey of Object.keys(status.links)) {
    const linkPath = join(featureDirPath, status.links[linkKey]);
    if (!existsSync(linkPath)) {
      errors.push(`missing linked file "${status.links[linkKey]}"`);
    }
  }

  for (const [laneName, lane] of Object.entries(status.lanes)) {
    if (typeof lane.handoff !== "string" || lane.handoff.length === 0) {
      errors.push(`lane "${laneName}" is missing a handoff path`);
      continue;
    }

    if (!lane.handoff.startsWith("handoffs/")) {
      errors.push(`lane "${laneName}" handoff must live under handoffs/`);
    }

    validateLaneTdd(status, laneName, lane, stage, errors);
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
  mkdirSync(join(targetDir, "handoffs"), { recursive: true });
  mkdirSync(join(targetDir, "reports"), { recursive: true });
  mkdirSync(join(targetDir, "artifacts"), { recursive: true });

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
  applyTemplate(join("handoffs", "README.md"), targetDir, replacements);

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

function moveFeature(flags) {
  const slug = requireFlag(flags, "feature");
  const toStage = requireFlag(flags, "to");
  assertMoveStage(toStage);

  const found = findFeature(slug);
  if (found.stage === toStage) {
    fail(`Feature "${slug}" is already in ${toStage}`);
  }

  const destinationDir = featureDir(toStage, slug);
  if (existsSync(destinationDir)) {
    fail(`Destination already exists: ${destinationDir}`);
  }

  renameSync(found.dir, destinationDir);
  const { path, status } = readFeatureStatus(destinationDir);
  status.feature.stage = toStage;
  status.workflow.overall_status = STAGE_TO_STATUS[toStage];
  status.workflow.updated_at = nowIso();
  status.history.push(
    historyEntry({
      actor: "human",
      lane: "system",
      status: `moved_to_${toStage}`,
      note: `Moved feature hub from ${found.stage} to ${toStage}`,
    }),
  );
  refreshLaneStatuses(status);
  saveJson(path, status);

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

function recordLinear(flags) {
  const slug = requireFlag(flags, "feature");
  const actor = flags.actor || "human";
  const parentIssue = normalizedLinearIssue(flags.parent);
  const laneIssues = valuesForFlag(flags, "lane").map(parseLaneIssueSpec);
  const project = normalizedLinearIssue(flags.project);
  const initiative = normalizedLinearIssue(flags.initiative);

  if (!parentIssue && laneIssues.length === 0 && !project && !initiative) {
    fail("record-linear requires --parent, --lane, --project, or --initiative.");
  }

  const found = findFeature(slug);
  let validationErrors = [];
  withFeatureLock(found.dir, () => {
    const { path, status } = readFeatureStatus(found.dir);
    const linear = status.linear && typeof status.linear === "object" && !Array.isArray(status.linear)
      ? status.linear
      : {};
    const hasLegacyParentAlias = !normalizedLinearIssue(linear.parentIssue) && normalizedLinearIssue(linear.issue);

    linear.syncDirection = LINEAR_SYNC_DIRECTION;
    linear.lastSyncedAt = nowIso();
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

    status.linear = linear;
    status.workflow.updated_at = nowIso();
    status.history.push(
      historyEntry({
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

function checkBranch(flags) {
  const slug = requireFlag(flags, "feature");
  const laneName = normalizeLane(requireFlag(flags, "lane"));
  const found = findFeature(slug);
  const { status } = readFeatureStatus(found.dir);
  const lane = status.lanes[laneName];
  const branchToCheck = lane.branch_trigger || lane.branch;

  if (!branchExists(branchToCheck)) {
    fail(`Missing branch signal: ${branchToCheck}`);
  }

  console.log(branchToCheck);
}

function validate() {
  const failures = [];
  let checked = 0;
  const records = STAGES.flatMap((stage) => featureRecords(stage));
  const knownSlugs = new Set(records.map((record) => record.status.feature.slug));

  for (const record of records) {
    checked += 1;
    const errors = validateFeatureStatus(record.status, record.dir, record.status.feature.stage, knownSlugs);
    for (const error of errors) {
      failures.push(`${record.dir}: ${error}`);
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
  case "summary":
    summary(flags);
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
