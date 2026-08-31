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
  if (contract.version !== 1) errors.push("task-routing version must be 1");
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
