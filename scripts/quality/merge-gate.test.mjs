import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fixtureGitEnvironment } from "../lib/dev-shared.js";
import {
  GATE_CRITICAL_PATHS,
  classifyChange,
  decide,
  globRegex,
  highestTier,
  loadMergePolicy,
  fetchCommit,
  markersFor,
  writersAmong,
  materializeShared,
  policyTier,
  pullNumbers,
  treeEntries,
} from "./merge-gate.mjs";

const HEAD = "a".repeat(40);
const OTHER = "b".repeat(40);
const policy = {
  tiers: {
    critical: { paths: ["packages/contracts/src/**", ".github/workflows/release.yml"] },
    sensitive: { paths: [".github/**", "scripts/quality/**"] },
    routine: { paths: ["**"] },
  },
};
const change = (overrides) => classifyChange({ paths: [], modes: new Map(), selectorRisk: "routine", policy, ...overrides });

test("policy globs read as the check selector reads them", () => {
  assert.ok(globRegex("packages/contracts/src/**").test("packages/contracts/src/a/B.sol"));
  assert.ok(!globRegex("scripts/*.mjs").test("scripts/quality/a.mjs"));
  // A double star before a slash spans zero folders too, so the root manifest is a manifest.
  assert.ok(globRegex("**/package.json").test("package.json") && globRegex("**/package.json").test("packages/a/package.json"));
  assert.equal(policyTier(".github/workflows/release.yml", policy), "critical");
  assert.equal(policyTier(".github/workflows/admin.yml", policy), "sensitive");
  assert.equal(policyTier("docs/a.md", policy), "routine");
  assert.equal(policyTier("docs/a.md", { tiers: { routine: { paths: ["packages/**"] } } }), "critical");
  assert.equal(highestTier("routine", "sensitive"), "sensitive");
  assert.equal(highestTier("routine", "unknown"), "critical");
});

test("the highest of the selector, the policy and the gate's own list sets the tier", () => {
  assert.deepEqual(change({ paths: ["docs/a.md"] }), { tier: "routine", reasons: [] });
  assert.deepEqual(change({ paths: ["docs/a.md"], selectorRisk: "sensitive" }).tier, "sensitive");
  assert.deepEqual(change({ paths: [".github/workflows/admin.yml"] }), { tier: "sensitive", reasons: ["sensitive path .github/workflows/admin.yml"] });
  assert.equal(change({ paths: ["docs/a.md"], selectorRisk: "critical" }).tier, "critical");
  assert.equal(change({ paths: ["docs/a.md"], selectorRisk: undefined }).tier, "critical");
  for (const gateFile of GATE_CRITICAL_PATHS) assert.equal(change({ paths: [gateFile] }).tier, "critical", gateFile);
  // A rename lists both paths, so moving a critical file out of its folder stays critical.
  assert.equal(change({ paths: ["docs/B.sol", "packages/contracts/src/B.sol"] }).tier, "critical");
});

test("whatever the gate cannot classify is critical", () => {
  const cases = [
    [{ paths: ["docs/a.md"], modes: new Map([["docs/a.md", "120000"]]) }, "symlink docs/a.md"],
    [{ paths: ["vendor/lib"], modes: new Map([["vendor/lib", "160000"]]) }, "submodule vendor/lib"],
    [{ fork: true }, "a fork's pull request"],
    [{ truncated: true }, "more than 3000 files"],
    [{ unreadable: ["packages/shared/src/a.ts"] }, "unreadable Shared file packages/shared/src/a.ts"],
    [{ deletedMutation: ["packages/shared/src/send.ts"] }, "deleted mutation path packages/shared/src/send.ts"],
  ];
  for (const [input, reason] of cases) assert.deepEqual(change(input), { tier: "critical", reasons: [reason] });
});

test("only writers' visible markers naming the head count, by full SHA or a nine-character prefix", () => {
  const comment = (body, login = "writer") => ({ body, user: { login } });
  const canWrite = (login) => login === "writer";
  const none = { reviewed: false, fullGate: false };
  assert.deepEqual(markersFor([comment(`Review addressed.\nmerge-gate: reviewed ${HEAD}`)], HEAD, canWrite), { reviewed: true, fullGate: false });
  assert.deepEqual(markersFor([comment(`merge-gate: full-gate ${HEAD.slice(0, 9).toUpperCase()} receipts 5/5`)], HEAD, canWrite), { reviewed: false, fullGate: true });
  assert.deepEqual(markersFor([comment(`merge-gate: reviewed ${HEAD.slice(0, 8)}`)], HEAD, canWrite), none);
  assert.deepEqual(markersFor([comment(`merge-gate: reviewed ${OTHER}`)], HEAD, canWrite), none);
  assert.deepEqual(markersFor([comment(`merge-gate: reviewed ${HEAD}`, "reader")], HEAD, canWrite), none);
  const hidden = [`See merge-gate: reviewed ${HEAD}`, `> merge-gate: reviewed ${HEAD}`, `\`\`\`\nmerge-gate: reviewed ${HEAD}\n\`\`\``, `<!--\nmerge-gate: reviewed ${HEAD}\n-->`, "merge-gate: reviewed"];
  for (const body of hidden) assert.deepEqual(markersFor([comment(body)], HEAD, canWrite), none, body);
});

test("only accounts that can push write proof, and an unconfirmed account writes none", async () => {
  const comments = [
    { body: `merge-gate: reviewed ${HEAD}`, user: { login: "maintainer" } },
    { body: `merge-gate: reviewed ${HEAD}`, user: { login: "member-reads" } },
    { body: `merge-gate: reviewed ${HEAD}`, user: { login: "lookup-fails" } },
    { body: "Thanks!", user: { login: "chatty" } },
  ];
  const asked = [];
  const roleOf = async (login) => {
    asked.push(login);
    if (login === "lookup-fails") throw new Error("HTTP 403");
    return { maintainer: "maintain", "member-reads": "read" }[login];
  };
  assert.deepEqual([...(await writersAmong(comments, roleOf))], ["maintainer"]);
  assert.deepEqual(asked, ["maintainer", "member-reads", "lookup-fails"]);
});

test("each tier waits for its own proof at the head", () => {
  const none = { reviewed: false, fullGate: false };
  assert.equal(decide({ tier: "routine", reasons: [], markers: none, headSha: HEAD }).state, "success");
  const sensitive = decide({ tier: "sensitive", reasons: ["sensitive path a"], markers: none, headSha: HEAD });
  assert.equal(sensitive.state, "pending");
  assert.match(sensitive.description, /merge-gate: reviewed aaaaaaaaa/);
  assert.equal(decide({ tier: "sensitive", reasons: [], markers: { ...none, reviewed: true }, headSha: HEAD }).state, "success");
  const critical = decide({ tier: "critical", reasons: ["critical path a", "symlink b"], markers: { ...none, reviewed: true }, headSha: HEAD });
  assert.equal(critical.state, "pending");
  assert.match(critical.description, /critical path a and 1 more.*full-gate aaaaaaaaa/);
  assert.ok(critical.description.length <= 140);
  assert.equal(decide({ tier: "critical", reasons: [], markers: { reviewed: true, fullGate: true }, headSha: HEAD }).state, "success");
});

test("events name their open pull requests, a fork's by its head branch", async () => {
  const noLookup = () => assert.fail("no lookup expected");
  assert.deepEqual(await pullNumbers({ issue: { number: 7, pull_request: {} } }, "issue_comment", noLookup), [7]);
  assert.deepEqual(await pullNumbers({ issue: { number: 7 } }, "issue_comment", noLookup), []);
  const run = { event: "pull_request", head_sha: HEAD, head_branch: "fix", head_repository: { owner: { login: "someone" } } };
  assert.deepEqual(await pullNumbers({ workflow_run: { ...run, pull_requests: [{ number: 9 }] } }, "workflow_run", noLookup), [9]);
  assert.deepEqual(await pullNumbers({ workflow_run: { ...run, event: "push", pull_requests: [] } }, "workflow_run", noLookup), []);
  const lookup = async (head) => (head === "someone:fix" ? [{ number: 11, head: { sha: HEAD } }, { number: 12, head: { sha: OTHER } }] : []);
  assert.deepEqual(await pullNumbers({ workflow_run: { ...run, pull_requests: [] } }, "workflow_run", lookup), [11]);
});

test("the head's files come from the object store: export-ignore hides nothing, links and submodules stay out", () => {
  const root = mkdtempSync(path.join(tmpdir(), "gg-merge-gate-"));
  let sharedRoot;
  try {
    const env = fixtureGitEnvironment();
    const git = (...args) => execFileSync("git", args, { cwd: root, env, encoding: "utf8" });
    git("init", "-q");
    mkdirSync(path.join(root, "packages/shared/src"), { recursive: true });
    writeFileSync(path.join(root, "packages/shared/src/a.ts"), "export const a = 1;\n");
    writeFileSync(path.join(root, "packages/shared/src/hidden.ts"), "export const hidden = 1;\n");
    writeFileSync(path.join(root, ".gitattributes"), "packages/shared/src/hidden.ts export-ignore\n");
    symlinkSync("a.ts", path.join(root, "packages/shared/src/link.ts"));
    git("add", "--", ".gitattributes", "packages/shared/src");
    git("update-index", "--add", "--cacheinfo", `160000,${HEAD},packages/shared/vendor`);
    git("commit", "-q", "-m", "fixture");
    const sha = git("rev-parse", "HEAD").trim();
    const entries = treeEntries(sha, { cwd: root, env });
    assert.equal(entries.get("packages/shared/src/link.ts").mode, "120000");
    assert.equal(entries.get("packages/shared/vendor").mode, "160000");
    sharedRoot = materializeShared(entries, { cwd: root, env });
    assert.equal(readFileSync(path.join(sharedRoot, "packages/shared/src/hidden.ts"), "utf8"), "export const hidden = 1;\n");
    assert.equal(readFileSync(path.join(sharedRoot, "packages/shared/src/a.ts"), "utf8"), "export const a = 1;\n");
    assert.ok(!existsSync(path.join(sharedRoot, "packages/shared/src/link.ts")));
    assert.ok(!existsSync(path.join(sharedRoot, "packages/shared/vendor")));
  } finally {
    rmSync(root, { recursive: true, force: true });
    if (sharedRoot) rmSync(sharedRoot, { recursive: true, force: true });
  }
});

test("the repository's merge policy reads as intended: release workflows critical, every manifest sensitive", () => {
  const repositoryPolicy = loadMergePolicy();
  assert.equal(policyTier(".github/workflows/release.yml", repositoryPolicy), "critical");
  assert.equal(policyTier("package.json", repositoryPolicy), "sensitive");
  assert.equal(policyTier("packages/admin/package.json", repositoryPolicy), "sensitive");
  assert.equal(policyTier("docs/docs/index.mdx", repositoryPolicy), "routine");
});

test("fetching a head never turns a full clone shallow", () => {
  const root = mkdtempSync(path.join(tmpdir(), "gg-merge-gate-fetch-"));
  try {
    const env = fixtureGitEnvironment();
    const git = (cwd, ...args) => execFileSync("git", args, { cwd, env, encoding: "utf8" }).trim();
    const origin = path.join(root, "origin");
    mkdirSync(origin);
    git(origin, "init", "-q");
    git(origin, "config", "uploadpack.allowAnySHA1InWant", "true");
    git(origin, "commit", "-q", "--allow-empty", "-m", "first");
    git(root, "clone", "-q", `file://${origin}`, "clone");
    const clone = path.join(root, "clone");
    fetchCommit(git(clone, "rev-parse", "HEAD"), { cwd: clone, env });
    git(origin, "commit", "-q", "--allow-empty", "-m", "second");
    const head = git(origin, "rev-parse", "HEAD");
    fetchCommit(head, { cwd: clone, env });
    assert.equal(git(clone, "rev-parse", "--is-shallow-repository"), "false");
    assert.equal(git(clone, "log", "--format=%s", head), "second\nfirst");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
