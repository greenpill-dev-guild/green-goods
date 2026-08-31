import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  CORE_TASK_IDS,
  readTaskRouting,
  validateTaskRouting,
} from "./task-routing-contract.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");

test("live task routing is complete and unambiguous", () => {
  const contract = readTaskRouting(REPO_ROOT);
  assert.deepEqual(validateTaskRouting(REPO_ROOT, contract), []);
  assert.deepEqual(contract.tasks.map((task) => task.id), CORE_TASK_IDS);
});

test("unknown skills, missing handoffs, mutation mismatches, and ambiguous routes fail", () => {
  const contract = readTaskRouting(REPO_ROOT);
  const broken = structuredClone(contract);
  broken.tasks[0].skill = "unknown-skill";
  broken.tasks[1].handoff = "";
  broken.tasks[2].mutationBoundary = "write-production-code";
  broken.tasks.push(structuredClone(broken.tasks[3]));
  const errors = validateTaskRouting(REPO_ROOT, broken);
  assert.ok(errors.some((error) => error.includes("unknown skill")));
  assert.ok(errors.some((error) => error.includes("handoff")));
  assert.ok(errors.some((error) => error.includes("planning: mutationBoundary must be")));
  assert.ok(errors.some((error) => error.includes("duplicate task route")));
});

test("malformed routing JSON fails closed", () => {
  const root = mkdtempSync(path.join(tmpdir(), "green-goods-task-routing-"));
  try {
    mkdirSync(path.join(root, ".claude/context"), { recursive: true });
    writeFileSync(path.join(root, ".claude/context/task-routing.json"), "{broken");
    assert.throws(() => readTaskRouting(root), /Malformed task-routing authority/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
