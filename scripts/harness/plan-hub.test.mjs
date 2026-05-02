import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SCRIPT_PATH = join(REPO_ROOT, "scripts", "harness", "plan-hub.mjs");
const TEMPLATE_PATH = join(REPO_ROOT, ".plans", "_templates", "feature");

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), "plan-hub-test-"));
  mkdirSync(join(root, "scripts", "harness"), { recursive: true });
  mkdirSync(join(root, ".plans", "_templates"), { recursive: true });
  cpSync(SCRIPT_PATH, join(root, "scripts", "harness", "plan-hub.mjs"));
  cpSync(TEMPLATE_PATH, join(root, ".plans", "_templates", "feature"), { recursive: true });
  return root;
}

function runPlanHub(root, args) {
  return spawnSync(process.execPath, ["scripts/harness/plan-hub.mjs", ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

function readStatus(root, stage, slug) {
  return JSON.parse(readFileSync(join(root, ".plans", stage, slug, "status.json"), "utf8"));
}

function writeStatus(root, stage, slug, status) {
  writeFileSync(join(root, ".plans", stage, slug, "status.json"), `${JSON.stringify(status, null, 2)}\n`);
}

function withFixture(work) {
  const root = createFixture();
  try {
    return work(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("scaffolded hubs include TDD metadata on implementation lanes", () =>
  withFixture((root) => {
    const scaffold = runPlanHub(root, ["scaffold", "tdd-fixture", "--stage", "active"]);
    assert.equal(scaffold.status, 0, scaffold.stderr);

    const status = readStatus(root, "active", "tdd-fixture");
    for (const laneName of ["ui", "state_api", "contracts"]) {
      assert.deepEqual(status.lanes[laneName].tdd, {
        mode: "required",
        status: "pending",
        red: { command: "", evidence: "" },
        green: { command: "", evidence: "" },
        note: "",
      });
    }

    assert.equal(status.lanes.qa_pass_1.tdd, undefined);
    assert.equal(status.lanes.qa_pass_2.tdd, undefined);
  }));

test("terminal implementation lanes require recorded RED and GREEN evidence", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "terminal-proof", "--stage", "active"]).status, 0);

    const blocked = runPlanHub(root, [
      "set-lane",
      "--feature",
      "terminal-proof",
      "--lane",
      "state-api",
      "--status",
      "completed",
    ]);
    assert.notEqual(blocked.status, 0);
    assert.match(blocked.stderr, /state_api.*TDD/);

    const recorded = runPlanHub(root, [
      "record-tdd",
      "--feature",
      "terminal-proof",
      "--lane",
      "state-api",
      "--red-command",
      "cd packages/shared && bun run test -- terminal-proof.test.ts",
      "--red-evidence",
      "handoffs/codex-state-api.md#red",
      "--green-command",
      "cd packages/shared && bun run test -- terminal-proof.test.ts",
      "--green-evidence",
      "handoffs/codex-state-api.md#green",
    ]);
    assert.equal(recorded.status, 0, recorded.stderr);

    const completed = runPlanHub(root, [
      "set-lane",
      "--feature",
      "terminal-proof",
      "--lane",
      "state-api",
      "--status",
      "completed",
    ]);
    assert.equal(completed.status, 0, completed.stderr);

    assert.equal(runPlanHub(root, ["validate"]).status, 0);
  }));

test("not_applicable and proof_limit TDD modes require notes", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "notes-required", "--stage", "active"]).status, 0);
    const status = readStatus(root, "active", "notes-required");
    status.lanes.ui.status = "n/a";
    status.lanes.ui.tdd = {
      mode: "not_applicable",
      status: "pending",
      red: { command: "", evidence: "" },
      green: { command: "", evidence: "" },
      note: "",
    };
    status.lanes.state_api.status = "completed";
    status.lanes.state_api.tdd = {
      mode: "proof_limit",
      status: "green_recorded",
      red: { command: "", evidence: "" },
      green: { command: "node scripts/harness/plan-hub.mjs validate", evidence: "handoffs/codex-state-api.md" },
      note: "",
    };
    writeStatus(root, "active", "notes-required", status);

    const missingNotes = runPlanHub(root, ["validate"]);
    assert.notEqual(missingNotes.status, 0);
    assert.match(missingNotes.stderr, /ui.*not_applicable.*note/);
    assert.match(missingNotes.stderr, /state_api.*proof_limit.*note/);

    status.lanes.ui.tdd.note = "UI lane is not applicable for this API-only fixture.";
    status.lanes.state_api.tdd.note = "No deterministic RED state exists; fallback validation is recorded.";
    writeStatus(root, "active", "notes-required", status);

    assert.equal(runPlanHub(root, ["validate"]).status, 0);
  }));

test("legacy_unrecorded is limited to pre-policy completed active work", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "legacy-proof", "--stage", "active"]).status, 0);
    const status = readStatus(root, "active", "legacy-proof");
    status.workflow.created_at = "2026-05-02T00:00:00.000Z";
    status.lanes.state_api.status = "completed";
    status.lanes.state_api.tdd = {
      mode: "legacy_unrecorded",
      status: "pending",
      red: { command: "", evidence: "" },
      green: { command: "", evidence: "" },
      note: "Completed before the TDD policy was applied.",
    };
    writeStatus(root, "active", "legacy-proof", status);

    const rejected = runPlanHub(root, ["validate"]);
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /legacy_unrecorded.*pre-policy/);

    status.workflow.created_at = "2026-04-30T00:00:00.000Z";
    writeStatus(root, "active", "legacy-proof", status);

    assert.equal(runPlanHub(root, ["validate"]).status, 0);
  }));
