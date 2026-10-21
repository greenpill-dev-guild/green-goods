import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { alignPins, assertDependabotPr, git, manifestUpdates, prepareSync } from "./dependabot-sync.mjs";
import { publishSync } from "./dependabot-sync-publish.mjs";

const repository = "green-goods/example";
const rootManifest = { name: "fixture", overrides: { hono: "4.13.7", vite: "8.2.1" }, devDependencies: { vite: "8.2.1" }, scripts: { prepare: "must-not-execute" } };
const manifests = () => ({
  "package.json": structuredClone(rootManifest),
  "packages/agent/package.json": { dependencies: { hono: "4.13.7" } },
  "packages/client/package.json": { devDependencies: { vite: "8.2.1" } },
  "packages/admin/package.json": { devDependencies: { vite: "8.2.1" } },
});
const upgrade = (before, file, section, name, value) => {
  const after = structuredClone(before);
  after[file][section][name] = value;
  return after;
};
const prFor = (sha, baseSha = "b".repeat(40)) => ({ number: 42, state: "open", user: { login: "dependabot[bot]" }, head: { sha, ref: "dependabot/bun/hono-4.13.11", repo: { full_name: repository } }, base: { sha: baseSha, repo: { full_name: repository } } });

test("an Agent Hono upgrade updates the root override", () => {
  const before = manifests();
  const result = alignPins(before, upgrade(before, "packages/agent/package.json", "dependencies", "hono", "4.13.11"));
  assert.equal(result.manifests["package.json"].overrides.hono, "4.13.11");
  assert.equal(before["package.json"].overrides.hono, "4.13.7");
  assert.deepEqual(result.packages, ["hono"]);
});

test("a Vite upgrade aligns root and sibling pins while preserving independent lines and range prefixes", () => {
  const before = manifests();
  before["packages/admin/package.json"].devDependencies.vite = "~8.2.1";
  before["docs/package.json"] = { devDependencies: { vite: "^7.3.0" } };
  const { manifests: result } = alignPins(before, upgrade(before, "packages/client/package.json", "devDependencies", "vite", "8.2.4"));
  assert.equal(result["package.json"].overrides.vite, "8.2.4");
  assert.equal(result["package.json"].devDependencies.vite, "8.2.4");
  assert.equal(result["packages/admin/package.json"].devDependencies.vite, "~8.2.4");
  assert.equal(result["docs/package.json"].devDependencies.vite, "^7.3.0");
});

test("conflicting upgrades and root-pin downgrades fail instead of choosing a version", () => {
  const before = manifests();
  const after = upgrade(before, "packages/client/package.json", "devDependencies", "vite", "8.2.4");
  after["packages/admin/package.json"].devDependencies.vite = "8.2.5";
  assert.throws(() => alignPins(before, after), /Conflicting/);
  before["package.json"].overrides.vite = "8.2.6";
  assert.throws(() => alignPins(before, upgrade(before, "packages/client/package.json", "devDependencies", "vite", "8.2.4")), /downgrade/);
});

test("manifest edits reject scripts, additions, removals, URLs, prereleases and range changes", () => {
  const before = { scripts: { build: "safe" }, dependencies: { hono: "4.13.7" } };
  for (const after of [
    { ...before, scripts: { build: "unsafe" } },
    { ...before, dependencies: { hono: "4.13.7", extra: "1.0.0" } },
    { ...before, dependencies: {} },
    ...["https://example.com/package.tgz", "4.13.6", "4.14.0-beta.1", "^4.13.11"].map((hono) => ({ ...before, dependencies: { hono } })),
  ]) assert.throws(() => manifestUpdates(before, after));
  assert.deepEqual(manifestUpdates(before, structuredClone(before)), []);
});

test("only open same-repository Dependabot package PRs qualify", () => {
  const pr = prFor("a".repeat(40));
  assert.doesNotThrow(() => assertDependabotPr(pr, repository));
  for (const patch of [
    { state: "closed" }, { user: { login: "someone" } },
    { head: { ...pr.head, ref: "dependabot/github_actions/actions" } },
    { head: { ...pr.head, repo: { full_name: "fork/example" } } },
    { head: { ...pr.head, sha: "HEAD; unsafe" } },
  ]) assert.throws(() => assertDependabotPr({ ...pr, ...patch }, repository));
});

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "dependabot-sync-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const trustedRoot = join(directory, "trusted");
  const root = join(directory, "candidate");
  mkdirSync(trustedRoot);
  const write = (base, file, content) => {
    mkdirSync(resolve(base, file, ".."), { recursive: true });
    writeFileSync(resolve(base, file), content);
  };
  for (const [file, content] of Object.entries(manifests())) write(trustedRoot, file, `${JSON.stringify(content, null, 2)}\n`);
  write(trustedRoot, "bun.lock", "original lock\n");
  write(trustedRoot, "docs/generated.mdx", "---\ngenerator: scripts/docs/generate.mjs\n---\nold\n");
  write(trustedRoot, "scripts/docs/generate.mjs", `import fs from 'node:fs';
const output = '---\\ngenerator: scripts/docs/generate.mjs\\n---\\n' + fs.readFileSync('package.json', 'utf8');
if (process.argv.includes('--check')) { if (fs.readFileSync('docs/generated.mdx', 'utf8') !== output) process.exit(1); }
else fs.writeFileSync('docs/generated.mdx', output);
`);
  git(trustedRoot, "init", "-q");
  const commit = (base) => {
    git(base, "add", "--", "package.json", "packages", "bun.lock", "docs", "scripts");
    git(base, "-c", "commit.gpgsign=false", "-c", "user.name=Fixture", "-c", "user.email=fixture@example.com", "commit", "-qm", "fixture");
    return git(base, "rev-parse", "HEAD").trim();
  };
  const baseSha = commit(trustedRoot);
  execFileSync("git", ["clone", "-q", trustedRoot, root]);
  write(root, "packages/agent/package.json", JSON.stringify({ dependencies: { hono: "4.13.11" } }));
  let headSha = commit(root);
  const output = join(directory, "sync.json");
  const event = { repository: { full_name: repository }, pull_request: prFor(headSha, baseSha) };
  const commands = [];
  const run = (command, args, options) => {
    commands.push([command, ...args]);
    if (command === "node") execFileSync(command, args, options);
    else writeFileSync(join(root, "bun.lock"), "repaired lock\n");
  };
  return { root, trustedRoot, output, event, run, commands, commit, write, get headSha() { return headSha; }, prepare: () => prepareSync({ root, trustedRoot, output, event, run }), advance: () => { headSha = commit(root); event.pull_request.head.sha = headSha; } };
}

test("prepare repairs pins, root lock and generated docs, then becomes a no-op on its own commit", (t) => {
  const f = fixture(t);
  const bundle = f.prepare();
  assert.deepEqual(bundle.files.map((file) => file.path).sort(), ["bun.lock", "docs/generated.mdx", "package.json"]);
  assert.equal(JSON.parse(readFileSync(join(f.root, "package.json"))).overrides.hono, "4.13.11");
  assert.match(readFileSync(join(f.root, "docs/generated.mdx"), "utf8"), /4\.13\.11/);
  assert.deepEqual(f.commands.slice(0, 2), [["bun", "update", "--lockfile-only", "--ignore-scripts", "hono"], ["bun", "install", "--frozen-lockfile", "--ignore-scripts"]]);
  f.advance();
  assert.deepEqual(f.prepare().files, []);
});

test("prepare refuses unexpected PR code changes before invoking any toolchain command", (t) => {
  const f = fixture(t);
  f.write(f.root, "scripts/docs/generate.mjs", "throw new Error('untrusted');");
  f.advance();
  assert.throws(() => f.prepare(), /Unexpected PR change/);
  assert.deepEqual(f.commands, []);
});

test("prepare rejects a changed symlink rather than following it", (t) => {
  const f = fixture(t);
  rmSync(join(f.root, "bun.lock"));
  symlinkSync("package.json", join(f.root, "bun.lock"));
  f.advance();
  assert.throws(() => f.prepare(), /Unexpected PR change|Symlink/);
  assert.deepEqual(f.commands, []);
});

function api(f, overrides = {}) {
  const calls = [];
  const edge = (name, result) => async (input) => { calls.push([name, input]); return { data: result }; };
  const github = { rest: {
    pulls: { get: edge("get", f.event.pull_request) },
    repos: { getContent: async ({ path }) => ({ data: { type: "file", encoding: "base64", content: Buffer.from(git(f.root, "show", `${f.headSha}:${path}`)).toString("base64") } }) },
    git: {
      getCommit: edge("parent", { tree: { sha: "original-tree" } }), createBlob: edge("blob", { sha: "blob" }),
      createTree: edge("tree", { sha: "new-tree" }), createCommit: edge("commit", { sha: "new-commit" }),
      updateRef: edge("ref", {}), ...overrides,
    },
  } };
  return { github, calls, publish: (bundle) => publishSync({ github, repository, number: 42, bundle, trustedRoot: f.trustedRoot }) };
}

test("publisher builds a commit on the prepared SHA and uses a non-forced ref update", async (t) => {
  const f = fixture(t);
  const bundle = f.prepare();
  const edge = api(f);
  const result = await edge.publish(bundle);
  assert.equal(result.sha, "new-commit");
  assert.deepEqual(edge.calls.find(([name]) => name === "commit")[1].parents, [f.headSha]);
  assert.equal(edge.calls.find(([name]) => name === "tree")[1].base_tree, "original-tree");
  assert.deepEqual(edge.calls.at(-1), ["ref", { owner: "green-goods", repo: "example", ref: f.event.pull_request.head.ref.replace(/^/, "heads/"), sha: "new-commit", force: false }]);
});

test("stale heads and empty repairs make no write calls", async (t) => {
  const f = fixture(t);
  const bundle = f.prepare();
  const edge = api(f);
  assert.match((await edge.publish({ ...bundle, headSha: "c".repeat(40) })).skipped, /head changed/);
  assert.equal((await edge.publish({ ...bundle, files: [] })).skipped, "Already synchronized");
  assert.ok(edge.calls.every(([name]) => name === "get"));
});

test("publisher rejects foreign artifacts, path escapes, scripts in manifests and duplicate files before writes", async (t) => {
  const f = fixture(t);
  const bundle = f.prepare();
  const edge = api(f);
  const unsafeManifest = structuredClone(rootManifest);
  unsafeManifest.scripts.prepare = "unsafe";
  for (const tampered of [
    { ...bundle, repository: "other/repository" },
    { ...bundle, files: [{ path: "docs/../package.json", content: "" }] },
    { ...bundle, files: [{ path: "package.json", content: Buffer.from(JSON.stringify(unsafeManifest)).toString("base64") }] },
    { ...bundle, files: [bundle.files[0], bundle.files[0]] },
  ]) await assert.rejects(edge.publish(tampered));
  assert.ok(edge.calls.every(([name]) => name === "get"));
});

test("a concurrent ref update failure propagates without a force-push retry", async (t) => {
  const f = fixture(t);
  let attempts = 0;
  const edge = api(f, { updateRef: async ({ force }) => { attempts++; assert.equal(force, false); throw new Error("not fast forward"); } });
  await assert.rejects(edge.publish(f.prepare()), /not fast forward/);
  assert.equal(attempts, 1);
});

test("workflow isolates generation from publication and keeps frozen installation as the default", () => {
  const root = resolve(import.meta.dirname, "../..");
  const workflow = readFileSync(join(root, ".github/workflows/dependabot-sync.yml"), "utf8");
  const [prepare, publish] = workflow.split("  publish:\n");
  assert.match(workflow, /^permissions: \{\}$/m);
  assert.match(prepare, /permissions:\n      contents: read\n/);
  assert.doesNotMatch(prepare, /contents: write|secrets\./);
  assert.match(publish, /contents: write\n      pull-requests: read/);
  assert.match(publish, /ref: \$\{\{ github.event.pull_request.base.sha \}\}/);
  assert.doesNotMatch(publish, /head.sha|\brun:|setup-js/);
  assert.equal((workflow.match(/persist-credentials: false/g) ?? []).length, 3);
  const action = readFileSync(join(root, ".github/actions/setup-js/action.yml"), "utf8");
  assert.match(action, /install-dependencies:[\s\S]*default: "true"/);
  assert.match(action, /if: inputs.install-dependencies == 'true'[\s\S]*run: bun install --frozen-lockfile/);
  const dependabot = readFileSync(join(root, ".github/dependabot.yml"), "utf8");
  assert.match(dependabot, /package-ecosystem: bun[\s\S]*open-pull-requests-limit: 0/);
});
