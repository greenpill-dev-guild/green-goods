import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
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
  symlinkSync(join(REPO_ROOT, "node_modules"), join(root, "node_modules"), "dir");
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

test("validate rejects unsupported plan-hub root entries", () =>
  withFixture((root) => {
    mkdirSync(join(root, ".plans", "reviews"), { recursive: true });

    const rejected = runPlanHub(root, ["validate"]);
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /reviews: unsupported plan-hub root entry/);

    rmSync(join(root, ".plans", "reviews"), { recursive: true });
    const accepted = runPlanHub(root, ["validate"]);
    assert.equal(accepted.status, 0, accepted.stderr);
  }));

test("validate rejects malformed fenced YAML", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "yaml-fixture", "--stage", "active"]).status, 0);
    const specPath = join(root, ".plans", "active", "yaml-fixture", "config-spec.md");
    writeFileSync(specPath, "```yaml\nroot:\n  - event: valid\n    - event: invalid\n```\n");

    const rejected = runPlanHub(root, ["validate"]);
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /config-spec\.md:4: invalid fenced YAML/);

    writeFileSync(specPath, "```yaml\nroot:\n  - event: valid\n  - event: corrected\n```\n");
    const accepted = runPlanHub(root, ["validate"]);
    assert.equal(accepted.status, 0, accepted.stderr);
  }));

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

test("backlog scaffolds defer handoff files until activation", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "deferred-handoffs", "--stage", "backlog"]).status, 0);
    assert.equal(existsSync(join(root, ".plans", "backlog", "deferred-handoffs", "handoffs")), false);

    const moved = runPlanHub(root, ["move", "--feature", "deferred-handoffs", "--to", "active"]);
    assert.equal(moved.status, 0, moved.stderr);
    assert.equal(
      existsSync(join(root, ".plans", "active", "deferred-handoffs", "handoffs", "codex-state-api.md")),
      true,
    );
    assert.equal(runPlanHub(root, ["validate"]).status, 0);
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

test("archive hubs retain taxonomy for closed-work discovery", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "archived-hub", "--stage", "active"]).status, 0);
    const moved = runPlanHub(root, [
      "move",
      "--feature",
      "archived-hub",
      "--to",
      "archive",
      "--resolution",
      "closed",
      "--reason",
      "Fixture closeout.",
    ]);
    assert.equal(moved.status, 0, moved.stderr);

    const status = readStatus(root, "archive", "archived-hub");
    delete status.taxonomy;
    writeStatus(root, "archive", "archived-hub", status);

    const result = runPlanHub(root, ["validate"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /taxonomy is required/);
  }));

test("linear-sync manifest keeps backlog hubs parent-only", () =>
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
    ]);
    assert.deepEqual(manifest.lanes, []);
    assert.match(manifest.warnings.join("\n"), /missing Linear parent issue/);
    assert.match(manifest.warnings.join("\n"), /unprojected/);
    assert.doesNotMatch(manifest.warnings.join("\n"), /missing Linear issue for lane/);
  }));

test("linear-sync manifest creates actionable lane issues for active hubs", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "active-linear-fixture", "--stage", "active"]).status, 0);
    const status = readStatus(root, "active", "active-linear-fixture");
    status.taxonomy = {
      initiative: "yield-to-impact",
      tracks: ["client", "shared"],
      work_types: ["implementation", "qa"],
      surfaces: ["packages/client", "packages/shared"],
      depends_on_features: [],
    };
    status.lanes.contracts.status = "n/a";
    writeStatus(root, "active", "active-linear-fixture", status);

    const result = runPlanHub(root, ["linear-sync", "--feature", "active-linear-fixture", "--json"]);
    assert.equal(result.status, 0, result.stderr);

    const manifest = JSON.parse(result.stdout);
    assert.equal(manifest.feature.slug, "active-linear-fixture");
    assert.equal(manifest.feature.path, ".plans/active/active-linear-fixture/");
    assert.equal(manifest.parent.action, "create");
    assert.equal(manifest.parent.title, "plan: Active Linear Fixture");
    assert.deepEqual(
      manifest.lanes.map((lane) => [lane.lane, lane.action, lane.title, lane.state]),
      [
        ["ui", "create", "UI: Active Linear Fixture", "Todo"],
        ["state_api", "create", "State/API: Active Linear Fixture", "Todo"],
      ],
    );
    assert.deepEqual(manifest.lanes[0].labels, [
      "activity:build",
      "ai:claude",
      "package:client",
      "protocol:green-goods",
      "source:plans",
    ]);
    assert.deepEqual(manifest.lanes[1].labels, [
      "activity:build",
      "ai:codex",
      "package:shared",
      "protocol:green-goods",
      "source:plans",
    ]);
    assert.match(manifest.warnings.join("\n"), /missing Linear parent issue/);
    assert.match(manifest.warnings.join("\n"), /missing Linear issue for lane ui/);
    assert.match(manifest.warnings.join("\n"), /unprojected/);
  }));

test("linear-sync chooses package labels by lane for cross-package plans", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "lane-label-fixture", "--stage", "active"]).status, 0);
    const status = readStatus(root, "active", "lane-label-fixture");
    status.taxonomy = {
      initiative: "agent-platform",
      tracks: ["agent", "client", "contracts", "shared"],
      work_types: ["implementation", "qa"],
      surfaces: ["packages/agent", "packages/client", "packages/contracts", "packages/shared"],
      depends_on_features: [],
    };
    writeStatus(root, "active", "lane-label-fixture", status);

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

test("linear-sync omits package labels on research-only plans", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "research-only-linear", "--stage", "backlog"]).status, 0);
    const status = readStatus(root, "backlog", "research-only-linear");
    status.taxonomy = {
      initiative: "environmental-data",
      tracks: ["contracts", "shared"],
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
        note: "Research-only hub, no implementation lane.",
      };
    }
    status.lanes.qa_pass_1.status = "n/a";
    status.lanes.qa_pass_2.status = "n/a";
    writeStatus(root, "backlog", "research-only-linear", status);

    const result = runPlanHub(root, ["linear-sync", "--feature", "research-only-linear", "--json"]);
    assert.equal(result.status, 0, result.stderr);
    const manifest = JSON.parse(result.stdout);
    assert.ok(
      manifest.parent.labels.every((label) => !label.startsWith("package:")),
      `research-only parent should carry no package: label, got: ${manifest.parent.labels.join(", ")}`,
    );
  }));

test("linear-sync labels docs-owned state lanes as docs work", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "docs-lane-fixture", "--stage", "active"]).status, 0);
    const status = readStatus(root, "active", "docs-lane-fixture");
    status.taxonomy = {
      initiative: "public-experience",
      tracks: ["docs", "admin", "client"],
      work_types: ["maintenance", "review"],
      surfaces: ["docs", "packages/admin", "packages/client"],
      depends_on_features: [],
    };
    status.lanes.ui.status = "n/a";
    status.lanes.ui.tdd = {
      mode: "not_applicable",
      status: "pending",
      red: { command: "", evidence: "" },
      green: { command: "", evidence: "" },
      note: "Docs lane fixture has no UI lane.",
    };
    status.lanes.contracts.status = "n/a";
    status.lanes.contracts.tdd = {
      mode: "not_applicable",
      status: "pending",
      red: { command: "", evidence: "" },
      green: { command: "", evidence: "" },
      note: "Docs lane fixture has no contracts lane.",
    };
    writeStatus(root, "active", "docs-lane-fixture", status);

    const result = runPlanHub(root, ["linear-sync", "--feature", "docs-lane-fixture", "--json"]);
    assert.equal(result.status, 0, result.stderr);
    const manifest = JSON.parse(result.stdout);
    assert.equal(manifest.lanes[0].lane, "state_api");
    assert.equal(manifest.lanes[0].labels.find((label) => label.startsWith("package:")), "package:docs");
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

test("parent-only lane sync suppresses active lane issue actions and warnings", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "parent-only-linear", "--stage", "active"]).status, 0);
    const status = readStatus(root, "active", "parent-only-linear");
    status.linear = {
      parentIssue: "PRD-900",
      syncDirection: "plans_to_linear_visibility",
      laneSyncMode: "parent_only",
      lastSyncedAt: "2026-07-06T00:00:00.000Z",
    };
    status.lanes.ui.status = "in_progress";
    writeStatus(root, "active", "parent-only-linear", status);

    const sync = runPlanHub(root, ["linear-sync", "--feature", "parent-only-linear", "--json"]);
    assert.equal(sync.status, 0, sync.stderr);
    const manifest = JSON.parse(sync.stdout);
    assert.equal(manifest.parent.issue, "PRD-900");
    assert.equal(manifest.parent.state, "In Progress");
    assert.match(manifest.parent.description, /intentionally does not create or update lane issues/);
    assert.equal(manifest.laneSyncMode, "parent_only");
    assert.deepEqual(manifest.lanes, []);
    assert.equal(manifest.warnings.some((warning) => warning.includes("Plan is missing Linear issue for lane")), false);

    const list = runPlanHub(root, [
      "list",
      "--agent",
      "codex",
      "--lane",
      "state-api",
      "--stage",
      "active",
      "--json",
    ]);
    assert.equal(list.status, 0, list.stderr);
    const [item] = JSON.parse(list.stdout);
    assert.equal(item.slug, "parent-only-linear");
    assert.equal(item.linear_sync_warnings.some((warning) => warning.includes("Plan is missing Linear issue for lane")), false);
  }));

test("linear-sync uses execution sub-lanes without duplicating aggregate implementation lanes", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "execution-linear", "--stage", "active"]).status, 0);
    const status = readStatus(root, "active", "execution-linear");
    status.linear = {
      parentIssue: "PRD-1000",
      project: "Execution Project",
      milestones: {
        build: "2026-07-31",
        release: "2026-08-12",
      },
      operationalCheckpoints: {
        settlement_evidence: "2026-09-30",
      },
      syncDirection: "plans_to_linear_visibility",
      laneSyncMode: "lane_issues",
      lastSyncedAt: "2026-07-20T00:00:00.000Z",
      lanes: {
        qa_pass_1: { issue: "PRD-1003", milestone: "build" },
        qa_pass_2: { issue: "PRD-1004", milestone: "build" },
      },
    };
    status.execution_sub_lanes = {
      contracts: {
        machine_lane: "contracts",
        owner: "codex",
        status: "ready",
        branch: "codex/contracts/execution-linear",
        depends_on: [],
        handoff: "handoffs/codex-contracts.md",
        linear: { sync: true, issue: "PRD-1001", parentIssue: "PRD-1000", milestone: "build" },
      },
      settlement_evidence: {
        machine_lane: null,
        owner: "human",
        status: "blocked",
        blocked_reason: "Definition inputs are not locked.",
        branch: null,
        depends_on: ["contracts"],
        handoff: "handoffs/codex-state-api.md",
        linear: {
          sync: true,
          issue: null,
          parentIssue: null,
          milestone: null,
          dueDate: "2026-09-30",
        },
      },
    };
    writeStatus(root, "active", "execution-linear", status);

    const result = runPlanHub(root, ["linear-sync", "--feature", "execution-linear", "--json"]);
    assert.equal(result.status, 0, result.stderr);
    const manifest = JSON.parse(result.stdout);
    assert.deepEqual(manifest.lanes.map((lane) => lane.lane), [
      "contracts",
      "settlement_evidence",
      "qa_pass_1",
      "qa_pass_2",
    ]);
    assert.deepEqual(manifest.warnings, []);
    assert.equal(manifest.lanes[0].issue, "PRD-1001");
    assert.equal(manifest.lanes[0].parentId, "PRD-1000");
    assert.deepEqual(manifest.lanes[0].milestone, { key: "build", targetDate: "2026-07-31" });
    assert.equal(manifest.lanes[0].dueDate, null);
    assert.ok(manifest.lanes[0].labels.includes("ai:codex"));
    assert.equal(manifest.lanes[1].action, "create");
    assert.equal(manifest.lanes[1].title, "Settlement Evidence: Execution Linear");
    assert.equal(manifest.lanes[1].parentId, null);
    assert.equal(manifest.lanes[1].milestone, null);
    assert.equal(manifest.lanes[1].dueDate, "2026-09-30");
    assert.equal(manifest.lanes[1].labels.some((label) => label.startsWith("ai:")), false);
    assert.equal(manifest.lanes.some((lane) => lane.lane === "ui" || lane.lane === "state_api"), false);
    assert.deepEqual(manifest.lanes[2].milestone, { key: "build", targetDate: "2026-07-31" });
    assert.deepEqual(manifest.schedule, {
      milestones: {
        build: "2026-07-31",
        release: "2026-08-12",
      },
      operationalCheckpoints: {
        settlement_evidence: "2026-09-30",
      },
    });
  }));

test("execution and canonical lane scheduling metadata must reference valid project dates", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "bad-linear-schedule", "--stage", "active"]).status, 0);
    const status = readStatus(root, "active", "bad-linear-schedule");
    status.linear = {
      parentIssue: "PRD-1300",
      milestones: {
        build: "2026-02-30",
      },
      operationalCheckpoints: [],
      syncDirection: "plans_to_linear_visibility",
      laneSyncMode: "lane_issues",
      lanes: {
        qa_pass_1: {
          issue: "PRD-1302",
          milestone: "missing",
          dueDate: "2026-13-01",
          surprise: true,
        },
      },
    };
    status.execution_sub_lanes = {
      contracts: {
        machine_lane: "contracts",
        owner: "codex",
        status: "ready",
        branch: "codex/contracts/bad-linear-schedule",
        depends_on: [],
        handoff: "handoffs/codex-contracts.md",
        linear: {
          sync: true,
          issue: "PRD-1301",
          parentIssue: "PRD-1300",
          milestone: "release",
          dueDate: "2026-09-31",
        },
      },
    };
    writeStatus(root, "active", "bad-linear-schedule", status);

    const result = runPlanHub(root, ["validate"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /linear\.milestones\.build must be a YYYY-MM-DD date/);
    assert.match(result.stderr, /linear\.operationalCheckpoints must be an object/);
    assert.match(result.stderr, /linear\.lanes\.qa_pass_1 has unsupported fields: surprise/);
    assert.match(result.stderr, /linear\.lanes\.qa_pass_1\.milestone must reference linear\.milestones\.missing/);
    assert.match(result.stderr, /linear\.lanes\.qa_pass_1\.dueDate must be a YYYY-MM-DD date or null/);
    assert.match(
      result.stderr,
      /execution_sub_lanes\.contracts\.linear\.milestone must reference linear\.milestones\.release/,
    );
    assert.match(
      result.stderr,
      /execution_sub_lanes\.contracts\.linear\.dueDate must be a YYYY-MM-DD date or null/,
    );
  }));

test("execution sub-lane validation rejects unsafe metadata and dependency drift", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "bad-execution-linear", "--stage", "active"]).status, 0);
    const status = readStatus(root, "active", "bad-execution-linear");
    status.execution_sub_lanes = {
      "Bad Lane": {
        machine_lane: "mystery",
        owner: "human",
        status: "ready",
        depends_on: ["missing_lane"],
        handoff: "handoffs/missing.md",
        linear: { sync: true, issue: null },
      },
    };
    writeStatus(root, "active", "bad-execution-linear", status);

    const result = runPlanHub(root, ["validate"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /invalid name/);
    assert.match(result.stderr, /canonical machine lane/);
    assert.match(result.stderr, /cannot be ready with a human owner/);
    assert.match(result.stderr, /unknown lanes: missing_lane/);
    assert.match(result.stderr, /handoff file is missing/);
    assert.match(result.stderr, /linear\.parentIssue is required/);
  }));

test("execution sub-lane validation rejects parent drift and duplicate issue relationships", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "relationship-drift", "--stage", "active"]).status, 0);
    const status = readStatus(root, "active", "relationship-drift");
    status.linear = {
      parentIssue: "PRD-1200",
      syncDirection: "plans_to_linear_visibility",
      laneSyncMode: "lane_issues",
      lastSyncedAt: "2026-07-20T00:00:00.000Z",
      lanes: {
        qa_pass_1: { issue: "PRD-1203" },
        qa_pass_2: { issue: "PRD-1203" },
      },
    };
    status.execution_sub_lanes = {
      contracts: {
        machine_lane: "contracts",
        owner: "codex",
        status: "ready",
        branch: "codex/contracts/relationship-drift",
        depends_on: [],
        handoff: "handoffs/codex-contracts.md",
        linear: { sync: true, issue: "PRD-1203", parentIssue: "PRD-9999" },
      },
      docs: {
        machine_lane: "ui",
        owner: "claude",
        status: "blocked",
        blocked_reason: "Wait for source convergence.",
        branch: "claude/docs/relationship-drift",
        depends_on: ["contracts"],
        handoff: "handoffs/codex-state-api.md",
        linear: { sync: true, issue: "PRD-1200", parentIssue: "PRD-1200" },
      },
    };
    writeStatus(root, "active", "relationship-drift", status);

    const result = runPlanHub(root, ["validate"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /parentIssue must match canonical parent PRD-1200 or be null/);
    assert.match(result.stderr, /linear\.lanes\.qa_pass_2\.issue duplicates PRD-1203/);
    assert.match(result.stderr, /duplicates PRD-1203 already used by linear\.lanes\.qa_pass_1/);
    assert.match(result.stderr, /cannot reuse the canonical parent issue/);
  }));

test("execution sub-lane validation rejects compatibility issue-list drift", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "compatibility-issue-drift", "--stage", "active"]).status, 0);
    const status = readStatus(root, "active", "compatibility-issue-drift");
    status.linear = {
      parentIssue: "PRD-1300",
      syncDirection: "plans_to_linear_visibility",
      laneSyncMode: "lane_issues",
      lastSyncedAt: "2026-07-20T00:00:00.000Z",
    };
    status.execution_sub_lanes = {
      contracts: {
        machine_lane: "contracts",
        owner: "codex",
        status: "ready",
        branch: "codex/contracts/compatibility-issue-drift",
        depends_on: [],
        handoff: "handoffs/codex-contracts.md",
        linear: { sync: true, issue: "PRD-1301", parentIssue: "PRD-1300" },
        linear_issues: ["PRD-1300"],
      },
    };
    writeStatus(root, "active", "compatibility-issue-drift", status);

    const result = runPlanHub(root, ["validate"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /linear_issues must include linear\.issue PRD-1301/);
  }));

test("parent-only mode remains authoritative when execution sub-lanes are present", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "parent-only-execution", "--stage", "active"]).status, 0);
    const status = readStatus(root, "active", "parent-only-execution");
    status.linear = {
      parentIssue: "PRD-1010",
      project: "Compatibility Project",
      syncDirection: "plans_to_linear_visibility",
      laneSyncMode: "parent_only",
      lastSyncedAt: "2026-07-20T00:00:00.000Z",
    };
    status.execution_sub_lanes = {
      contracts: {
        machine_lane: "contracts",
        owner: "codex",
        status: "ready",
        branch: "codex/contracts/parent-only-execution",
        depends_on: [],
        handoff: "handoffs/codex-contracts.md",
        linear: { sync: true, issue: "PRD-1011", parentIssue: "PRD-1010" },
      },
    };
    writeStatus(root, "active", "parent-only-execution", status);

    const result = runPlanHub(root, ["linear-sync", "--feature", "parent-only-execution", "--json"]);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout).lanes, []);
  }));

test("linear lane sync mode must be recognized", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "bad-linear-mode", "--stage", "active"]).status, 0);
    const status = readStatus(root, "active", "bad-linear-mode");
    status.linear = {
      parentIssue: "PRD-901",
      syncDirection: "plans_to_linear_visibility",
      laneSyncMode: "compact",
      lastSyncedAt: "2026-07-06T00:00:00.000Z",
    };
    writeStatus(root, "active", "bad-linear-mode", status);

    const result = runPlanHub(root, ["validate"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /linear.laneSyncMode/);
  }));

test("validate fails when a referenced lane handoff file is missing", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "missing-handoff", "--stage", "active"]).status, 0);
    rmSync(join(root, ".plans", "active", "missing-handoff", "handoffs", "codex-contracts.md"));

    const result = runPlanHub(root, ["validate"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /lane "contracts" handoff file is missing: handoffs\/codex-contracts.md/);
  }));

test("validate rejects loose files and directories without status metadata", () =>
  withFixture((root) => {
    mkdirSync(join(root, ".plans", "ideas", "untracked-idea"), { recursive: true });
    writeFileSync(join(root, ".plans", "ideas", "untracked-idea", "brief.md"), "# Untracked idea\n");
    mkdirSync(join(root, ".plans", "backlog"), { recursive: true });
    writeFileSync(join(root, ".plans", "backlog", "loose-plan.md"), "# Loose plan\n");

    const result = runPlanHub(root, ["validate"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /untracked-idea: missing status\.json/);
    assert.match(result.stderr, /loose-plan\.md: unsupported loose file/);
  }));

test("validate requires the four canonical plan document roles", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "missing-core-role", "--stage", "backlog"]).status, 0);
    const status = readStatus(root, "backlog", "missing-core-role");
    delete status.links.eval;
    writeStatus(root, "backlog", "missing-core-role", status);

    const result = runPlanHub(root, ["validate"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /links\.eval is required/);
  }));

test("archive moves record explicit closeout metadata and remain valid", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "closed-fixture", "--stage", "active"]).status, 0);
    const reportDir = join(root, ".plans", "active", "closed-fixture", "reports");
    const reportContents =
      "# Review 2026-08-11\n\nImmutable evidence containing a rejected fixture:\n\n```yaml\nroot:\n  - valid\n    - invalid\n```\n";
    mkdirSync(reportDir, { recursive: true });
    writeFileSync(join(reportDir, "review-2026-08-11.md"), reportContents);
    const activeStatus = readStatus(root, "active", "closed-fixture");
    activeStatus.links.review = "reports/review-2026-08-11.md";
    writeStatus(root, "active", "closed-fixture", activeStatus);

    const moved = runPlanHub(root, [
      "move",
      "--feature",
      "closed-fixture",
      "--to",
      "archive",
      "--resolution",
      "closed_stale",
      "--reason",
      "No remaining live scope.",
    ]);
    assert.equal(moved.status, 0, moved.stderr);

    const status = readStatus(root, "archive", "closed-fixture");
    assert.equal(status.feature.stage, "archive");
    assert.equal(status.workflow.overall_status, "done");
    assert.equal(status.workflow.resolution, "closed_stale");
    assert.equal(status.workflow.archive_reason, "No remaining live scope.");
    assert.ok(!Number.isNaN(Date.parse(status.workflow.archived_at)));
    assert.deepEqual(Object.keys(status.lanes.ui).sort(), ["owner", "status"]);
    assert.equal(status.history.length, 1);
    assert.equal(status.notes, undefined);
    assert.equal(existsSync(join(root, ".plans", "archive", "closed-fixture", "handoffs")), false);
    assert.equal(
      readFileSync(
        join(root, ".plans", "archive", "closed-fixture", "reports", "review-2026-08-11.md"),
        "utf8",
      ),
      reportContents,
    );
    assert.match(
      readFileSync(join(root, ".plans", "archive", "closed-fixture", "brief.md"), "utf8"),
      /> \*\*Archived record:\*\* implementation is closed\./,
    );
    assert.equal(runPlanHub(root, ["validate"]).status, 0);
  }));

test("archive moves reject completed resolution until every lane is terminal", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "incomplete-fixture", "--stage", "active"]).status, 0);

    const rejected = runPlanHub(root, [
      "move",
      "--feature",
      "incomplete-fixture",
      "--to",
      "archive",
      "--resolution",
      "completed",
      "--reason",
      "Claimed complete.",
    ]);

    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /archive resolution completed requires every lane to be terminal/);
    assert.equal(existsSync(join(root, ".plans", "active", "incomplete-fixture", "status.json")), true);
    assert.equal(existsSync(join(root, ".plans", "archive", "incomplete-fixture")), false);
    assert.equal(readStatus(root, "active", "incomplete-fixture").feature.stage, "active");
  }));

test("archive moves reject a malformed reports entry before mutation", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "malformed-reports", "--stage", "active"]).status, 0);
    writeFileSync(join(root, ".plans", "active", "malformed-reports", "reports"), "not a directory\n");

    const moved = runPlanHub(root, [
      "move",
      "--feature",
      "malformed-reports",
      "--to",
      "archive",
      "--resolution",
      "closed_stale",
      "--reason",
      "No remaining live scope.",
    ]);
    assert.notEqual(moved.status, 0);
    assert.match(moved.stderr, /reports must be a real directory inside the feature hub/);
    assert.equal(existsSync(join(root, ".plans", "active", "malformed-reports")), true);
    assert.equal(existsSync(join(root, ".plans", "archive", "malformed-reports")), false);
  }));

test("archive moves reject symlinked report directories", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "linked-reports", "--stage", "active"]).status, 0);
    const externalReports = join(root, "external-reports");
    mkdirSync(externalReports);
    symlinkSync(externalReports, join(root, ".plans", "active", "linked-reports", "reports"), "dir");

    const moved = runPlanHub(root, [
      "move",
      "--feature",
      "linked-reports",
      "--to",
      "archive",
      "--resolution",
      "closed_stale",
      "--reason",
      "No remaining live scope.",
    ]);
    assert.notEqual(moved.status, 0);
    assert.match(moved.stderr, /reports must be a real directory inside the feature hub/);
    assert.equal(existsSync(join(root, ".plans", "active", "linked-reports")), true);
  }));

test("compact-archive rejects a malformed reports entry before mutation", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "legacy-archive", "--stage", "active"]).status, 0);
    assert.equal(
      runPlanHub(root, [
        "move",
        "--feature",
        "legacy-archive",
        "--to",
        "archive",
        "--resolution",
        "closed_stale",
        "--reason",
        "No remaining live scope.",
      ]).status,
      0,
    );
    writeFileSync(join(root, ".plans", "archive", "legacy-archive", "reports"), "not a directory\n");

    const compacted = runPlanHub(root, ["compact-archive"]);
    assert.notEqual(compacted.status, 0);
    assert.match(compacted.stderr, /reports must be a real directory inside the feature hub/);
    assert.equal(
      readFileSync(join(root, ".plans", "archive", "legacy-archive", "reports"), "utf8"),
      "not a directory\n",
    );
  }));

test("validate rejects noncanonical files inside archived hubs", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "archive-residue", "--stage", "backlog"]).status, 0);
    assert.equal(
      runPlanHub(root, [
        "move",
        "--feature",
        "archive-residue",
        "--to",
        "archive",
        "--resolution",
        "closed",
      ]).status,
      0,
    );
    writeFileSync(join(root, ".plans", "archive", "archive-residue", "legacy-report.md"), "# Old report\n");

    const result = runPlanHub(root, ["validate"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /legacy-report\.md: archived hubs retain only status\.json/);
  }));

test("stale reports live hubs whose status has not been refreshed", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "old-fixture", "--stage", "backlog"]).status, 0);
    assert.equal(runPlanHub(root, ["scaffold", "fresh-fixture", "--stage", "backlog"]).status, 0);
    const oldStatus = readStatus(root, "backlog", "old-fixture");
    oldStatus.workflow.updated_at = "2020-01-01T00:00:00.000Z";
    writeStatus(root, "backlog", "old-fixture", oldStatus);

    const result = runPlanHub(root, ["stale", "--days", "14", "--json"]);
    assert.equal(result.status, 0, result.stderr);
    const records = JSON.parse(result.stdout);
    assert.deepEqual(records.map((record) => record.slug), ["old-fixture"]);
    assert.ok(records[0].age_days > 14);
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

test("record-linear records repeated execution sub-lane issue ids", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "record-execution-linear", "--stage", "active"]).status, 0);
    const status = readStatus(root, "active", "record-execution-linear");
    status.linear = {
      parentIssue: "PRD-1100",
      project: "Execution Project",
      syncDirection: "plans_to_linear_visibility",
      laneSyncMode: "lane_issues",
      lastSyncedAt: "2026-07-20T00:00:00.000Z",
    };
    status.execution_sub_lanes = {
      contracts: {
        machine_lane: "contracts",
        owner: "codex",
        status: "ready",
        branch: "codex/contracts/record-execution-linear",
        depends_on: [],
        handoff: "handoffs/codex-contracts.md",
        linear: { sync: true, issue: "PRD-1099", parentIssue: "PRD-1100" },
        linear_issues: ["PRD-1099", "PRD-1100", "PRD-1098"],
      },
      release_ops: {
        machine_lane: null,
        owner: "human",
        status: "blocked",
        blocked_reason: "Human release gate is closed.",
        branch: null,
        depends_on: ["contracts"],
        handoff: "handoffs/codex-state-api.md",
        linear: { sync: true, issue: null, parentIssue: null },
        linear_issues: [],
      },
    };
    writeStatus(root, "active", "record-execution-linear", status);

    const result = runPlanHub(root, [
      "record-linear",
      "--feature",
      "record-execution-linear",
      "--execution-lane",
      "contracts=PRD-1101",
      "--execution-lane",
      "release_ops=PRD-1102",
    ]);
    assert.equal(result.status, 0, result.stderr);

    const updated = readStatus(root, "active", "record-execution-linear");
    assert.equal(updated.execution_sub_lanes.contracts.linear.issue, "PRD-1101");
    assert.equal(updated.execution_sub_lanes.release_ops.linear.issue, "PRD-1102");
    assert.deepEqual(updated.execution_sub_lanes.contracts.linear_issues, ["PRD-1101", "PRD-1100", "PRD-1098"]);
    assert.deepEqual(updated.execution_sub_lanes.release_ops.linear_issues, ["PRD-1102"]);
    assert.equal(runPlanHub(root, ["validate"]).status, 0);
  }));

test("record-linear persists parent-only lane sync mode", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "parent-only-record-linear", "--stage", "active"]).status, 0);

    const result = runPlanHub(root, [
      "record-linear",
      "--feature",
      "parent-only-record-linear",
      "--parent",
      "PRD-910",
      "--lane-sync-mode",
      "parent_only",
    ]);
    assert.equal(result.status, 0, result.stderr);

    const status = readStatus(root, "active", "parent-only-record-linear");
    assert.equal(status.linear.parentIssue, "PRD-910");
    assert.equal(status.linear.laneSyncMode, "parent_only");

    const sync = runPlanHub(root, ["linear-sync", "--feature", "parent-only-record-linear", "--json"]);
    assert.equal(sync.status, 0, sync.stderr);
    const manifest = JSON.parse(sync.stdout);
    assert.equal(manifest.laneSyncMode, "parent_only");
    assert.deepEqual(manifest.lanes, []);
  }));

test("record-linear rejects lane ids while parent-only sync is effective", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "parent-only-lane-rejected", "--stage", "active"]).status, 0);
    const status = readStatus(root, "active", "parent-only-lane-rejected");
    status.linear = {
      parentIssue: "PRD-920",
      syncDirection: "plans_to_linear_visibility",
      laneSyncMode: "parent_only",
      lastSyncedAt: "2026-07-06T00:00:00.000Z",
    };
    writeStatus(root, "active", "parent-only-lane-rejected", status);

    const result = runPlanHub(root, [
      "record-linear",
      "--feature",
      "parent-only-lane-rejected",
      "--lane",
      "ui=PRD-921",
    ]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /cannot record lane issue IDs while linear\.laneSyncMode is parent_only/);
    assert.equal(existsSync(join(root, ".plans", "active", "parent-only-lane-rejected", ".status.lock")), false);

    const retry = runPlanHub(root, [
      "record-linear",
      "--feature",
      "parent-only-lane-rejected",
      "--parent",
      "PRD-922",
    ]);
    assert.equal(retry.status, 0, retry.stderr);
  }));

test("record-linear requires explicit lane issue mode to expand parent-only sync", () =>
  withFixture((root) => {
    assert.equal(runPlanHub(root, ["scaffold", "parent-only-lane-expanded", "--stage", "active"]).status, 0);
    const status = readStatus(root, "active", "parent-only-lane-expanded");
    status.linear = {
      parentIssue: "PRD-930",
      syncDirection: "plans_to_linear_visibility",
      laneSyncMode: "parent_only",
      lastSyncedAt: "2026-07-06T00:00:00.000Z",
    };
    writeStatus(root, "active", "parent-only-lane-expanded", status);

    const result = runPlanHub(root, [
      "record-linear",
      "--feature",
      "parent-only-lane-expanded",
      "--lane-sync-mode",
      "lane_issues",
      "--lane",
      "ui=PRD-931",
    ]);
    assert.equal(result.status, 0, result.stderr);

    const updated = readStatus(root, "active", "parent-only-lane-expanded");
    assert.equal(updated.linear.laneSyncMode, "lane_issues");
    assert.equal(updated.linear.lanes.ui.issue, "PRD-931");
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
