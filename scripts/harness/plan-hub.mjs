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
const STAGE_TO_STATUS = {
  ideas: "idea",
  backlog: "backlog",
  active: "active",
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

function usage() {
  console.log(`Usage:
  node scripts/harness/plan-hub.mjs scaffold <feature-slug> [--title "Feature Title"] [--stage backlog]
  node scripts/harness/plan-hub.mjs move --feature <feature-slug> --to <ideas|backlog|active>
  node scripts/harness/plan-hub.mjs list --agent <claude|codex> --lane <lane> [--stage active] [--json]
  node scripts/harness/plan-hub.mjs set-lane --feature <feature-slug> --lane <lane> --status <status> [--actor human] [--branch <branch>] [--note "text"]
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

    if (!next || next.startsWith("--")) {
      flags[key] = true;
      continue;
    }

    flags[key] = next;
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

  const allDone = Object.values(status.lanes).every((lane) => DONE_LANE_STATUSES.has(lane.status));
  if (allDone) {
    status.workflow.overall_status = "done";
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
      `${item.slug} | ${item.priority} | ${item.lane_status} | ${item.branch} | ${item.path}`,
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

function validateFeatureStatus(status, featureDirPath, stage) {
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
  assertStage(toStage);

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

function setLane(flags) {
  const slug = requireFlag(flags, "feature");
  const laneName = normalizeLane(requireFlag(flags, "lane"));
  const laneStatus = flags.status;
  const actor = flags.actor || "human";

  if (!laneStatus || !VALID_LANE_STATUSES.has(laneStatus)) {
    fail(`Invalid lane status "${laneStatus}". Expected one of: ${Array.from(VALID_LANE_STATUSES).join(", ")}`);
  }

  const found = findFeature(slug);
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
    saveJson(path, status);
  });

  console.log(`Updated ${slug} lane ${laneName} -> ${laneStatus}`);
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

  for (const stage of STAGES) {
    for (const record of featureRecords(stage)) {
      checked += 1;
      const errors = validateFeatureStatus(record.status, record.dir, stage);
      for (const error of errors) {
        failures.push(`${record.dir}: ${error}`);
      }
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
