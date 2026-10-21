import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { alignPins, assertActionUpdates, assertDependabotPr, git, manifestUpdates, prepareSync, publishSync, syncPublication } from "./dependabot-sync.mjs";

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
const runFor = (f) => ({ id: 55, event: "pull_request", status: "completed", conclusion: "success", name: "Dependabot Sync", path: ".github/workflows/dependabot-sync.yml", repository: { full_name: repository }, head_repository: { full_name: repository }, head_sha: f.headSha, head_branch: f.event.pull_request.head.ref, pull_requests: [{ number: 42 }] });

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

test("workspace upgrades preserve independent root direct pins without a global override", () => {
  for (const [rootVersion, file, previous, next] of [
    ["8.2.4", "docs/package.json", "7.3.0", "7.3.1"],
    ["7.3.0", "packages/client/package.json", "8.2.1", "8.2.4"],
  ]) {
    const before = manifests();
    delete before["package.json"].overrides.vite;
    before["package.json"].devDependencies.vite = rootVersion;
    before[file] = { devDependencies: { vite: `^${previous}` } };
    const result = alignPins(before, upgrade(before, file, "devDependencies", "vite", `^${next}`));
    assert.deepEqual(result.manifests["package.json"], before["package.json"]);
    assert.equal(result.manifests[file].devDependencies.vite, `^${next}`);
  }
});

test("global overrides cannot silently defeat a workspace upgrade on another major", () => {
  for (const section of ["overrides", "resolutions"]) {
    for (const rootVersion of ["2.55.0", "2.55.13", "4.0.0"]) {
      const before = { "package.json": { [section]: { viem: rootVersion } }, "packages/qa/package.json": { dependencies: { viem: "^2.55.0" } } };
      assert.throws(() => alignPins(before, upgrade(before, "packages/qa/package.json", "dependencies", "viem", "^3.0.0")), /maintainer alignment required/);
    }
  }
});

test("action updates accept pinned SHA replacements and reject executable or unpinned edits", () => {
  const before = `steps:\n  - uses: actions/checkout@${"a".repeat(40)}\n  - run: echo safe\n`;
  assert.doesNotThrow(() => assertActionUpdates(before, before.replace("a".repeat(40), "b".repeat(40))));
  for (const after of [before.replace("echo safe", "echo unsafe"), before.replace("actions/checkout", "other/action"), before.replace("a".repeat(40), "v5"), `${before}permissions: write-all\n`]) {
    assert.throws(() => assertActionUpdates(before, after), /Only pinned action commit updates/);
  }
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

test("only open same-repository Dependabot package and Actions PRs qualify", () => {
  const pr = prFor("a".repeat(40));
  assert.doesNotThrow(() => assertDependabotPr(pr, repository));
  assert.doesNotThrow(() => assertDependabotPr({ ...pr, head: { ...pr.head, ref: "dependabot/github_actions/actions" } }, repository));
  for (const patch of [
    { state: "closed" }, { user: { login: "someone" } },
    { head: { ...pr.head, ref: "dependabot/docker/image" } },
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
  write(trustedRoot, ".github/workflows/example.yml", `steps:\n  - uses: actions/checkout@${"a".repeat(40)}\n`);
  write(trustedRoot, "scripts/docs/generate.mjs", `import fs from 'node:fs';
const output = '---\\ngenerator: scripts/docs/generate.mjs\\n---\\n' + fs.readFileSync('package.json', 'utf8') + fs.readFileSync('.github/workflows/example.yml', 'utf8');
if (process.argv.includes('--check')) { if (fs.readFileSync('docs/generated.mdx', 'utf8') !== output) process.exit(1); }
else fs.writeFileSync('docs/generated.mdx', output);
`);
  git(trustedRoot, "init", "-q");
  const commit = (base) => {
    git(base, "add", "--", "package.json", "packages", "bun.lock", "docs", "scripts", ".github");
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
    else if (args[0] === "update") writeFileSync(join(root, "bun.lock"), "repaired lock\n");
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

test("an Actions PR repairs only docs and is idempotent after publication", async (t) => {
  const f = fixture(t);
  f.event.pull_request.head.ref = "dependabot/github_actions/group";
  f.write(f.root, "packages/agent/package.json", `${JSON.stringify(manifests()["packages/agent/package.json"], null, 2)}\n`);
  const workflow = readFileSync(join(f.root, ".github/workflows/example.yml"), "utf8");
  f.write(f.root, ".github/workflows/example.yml", workflow.replace("a".repeat(40), "b".repeat(40)));
  f.advance();
  const bundle = f.prepare();
  assert.deepEqual(bundle.files.map(file => file.path), ["docs/generated.mdx"]);
  assert.equal(f.commands[0][1], "install");
  const edge = api(f);
  assert.deepEqual(await syncPublication({ github: edge.github, repository, run: runFor(f) }), { number: 42, artifactId: 77 });
  assert.deepEqual((await edge.publish(bundle)).files, ["docs/generated.mdx"]);
  await assert.rejects(edge.publish({ ...bundle, files: [{ path: ".github/workflows/example.yml", content: Buffer.from(workflow).toString("base64") }] }), /Unexpected artifact file/);
  f.advance();
  assert.deepEqual(f.prepare().files, []);
});

test("Actions PRs reject shell changes before running the candidate toolchain", (t) => {
  const f = fixture(t);
  f.event.pull_request.head.ref = "dependabot/github_actions/group";
  f.write(f.root, "packages/agent/package.json", `${JSON.stringify(manifests()["packages/agent/package.json"], null, 2)}\n`);
  f.write(f.root, ".github/workflows/example.yml", `steps:\n  - uses: actions/checkout@${"b".repeat(40)}\n  - run: echo unsafe\n`);
  f.advance();
  assert.throws(() => f.prepare(), /Only pinned action commit updates/);
  assert.deepEqual(f.commands, []);
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
    actions: { listWorkflowRunArtifacts: edge("artifacts", { artifacts: [{ id: 77, name: "dependabot-sync", expired: false }] }) },
    repos: { getContent: async ({ path }) => ({ data: { type: "file", encoding: "base64", content: Buffer.from(git(f.root, "show", `${f.headSha}:${path}`)).toString("base64") } }) },
    git: {
      getCommit: edge("parent", { tree: { sha: "original-tree" } }), createBlob: edge("blob", { sha: "blob" }),
      createTree: edge("tree", { sha: "new-tree" }), createCommit: edge("commit", { sha: "new-commit" }),
      updateRef: edge("ref", {}), ...overrides,
    },
  } };
  return { github, calls, publish: (bundle, run = runFor(f)) => publishSync({ github, repository, run, bundle, trustedRoot: f.trustedRoot }) };
}

test("publication preflight binds the artifact to a successful same-repository PR run", async (t) => {
  const f = fixture(t);
  const edge = api(f);
  const run = runFor(f);
  for (const patch of [{ event: "push" }, { conclusion: "failure" }, { path: ".github/workflows/other.yml" }, { head_repository: { full_name: "fork/example" } }, { pull_requests: [] }]) {
    await assert.rejects(syncPublication({ github: edge.github, repository, run: { ...run, ...patch } }));
  }
  assert.deepEqual(edge.calls, []);
  assert.deepEqual(await syncPublication({ github: edge.github, repository, run }), { number: 42, artifactId: 77 });
  assert.equal(edge.calls.at(-1)[1].run_id, 55);
});

test("publication skips missing or expired repair artifacts and closed PRs", async (t) => {
  const f = fixture(t);
  const edge = api(f);
  const run = runFor(f);
  for (const artifacts of [[], [{ id: 77, name: "dependabot-sync", expired: true }]]) {
    edge.github.rest.actions.listWorkflowRunArtifacts = async () => ({ data: { artifacts } });
    assert.match((await syncPublication({ github: edge.github, repository, run })).skipped, /no repair artifact/);
  }
  f.event.pull_request.state = "closed";
  assert.match((await syncPublication({ github: edge.github, repository, run })).skipped, /no longer open/);
  assert.match((await edge.publish({ repository, number: 42, headSha: f.headSha, files: [] })).skipped, /no longer open/);
  assert.ok(edge.calls.every(([name]) => name === "get"));
});

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
  f.event.pull_request.head.sha = "c".repeat(40);
  assert.match((await edge.publish(bundle)).skipped, /head changed/);
  f.event.pull_request.head.sha = f.headSha;
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
    { ...bundle, number: 99 },
    { ...bundle, headSha: "c".repeat(40) },
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
  const prepare = readFileSync(join(root, ".github/workflows/dependabot-sync.yml"), "utf8");
  const publish = readFileSync(join(root, ".github/workflows/dependabot-sync-publish.yml"), "utf8");
  for (const source of [prepare, publish]) {
    assert.match(source, /^permissions: \{\}$/m);
    assert.doesNotMatch(source, /pull_request_target/);
    assert.match(source, /dependabot\/github_actions\//);
  }
  assert.match(prepare, /  pull_request:/);
  assert.match(prepare, /permissions:\n      contents: read\n/);
  assert.match(prepare, /changed: \$\{\{ steps.sync.outputs.changed \}\}/);
  assert.match(prepare, /name: Synchronized dependency files\n    needs: prepare\n    if: needs.prepare.outputs.changed == 'false'/);
  assert.doesNotMatch(prepare, /contents: write|secrets\./);
  assert.match(publish, /  workflow_run:\n    workflows: \[Dependabot Sync\]/);
  assert.match(publish, /contents: write\n      pull-requests: read/);
  assert.match(publish, /ref: \$\{\{ github.sha \}\}/);
  assert.match(publish, /run-id: \$\{\{ github.event.workflow_run.id \}\}/);
  assert.match(publish, /artifact-ids: \$\{\{ steps.origin.outputs.artifact-id \}\}/);
  assert.doesNotMatch(publish, /ref:.*(?:head\.sha|head_sha)|^\s+(?:-\s+)?run:|uses:.*setup-js/m);
  assert.equal((`${prepare}${publish}`.match(/persist-credentials: false/g) ?? []).length, 3);
  const action = readFileSync(join(root, ".github/actions/setup-js/action.yml"), "utf8");
  assert.match(action, /install-dependencies:[\s\S]*default: "true"/);
  assert.match(action, /if: inputs.install-dependencies == 'true'[\s\S]*run: bun install --frozen-lockfile/);
  const dependabot = readFileSync(join(root, ".github/dependabot.yml"), "utf8");
  assert.match(dependabot, /package-ecosystem: bun[\s\S]*open-pull-requests-limit: 0/);
});
