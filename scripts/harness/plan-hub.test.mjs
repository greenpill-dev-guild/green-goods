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

test("active backlog and idea hubs require valid taxonomy", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "taxonomy-required", "--stage", "backlog"]).status, 0);
    const status = readStatus(root, "backlog", "taxonomy-required");
    delete status.taxonomy;
    writeStatus(root, "backlog", "taxonomy-required", status);

    const missing = runPlanHub(root, ["validate"]);
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /taxonomy is required/);

    status.taxonomy = {
      initiative: "unknown",
      tracks: ["shared", "mystery"],
      work_types: ["implementation", "unknown"],
      surfaces: ["packages/shared", "/absolute/path"],
      depends_on_features: [],
    };
    writeStatus(root, "backlog", "taxonomy-required", status);

    const invalid = runPlanHub(root, ["validate"]);
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /taxonomy.initiative/);
    assert.match(invalid.stderr, /taxonomy.tracks/);
    assert.match(invalid.stderr, /taxonomy.work_types/);
    assert.match(invalid.stderr, /taxonomy.surfaces/);
  }));

test("taxonomy depends_on_features must reference formal hubs", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "known-dependency", "--stage", "backlog"]).status, 0);
    assert.equal(runPlanHub(root, ["scaffold", "dependent-hub", "--stage", "backlog"]).status, 0);
    const status = readStatus(root, "backlog", "dependent-hub");
    status.taxonomy.depends_on_features = ["known-dependency", "missing-dependency"];
    writeStatus(root, "backlog", "dependent-hub", status);

    const invalid = runPlanHub(root, ["validate"]);
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /taxonomy.depends_on_features.*missing-dependency/);

    status.taxonomy.depends_on_features = ["known-dependency"];
    writeStatus(root, "backlog", "dependent-hub", status);

    assert.equal(runPlanHub(root, ["validate"]).status, 0);
  }));

test("summary filters hubs by initiative and track", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "yield-hub", "--stage", "active"]).status, 0);
    assert.equal(runPlanHub(root, ["scaffold", "agent-hub", "--stage", "backlog"]).status, 0);

    const yieldStatus = readStatus(root, "active", "yield-hub");
    yieldStatus.taxonomy = {
      initiative: "yield-to-impact",
      tracks: ["shared", "admin"],
      work_types: ["implementation", "qa"],
      surfaces: ["packages/shared", "packages/admin"],
      depends_on_features: [],
    };
    writeStatus(root, "active", "yield-hub", yieldStatus);

    const agentStatus = readStatus(root, "backlog", "agent-hub");
    agentStatus.taxonomy = {
      initiative: "agent-platform",
      tracks: ["agent", "ops"],
      work_types: ["observability", "implementation"],
      surfaces: ["packages/agent"],
      depends_on_features: [],
    };
    writeStatus(root, "backlog", "agent-hub", agentStatus);

    const initiative = runPlanHub(root, ["summary", "--initiative", "yield-to-impact", "--json"]);
    assert.equal(initiative.status, 0, initiative.stderr);
    assert.deepEqual(
      JSON.parse(initiative.stdout).map((item) => item.slug),
      ["yield-hub"],
    );

    const track = runPlanHub(root, ["summary", "--track", "agent", "--json"]);
    assert.equal(track.status, 0, track.stderr);
    assert.deepEqual(
      JSON.parse(track.stdout).map((item) => item.slug),
      ["agent-hub"],
    );
  }));

test("archive hubs do not require taxonomy", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "archived-hub", "--stage", "active"]).status, 0);
    mkdirSync(join(root, ".plans", "archive"), { recursive: true });
    cpSync(join(root, ".plans", "active", "archived-hub"), join(root, ".plans", "archive", "archived-hub"), {
      recursive: true,
    });
    rmSync(join(root, ".plans", "active", "archived-hub"), { recursive: true, force: true });

    const status = JSON.parse(readFileSync(join(root, ".plans", "archive", "archived-hub", "status.json"), "utf8"));
    status.feature.stage = "archive";
    delete status.taxonomy;
    writeFileSync(
      join(root, ".plans", "archive", "archived-hub", "status.json"),
      `${JSON.stringify(status, null, 2)}\n`,
    );

    assert.equal(runPlanHub(root, ["validate"]).status, 0);
  }));
