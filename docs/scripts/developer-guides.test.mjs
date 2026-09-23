import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { auditDeveloperGuides } from "./developer-guides.mjs";
import { resolveCommand } from "../../packages/contracts/script/cli/operations.mjs";

test("command admission rejects new root aliases and self-justifying ownership", async (t) => {
  const { auditCommandPolicy } = await import("./developer-guides.mjs");
  const root = fixture(t, "# Start\n");
  writeFileSync(path.join(root, "package.json"), JSON.stringify({ scripts: { check: "node check.js", shortcut: "bun run check --json" } }));
  writeFileSync(path.join(root, "scripts/data/command-policy.json"), JSON.stringify({ root: { check: { owner: "repo", purpose: "checks", consumer: "package.json" } }, packages: {} }));
  const issues = await auditCommandPolicy(root);
  assert.ok(issues.some((item) => item.message.includes("Unregistered")));
  assert.ok(issues.some((item) => item.message.includes("Plain forwarding")));
  assert.ok(issues.some((item) => item.message.includes("independent purpose")));
});

test("command admission rejects restored variants and permits documented exceptions", async (t) => {
  const { auditCommandPolicy } = await import("./developer-guides.mjs");
  const root = fixture(t, "# Start\n");
  writeFileSync(path.join(root, "package.json"), JSON.stringify({ scripts: { test: "node test.js", fast: "node test.js --fast" } }));
  writeFileSync(path.join(root, "scripts/data/command-policy.json"), JSON.stringify({ root: { test: { owner: "repo", purpose: "tests", consumer: "CI" }, fast: { owner: "repo", purpose: "iteration", consumer: "CI" } }, packages: {} }));
  writeFileSync(path.join(root, "scripts/data/command-migration.json"), JSON.stringify({ replacements: { "package.json": { fast: "bun run test --fast" } } }));
  const issues = await auditCommandPolicy(root);
  assert.ok(issues.some((item) => item.message.includes("Option-only")));
  assert.ok(issues.some((item) => item.message.includes("Retired alias")));
});

function fixture(t, markdown) {
  const root = mkdtempSync(path.join(tmpdir(), "gg-guide-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, "packages/client"), { recursive: true });
  mkdirSync(path.join(root, "scripts/data"), { recursive: true });
  writeFileSync(path.join(root, "README.md"), markdown);
  writeFileSync(path.join(root, "package.json"), JSON.stringify({ scripts: { dev: "launcher", "dev:health": "health", check: "selector" } }));
  writeFileSync(path.join(root, "packages/client/package.json"), JSON.stringify({ scripts: { test: "runner" } }));
  writeFileSync(path.join(root, "scripts/data/validation-policy.json"), JSON.stringify({ intentOrder: ["qa", "push"] }));
  return root;
}

test("accepts a concise guide and commands in explicit package cwd", async (t) => {
  const root = fixture(t, '# Green Goods\n[Tests](packages/client/README.md#focused-tests)\n```bash\nbun run --cwd packages/client test src/a.test.ts\nbun run check --plan -- --intent qa\n```\n');
  writeFileSync(path.join(root, "packages/client/README.md"), "# Client\n## Focused tests\n");
  assert.deepEqual(await auditDeveloperGuides(root), []);
});

test("rejects a removed alias and a command in the wrong working directory", async (t) => {
  const root = fixture(t, '`bun run dev:fork`\n```bash\ncd packages/client\nbun run dev\n```\n');
  const issues = await auditDeveloperGuides(root);
  assert.equal(issues.filter((issue) => /Unknown documented command/.test(issue.message)).length, 2);
});

test("rejects missing guides and anchors", async (t) => {
  const root = fixture(t, '# Start\n[Missing](ONBOARDING.md)\n[Bad heading](#setup)\n');
  assert.deepEqual((await auditDeveloperGuides(root)).map((issue) => issue.message), [
    "Local guide target not found: ONBOARDING.md",
    "Local guide anchor not found: #setup",
  ]);
});

test("rejects invalid intents, unknown modes and stale mode membership", async (t) => {
  const root = fixture(t, '`bun run check --plan -- --intent potato`\n`bun run dev:health -- hosted`\n| local | admin, client, agent, indexer, anvil-arbitrum | Live |\n');
  const issues = await auditDeveloperGuides(root);
  assert.equal(issues.length, 3);
  assert.ok(issues.some((issue) => issue.message.includes("membership")));
});

test("validates concrete contract examples with the package-owned resolver", async (t) => {
  const root = fixture(t, '`bun run contracts -- deploy core --network arbitrum --mode potato`\n');
  writeFileSync(path.join(root, "package.json"), JSON.stringify({ scripts: { contracts: "cli" } }));
  let received;
  const issues = await auditDeveloperGuides(root, undefined, { resolveContracts(args) { received = args; throw new Error("Unsupported mode potato"); } });
  assert.deepEqual(received, ["deploy", "core", "--network", "arbitrum", "--mode", "potato"]);
  assert.match(issues[0].message, /Invalid documented contract operation.*Unsupported mode/);
});

test("checks removed aliases selected through workflow matrix values", async (t) => {
  const { auditWorkflowCommands } = await import("./developer-guides.mjs");
  const root = fixture(t, "# Start\n");
  mkdirSync(path.join(root, ".github/workflows"), { recursive: true });
  writeFileSync(path.join(root, ".github/workflows/tests.yml"), `jobs:
  tests:
    defaults:
      run:
        working-directory: packages/\${{ matrix.package }}
    strategy:
      matrix:
        include:
          - script: test
            package: client
          - script: test:retired
            package: client
    steps:
      - run: bun run \${{ matrix.script }}
`);
  assert.deepEqual(await auditWorkflowCommands(root), [{ filePath: ".github/workflows/tests.yml", message: "Unknown workflow command test:retired in packages/client" }]);
});

test("workflow commands honor explicit package cwd and distinguish shell arguments", async (t) => {
  const { auditWorkflowCommands } = await import("./developer-guides.mjs");
  const root = fixture(t, "# Start\n");
  mkdirSync(path.join(root, ".github/workflows"), { recursive: true });
  writeFileSync(path.join(root, ".github/workflows/tests.yml"), `jobs:
  tests:
    steps:
      - run: bun run --cwd packages/client test src/a.test.ts
      - run: bun run test
`);
  assert.deepEqual(await auditWorkflowCommands(root), [{ filePath: ".github/workflows/tests.yml", message: "Unknown workflow command test in root" }]);
});

test("contract documentation uses real CLI target, mode and flag validation", async (t) => {
  const root = fixture(t, [
    '`bun run contracts -- deploy core --network arbitrum --mode preflight --explain`',
    '`bun run contracts -- upgrade hats-module --network arbitrum --mode potato`',
    '`bun run contracts -- deploy unknown --network arbitrum --mode preflight`',
    '`bun run contracts -- verify --network arbitrum --invented-flag`',
  ].join("\n"));
  writeFileSync(path.join(root, "package.json"), JSON.stringify({ scripts: { contracts: "cli" } }));
  const issues = await auditDeveloperGuides(root, undefined, { resolveContracts: resolveCommand });
  assert.equal(issues.length, 3);
  assert.ok(issues.every((issue) => issue.message.startsWith("Invalid documented contract operation")));
});


test("retired caller audit catches source argv and aliases without matching filenames or history", async (t) => {
  const { auditRetiredCommandCallers } = await import("./developer-guides.mjs");
  const root = fixture(t, "# Start\n");
  mkdirSync(path.join(root, "packages/contracts/config"), { recursive: true });
  writeFileSync(path.join(root, "packages/contracts/config/command-migration.json"), JSON.stringify({ entries: [
    { scope: "contracts", name: "deploy" }, { scope: "root", name: "contracts:old" },
  ] }));
  writeFileSync(path.join(root, "caller.mjs"), "// bun deploy.ts core\n// bun run contracts:old\nconst args = ['run', '--cwd', 'packages/contracts', 'deploy'];\n");
  writeFileSync(path.join(root, "policy.json"), JSON.stringify({ command: "bun run contracts:old", other: "bun run --cwd packages/client nonexistent" }));
  mkdirSync(path.join(root, "packages/contracts/config/releases"), { recursive: true });
  writeFileSync(path.join(root, "packages/contracts/config/releases/execution-2026-09-13.json"), JSON.stringify({ command: "bun run contracts:old" }));
  const issues = await auditRetiredCommandCallers(root, [
    "caller.mjs",
    "policy.json",
    ".plans/missing/historical.md",
    "packages/contracts/config/releases/execution-2026-09-13.json",
  ]);
  assert.equal(issues.length, 4);
  assert.ok(issues.some((issue) => issue.message.includes("Unknown package caller")));
  assert.ok(issues.some((issue) => issue.message.includes("contracts:old")));
  assert.ok(issues.some((issue) => issue.message.includes("deploy at line 3")));
});

test("retired caller audit catches a caller outside the package that owned the command", async (t) => {
  const { auditRetiredCommandCallers } = await import("./developer-guides.mjs");
  const root = fixture(t, "# Start\n");
  mkdirSync(path.join(root, "packages/contracts/config"), { recursive: true });
  mkdirSync(path.join(root, "packages/shared"), { recursive: true });
  writeFileSync(path.join(root, "packages/contracts/config/command-migration.json"), JSON.stringify({ entries: [] }));
  // Retired from the shared package but called from a root-level runner: the
  // caller's own manifest is package.json, so only the dead-everywhere rule sees it.
  writeFileSync(path.join(root, "scripts/data/command-migration.json"), JSON.stringify({
    replacements: { "packages/shared/package.json": { "storybook:prepare": "node .storybook/prepare.mjs" } },
  }));
  writeFileSync(path.join(root, "packages/shared/package.json"), JSON.stringify({ scripts: {} }));
  writeFileSync(path.join(root, "runner.mjs"), "spawnSync('bun', ['run', 'storybook:prepare']);\n");
  const issues = await auditRetiredCommandCallers(root, ["runner.mjs"]);
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /storybook:prepare/);
});

test("retired caller audit leaves a name another package still defines alone", async (t) => {
  const { auditRetiredCommandCallers } = await import("./developer-guides.mjs");
  const root = fixture(t, "# Start\n");
  mkdirSync(path.join(root, "packages/contracts/config"), { recursive: true });
  mkdirSync(path.join(root, "packages/shared"), { recursive: true });
  writeFileSync(path.join(root, "packages/contracts/config/command-migration.json"), JSON.stringify({ entries: [] }));
  writeFileSync(path.join(root, "scripts/data/command-migration.json"), JSON.stringify({
    replacements: { "packages/shared/package.json": { lint: "bun run check --only lint" } },
  }));
  // packages/client still defines lint, so a bare caller is not provably dead.
  writeFileSync(path.join(root, "packages/client/package.json"), JSON.stringify({ scripts: { lint: "oxlint" } }));
  writeFileSync(path.join(root, "runner.mjs"), "spawnSync('bun', ['run', 'lint']);\n");
  assert.deepEqual(await auditRetiredCommandCallers(root, ["runner.mjs"]), []);
});

test("retired caller audit includes the repository-wide replacement ledger", async (t) => {
  const { auditRetiredCommandCallers } = await import("./developer-guides.mjs");
  const root = fixture(t, "# Start\n");
  mkdirSync(path.join(root, "packages/contracts/config"), { recursive: true });
  writeFileSync(path.join(root, "packages/contracts/config/command-migration.json"), JSON.stringify({ entries: [] }));
  writeFileSync(path.join(root, "scripts/data/command-migration.json"), JSON.stringify({ replacements: { "package.json": { "test:cache": "bun run test --cache" } } }));
  writeFileSync(path.join(root, "caller.mjs"), "const command = 'bun run test:cache';\n");
  const issues = await auditRetiredCommandCallers(root, ["caller.mjs"]);
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /test:cache/);
});
