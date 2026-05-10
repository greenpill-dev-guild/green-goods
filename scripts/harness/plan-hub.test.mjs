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

test("summary preserves stage status for research-only hubs with no implementation lanes", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "research-only", "--stage", "backlog"]).status, 0);
    const status = readStatus(root, "backlog", "research-only");
    status.taxonomy = {
      initiative: "environmental-data",
      tracks: ["docs"],
      work_types: ["research"],
      surfaces: [],
      depends_on_features: [],
    };
    for (const laneName of ["ui", "state_api", "contracts"]) {
      status.lanes[laneName].status = "n/a";
      status.lanes[laneName].tdd = {
        mode: "not_applicable",
        status: "pending",
        red: { command: "", evidence: "" },
        green: { command: "", evidence: "" },
        note: "Research-only hub with no behavior-changing implementation lane.",
      };
    }
    status.lanes.qa_pass_1.status = "n/a";
    status.lanes.qa_pass_2.status = "n/a";
    writeStatus(root, "backlog", "research-only", status);

    const summary = runPlanHub(root, ["summary", "--json"]);
    assert.equal(summary.status, 0, summary.stderr);
    const item = JSON.parse(summary.stdout).find((entry) => entry.slug === "research-only");
    assert.equal(item.overall_status, "backlog");
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

test("linear-sync manifest creates a parent and actionable implementation lane issues", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "linear-fixture", "--stage", "backlog"]).status, 0);
    const status = readStatus(root, "backlog", "linear-fixture");
    status.taxonomy = {
      initiative: "yield-to-impact",
      tracks: ["client", "shared"],
      work_types: ["implementation", "qa"],
      surfaces: ["packages/client", "packages/shared"],
      depends_on_features: [],
    };
    status.lanes.contracts.status = "n/a";
    writeStatus(root, "backlog", "linear-fixture", status);

    const result = runPlanHub(root, ["linear-sync", "--feature", "linear-fixture", "--json"]);
    assert.equal(result.status, 0, result.stderr);

    const manifest = JSON.parse(result.stdout);
    assert.equal(manifest.feature.slug, "linear-fixture");
    assert.equal(manifest.feature.path, ".plans/backlog/linear-fixture/");
    assert.equal(manifest.parent.action, "create");
    assert.equal(manifest.parent.title, "plan: Linear Fixture");
    assert.deepEqual(manifest.parent.labels, [
      "activity:architecture",
      "package:client",
      "protocol:green-goods",
      "source:plans",
      "task:funding-pathway",
    ]);
    assert.deepEqual(
      manifest.lanes.map((lane) => [lane.lane, lane.action, lane.title, lane.state]),
      [
        ["ui", "create", "UI: Linear Fixture", "Backlog"],
        ["state_api", "create", "State/API: Linear Fixture", "Backlog"],
      ],
    );
    assert.deepEqual(manifest.lanes[0].labels, [
      "activity:build",
      "package:client",
      "protocol:green-goods",
      "source:plans",
      "task:funding-pathway",
    ]);
    assert.deepEqual(manifest.lanes[1].labels, [
      "activity:build",
      "package:shared",
      "protocol:green-goods",
      "source:plans",
      "task:funding-pathway",
    ]);
    assert.match(manifest.warnings.join("\n"), /missing Linear parent issue/);
    assert.match(manifest.warnings.join("\n"), /missing Linear issue for lane ui/);
    assert.match(manifest.warnings.join("\n"), /unprojected/);
  }));

test("linear-sync chooses package labels by lane for cross-package plans", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "lane-label-fixture", "--stage", "backlog"]).status, 0);
    const status = readStatus(root, "backlog", "lane-label-fixture");
    status.taxonomy = {
      initiative: "agent-platform",
      tracks: ["agent", "client", "contracts", "shared"],
      work_types: ["implementation", "qa"],
      surfaces: ["packages/agent", "packages/client", "packages/contracts", "packages/shared"],
      depends_on_features: [],
    };
    writeStatus(root, "backlog", "lane-label-fixture", status);

    const result = runPlanHub(root, ["linear-sync", "--feature", "lane-label-fixture", "--json"]);
    assert.equal(result.status, 0, result.stderr);
    const manifest = JSON.parse(result.stdout);
    assert.deepEqual(manifest.parent.labels, [
      "activity:architecture",
      "package:agent",
      "protocol:green-goods",
      "source:plans",
    ]);
    assert.deepEqual(
      Object.fromEntries(
        manifest.lanes.map((lane) => [lane.lane, lane.labels.find((label) => label.startsWith("package:"))]),
      ),
      {
        ui: "package:client",
        state_api: "package:shared",
        contracts: "package:contracts",
      },
    );
  }));

test("linear-sync excludes QA lanes until dependencies are done or manually blocked", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "qa-linear-fixture", "--stage", "active"]).status, 0);
    let status = readStatus(root, "active", "qa-linear-fixture");
    status.lanes.ui.tdd = {
      mode: "not_applicable",
      status: "pending",
      red: { command: "", evidence: "" },
      green: { command: "", evidence: "" },
      note: "Fixture lane not needed.",
    };
    status.lanes.ui.status = "n/a";
    status.lanes.state_api.tdd = {
      mode: "not_applicable",
      status: "pending",
      red: { command: "", evidence: "" },
      green: { command: "", evidence: "" },
      note: "Fixture lane not needed.",
    };
    status.lanes.state_api.status = "n/a";
    status.lanes.contracts.status = "todo";
    writeStatus(root, "active", "qa-linear-fixture", status);

    let result = runPlanHub(root, ["linear-sync", "--feature", "qa-linear-fixture", "--json"]);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(
      JSON.parse(result.stdout).lanes.map((lane) => lane.lane),
      ["contracts"],
    );

    status = readStatus(root, "active", "qa-linear-fixture");
    status.lanes.contracts.tdd = {
      mode: "not_applicable",
      status: "pending",
      red: { command: "", evidence: "" },
      green: { command: "", evidence: "" },
      note: "Fixture lane not needed.",
    };
    status.lanes.contracts.status = "n/a";
    status.lanes.qa_pass_1.status = "blocked";
    status.lanes.qa_pass_1.manual_blocked = true;
    writeStatus(root, "active", "qa-linear-fixture", status);

    result = runPlanHub(root, ["linear-sync", "--feature", "qa-linear-fixture", "--json"]);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(
      JSON.parse(result.stdout).lanes.map((lane) => lane.lane),
      ["qa_pass_1"],
    );
  }));

test("linear-sync treats legacy linear.issue as the parent issue", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "legacy-linear", "--stage", "backlog"]).status, 0);
    const status = readStatus(root, "backlog", "legacy-linear");
    status.linear = {
      issue: "PRD-351",
      project: "completed-umbrella-project",
      syncDirection: "plans_to_linear_visibility",
      lastSyncedAt: "2026-05-03T01:35:00.000Z",
    };
    writeStatus(root, "backlog", "legacy-linear", status);

    const result = runPlanHub(root, ["linear-sync", "--feature", "legacy-linear", "--json"]);
    assert.equal(result.status, 0, result.stderr);
    const manifest = JSON.parse(result.stdout);
    assert.equal(manifest.parent.action, "update");
    assert.equal(manifest.parent.issue, "PRD-351");
    assert.equal(manifest.routing.project, null);
    assert.match(manifest.warnings.join("\n"), /legacy linear.issue/);
    assert.match(manifest.warnings.join("\n"), /Legacy linear.project ignored/);
  }));

test("ready-lane list exposes linear sync warnings before implementation handoff", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "list-linear-warning", "--stage", "active"]).status, 0);

    const result = runPlanHub(root, [
      "list",
      "--agent",
      "codex",
      "--lane",
      "state-api",
      "--stage",
      "active",
      "--json",
    ]);
    assert.equal(result.status, 0, result.stderr);

    const [item] = JSON.parse(result.stdout);
    assert.equal(item.slug, "list-linear-warning");
    assert.match(item.linear_sync_warnings.join("\n"), /missing Linear parent issue/);
    assert.match(item.linear_sync_warnings.join("\n"), /missing Linear issue for lane state_api/);
  }));

test("record-linear writes parent and lane issue ids into status.json", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "record-linear-fixture", "--stage", "backlog"]).status, 0);

    const result = runPlanHub(root, [
      "record-linear",
      "--feature",
      "record-linear-fixture",
      "--parent",
      "PRD-500",
      "--lane",
      "ui=PRD-501",
      "--lane",
      "state-api=PRD-502",
    ]);
    assert.equal(result.status, 0, result.stderr);

    const status = readStatus(root, "backlog", "record-linear-fixture");
    assert.equal(status.linear.parentIssue, "PRD-500");
    assert.equal(status.linear.syncDirection, "plans_to_linear_visibility");
    assert.equal(status.linear.lanes.ui.issue, "PRD-501");
    assert.equal(status.linear.lanes.state_api.issue, "PRD-502");
    assert.equal(status.history.at(-1).status, "linear_recorded");
    assert.equal(runPlanHub(root, ["validate"]).status, 0);
  }));

test("record-linear backfills parentIssue from legacy linear.issue when only lanes are recorded", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "legacy-record-linear", "--stage", "backlog"]).status, 0);
    const status = readStatus(root, "backlog", "legacy-record-linear");
    status.linear = {
      issue: "PRD-700",
      syncDirection: "plans_to_linear_visibility",
      lastSyncedAt: "2026-05-03T01:35:00.000Z",
    };
    writeStatus(root, "backlog", "legacy-record-linear", status);

    const result = runPlanHub(root, [
      "record-linear",
      "--feature",
      "legacy-record-linear",
      "--lane",
      "ui=PRD-701",
    ]);
    assert.equal(result.status, 0, result.stderr);

    const updated = readStatus(root, "backlog", "legacy-record-linear");
    assert.equal(updated.linear.issue, "PRD-700");
    assert.equal(updated.linear.parentIssue, "PRD-700");
    assert.equal(updated.linear.lanes.ui.issue, "PRD-701");
  }));

test("record-linear clears legacy project when backfilling parentIssue without an explicit project", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "legacy-project-record-linear", "--stage", "backlog"]).status, 0);
    const status = readStatus(root, "backlog", "legacy-project-record-linear");
    status.linear = {
      issue: "PRD-800",
      project: "completed-umbrella-project",
      syncDirection: "plans_to_linear_visibility",
      lastSyncedAt: "2026-05-03T01:35:00.000Z",
    };
    writeStatus(root, "backlog", "legacy-project-record-linear", status);

    const result = runPlanHub(root, [
      "record-linear",
      "--feature",
      "legacy-project-record-linear",
      "--lane",
      "ui=PRD-801",
    ]);
    assert.equal(result.status, 0, result.stderr);

    const updated = readStatus(root, "backlog", "legacy-project-record-linear");
    assert.equal(updated.linear.issue, "PRD-800");
    assert.equal(updated.linear.parentIssue, "PRD-800");
    assert.equal(updated.linear.project, undefined);
    assert.equal(updated.linear.lanes.ui.issue, "PRD-801");

    const sync = runPlanHub(root, ["linear-sync", "--feature", "legacy-project-record-linear", "--json"]);
    assert.equal(sync.status, 0, sync.stderr);
    const manifest = JSON.parse(sync.stdout);
    assert.equal(manifest.parent.issue, "PRD-800");
    assert.equal(manifest.routing.project, null);
    assert.match(manifest.warnings.join("\n"), /No explicit linear.project/);
  }));
