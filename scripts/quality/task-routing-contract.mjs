import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const TASK_ROUTING_PATH = ".claude/context/task-routing.json";

export const CORE_TASK_IDS = [
  "lookup-or-bounded-edit",
  "research",
  "planning",
  "debugging",
  "change-review",
  "architecture-discovery",
  "architecture-certification",
  "repository-audit",
  "approved-cleanup",
  "live-product-qa",
  "qa-notes-and-backlog",
  "pr-feedback",
  "pre-merge-readiness",
  "design-direction",
  "doc-review-feedback",
];

export const AUTHORITY_SURFACE_ROLES = new Set([
  "authority",
  "evidence",
  "coordination",
  "projection",
]);
export const AUTHORITY_VISIBILITIES = new Set(["repository", "public", "private", "external"]);
export const AUTHORITY_FLOW_RELATIONSHIPS = new Set([
  "projects",
  "explains",
  "mirrors visibility",
  "defines runs",
  "promotes accepted work",
]);
export const REQUIRED_AUTHORITY_FLOWS = new Map([
  ["implementation->generated-docs", "projects"],
  ["ontology->generated-docs", "projects"],
  ["maturity-projections->generated-docs", "projects"],
  ["skills->generated-docs", "projects"],
  ["qa-catalog->generated-docs", "projects"],
  ["implementation->authored-docs", "explains"],
  ["ontology->authored-docs", "explains"],
  ["plan-hubs->linear", "mirrors visibility"],
  ["qa-catalog->private-qa-evidence", "defines runs"],
  ["private-qa-evidence->linear", "promotes accepted work"],
]);

export const EXPECTED_MUTATION_BOUNDARIES = Object.freeze({
  "lookup-or-bounded-edit": "direct-bounded",
  research: "read-only-unless-persistence-requested",
  planning: "plan-artifacts-before-implementation",
  debugging: "diagnose-first-fix-when-requested",
  "change-review": "read-only-pinned-diff",
  "architecture-discovery": "read-only-until-human-selection",
  "architecture-certification": "read-only-pinned-proof",
  "repository-audit": "read-only-numbered-findings",
  "approved-cleanup": "approved-finding-ids-only",
  "live-product-qa": "session-bounded-fix-and-revalidate",
  "qa-notes-and-backlog": "authorized-product-records-and-private-qa-rows",
  "pr-feedback": "current-actionable-feedback-and-bounded-siblings",
  "pre-merge-readiness": "readiness-and-user-authorized-publish-actions",
  "design-direction": "advisory-until-explicit-polish-scope",
  "doc-review-feedback": "triage-then-scope-locked-edits",
});

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonEmptyStringArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
}

export function readTaskRouting(root, source = TASK_ROUTING_PATH) {
  try {
    return JSON.parse(readFileSync(path.join(root, source), "utf8"));
  } catch (error) {
    throw new Error(`Malformed task-routing authority ${source}: ${error.message}`);
  }
}

export function validateTaskRouting(root, contract = readTaskRouting(root)) {
  const errors = [];
  if (contract.version !== 2) errors.push("task-routing version must be 2");
  validateAuthorityMap(contract, errors);
  if (!Array.isArray(contract.tasks)) return [...errors, "task-routing tasks must be an array"];

  const ids = new Set();
  for (const [index, task] of contract.tasks.entries()) {
    const prefix = `tasks[${index}]`;
    if (!isNonEmptyString(task?.id)) errors.push(`${prefix}.id must be a non-empty string`);
    else if (ids.has(task.id)) errors.push(`duplicate task route: ${task.id}`);
    else ids.add(task.id);

    if (!isNonEmptyString(task?.label)) errors.push(`${prefix}.label must be a non-empty string`);
    if (!(task?.skill === null || isNonEmptyString(task?.skill))) {
      errors.push(`${prefix}.skill must be one skill name or null`);
    } else if (task.skill !== null) {
      const skillPath = `.claude/skills/${task.skill}/SKILL.md`;
      if (!existsSync(path.join(root, skillPath))) errors.push(`${task.id}: unknown skill ${task.skill}`);
    }
    if (!isNonEmptyString(task?.mutationBoundary)) {
      errors.push(`${prefix}.mutationBoundary must be explicit`);
    } else if (
      isNonEmptyString(task?.id) &&
      EXPECTED_MUTATION_BOUNDARIES[task.id] !== undefined &&
      task.mutationBoundary !== EXPECTED_MUTATION_BOUNDARIES[task.id]
    ) {
      errors.push(
        `${task.id}: mutationBoundary must be ${EXPECTED_MUTATION_BOUNDARIES[task.id]}, received ${task.mutationBoundary}`,
      );
    }
    if (!isNonEmptyStringArray(task?.requiredAuthorities)) errors.push(`${prefix}.requiredAuthorities must be a non-empty string array`);
    if (!isNonEmptyString(task?.output)) errors.push(`${prefix}.output must be explicit`);
    if (!isNonEmptyString(task?.handoff)) errors.push(`${prefix}.handoff must be explicit`);
    if (!isNonEmptyStringArray(task?.mustNotSwallow)) errors.push(`${prefix}.mustNotSwallow must name neighboring tasks`);
  }

  for (const id of CORE_TASK_IDS) if (!ids.has(id)) errors.push(`missing core task route: ${id}`);
  for (const id of ids) if (!CORE_TASK_IDS.includes(id)) errors.push(`unrecognized core task route: ${id}`);
  if (ids.size !== CORE_TASK_IDS.length) errors.push(`expected ${CORE_TASK_IDS.length} unambiguous core task routes, found ${ids.size}`);
  return errors;
}

function validateAuthorityMap(contract, errors) {
  if (!Array.isArray(contract.authoritySurfaces)) {
    errors.push("task-routing authoritySurfaces must be an array");
    return;
  }
  if (!Array.isArray(contract.authorityFlows)) {
    errors.push("task-routing authorityFlows must be an array");
    return;
  }

  const surfaces = new Map();
  for (const [index, surface] of contract.authoritySurfaces.entries()) {
    const prefix = `authoritySurfaces[${index}]`;
    if (!isNonEmptyString(surface?.id)) errors.push(`${prefix}.id must be a non-empty string`);
    else if (surfaces.has(surface.id)) errors.push(`duplicate authority surface: ${surface.id}`);
    else surfaces.set(surface.id, surface);
    if (!isNonEmptyString(surface?.label)) errors.push(`${prefix}.label must be a non-empty string`);
    if (!AUTHORITY_SURFACE_ROLES.has(surface?.role)) {
      errors.push(`${prefix}.role must be a recognized authority role`);
    }
    if (!isNonEmptyString(surface?.owns)) errors.push(`${prefix}.owns must name its ownership`);
    if (!AUTHORITY_VISIBILITIES.has(surface?.visibility)) {
      errors.push(`${prefix}.visibility must be one of ${[...AUTHORITY_VISIBILITIES].join(", ")}`);
    }
  }

  const flowIds = new Set();
  const edges = new Set();
  for (const [index, flow] of contract.authorityFlows.entries()) {
    const prefix = `authorityFlows[${index}]`;
    if (!isNonEmptyString(flow?.id)) errors.push(`${prefix}.id must be a non-empty string`);
    else if (flowIds.has(flow.id)) errors.push(`duplicate authority flow id: ${flow.id}`);
    else flowIds.add(flow.id);
    if (!surfaces.has(flow?.from)) errors.push(`${prefix}.from references unknown node: ${flow?.from}`);
    if (!surfaces.has(flow?.to)) errors.push(`${prefix}.to references unknown node: ${flow?.to}`);
    if (!isNonEmptyString(flow?.relationship)) {
      errors.push(`${prefix}.relationship must describe the one-way flow`);
    } else if (!AUTHORITY_FLOW_RELATIONSHIPS.has(flow.relationship)) {
      errors.push(`${prefix}.relationship must be one of ${[...AUTHORITY_FLOW_RELATIONSHIPS].join(", ")}`);
    }

    const edge = `${flow?.from}->${flow?.to}`;
    if (edges.has(edge)) errors.push(`duplicate authority edge: ${edge}`);
    else edges.add(edge);

    const sourceRole = surfaces.get(flow?.from)?.role;
    const targetRole = surfaces.get(flow?.to)?.role;
    if (
      sourceRole === "projection" ||
      sourceRole === "coordination" ||
      (sourceRole === "evidence" && targetRole !== "coordination")
    ) {
      errors.push(`downstream authority reversal is not allowed: ${edge}`);
    }
  }

  for (const [required, expectedRelationship] of REQUIRED_AUTHORITY_FLOWS) {
    if (!edges.has(required)) {
      errors.push(`missing required authority flow: ${required}`);
      continue;
    }
    const flow = contract.authorityFlows.find(({ from, to }) => `${from}->${to}` === required);
    if (flow?.relationship !== expectedRelationship) {
      errors.push(
        `required authority flow ${required} must use relationship "${expectedRelationship}"`,
      );
    }
  }
}
