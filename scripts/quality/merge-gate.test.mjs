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
  evaluate,
  globRegex,
  highestTier,
  loadMergePolicy,
  fetchCommit,
  main,
  markerCommentsKey,
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
    // Removing a link or submodule, or replacing one with a file, leaves it only in the base.
    [{ paths: ["docs/a.md"], baseModes: new Map([["docs/a.md", "120000"]]) }, "symlink docs/a.md"],
    [{ paths: ["vendor/lib"], baseModes: new Map([["vendor/lib", "160000"]]) }, "submodule vendor/lib"],
    [{ untraced: ["docs/gone.md"] }, "path in neither tree docs/gone.md"],
    [{ fork: true }, "a fork's pull request"],
    [{ truncated: true }, "more than 3000 files"],
    [{ unreadable: ["packages/shared/src/a.ts"] }, "unreadable Shared file packages/shared/src/a.ts"],
    [{ deletedMutation: ["packages/shared/src/send.ts"] }, "deleted mutation path packages/shared/src/send.ts"],
  ];
  for (const [input, reason] of cases) assert.deepEqual(change(input), { tier: "critical", reasons: [reason] });
});

test("only writers' visible markers naming the full head count", () => {
  const comment = (body, login = "writer") => ({ body, user: { login } });
  const canWrite = (login) => login === "writer";
  const none = { reviewed: false, fullGate: false };
  assert.deepEqual(markersFor([comment(`Review addressed.\nmerge-gate: reviewed ${HEAD}`)], HEAD, canWrite), { reviewed: true, fullGate: false });
  assert.deepEqual(markersFor([comment(`merge-gate: full-gate ${HEAD.toUpperCase()} receipts 5/5`)], HEAD, canWrite), { reviewed: false, fullGate: true });
  // A prefix can be ground onto another commit, so none counts, however long.
  assert.deepEqual(markersFor([comment(`merge-gate: reviewed ${HEAD.slice(0, 39)}`)], HEAD, canWrite), none);
  assert.deepEqual(markersFor([comment(`merge-gate: reviewed ${OTHER}`)], HEAD, canWrite), none);
  assert.deepEqual(markersFor([comment(`merge-gate: reviewed ${HEAD}`, "reader")], HEAD, canWrite), none);
  // Hidden from a reader: quoted, in code, in an HTML comment (an unclosed one too), in a fence that
  // a line with an info string cannot close or that lone CRs break, and after U+2028 on one line.
  const hidden = [
    `See merge-gate: reviewed ${HEAD}`,
    `> merge-gate: reviewed ${HEAD}`,
    `\`\`\`\nmerge-gate: reviewed ${HEAD}\n\`\`\``,
    `Note\r\`\`\`\rmerge-gate: reviewed ${HEAD}\r\`\`\``,
    `\`\`\`\n\`\`\`js\nmerge-gate: reviewed ${HEAD}`,
    `<!--\nmerge-gate: reviewed ${HEAD}\n-->`,
    `<!-- draft\nmerge-gate: reviewed ${HEAD}`,
    `See\u2028merge-gate: reviewed ${HEAD}`,
    "merge-gate: reviewed",
  ];
  for (const body of hidden) assert.deepEqual(markersFor([comment(body)], HEAD, canWrite), none, body);
});

test("only accounts that can push write proof, and a failed access lookup fails the run", async () => {
  const marker = (login) => ({ body: `merge-gate: reviewed ${HEAD}`, user: { login } });
  const comments = [marker("maintainer"), marker("custom-writer"), marker("member-reads"), marker("custom-reader"), { body: "Thanks!", user: { login: "chatty" } }];
  // GitHub's collaborator-permission response: a custom role keeps its base access in `permission`.
  const access = {
    maintainer: { role_name: "maintain", permission: "write" },
    "custom-writer": { role_name: "release-steward", permission: "write" },
    "member-reads": { role_name: "read", permission: "read" },
    "custom-reader": { role_name: "auditor", permission: "read" },
  };
  const asked = [];
  const accessOf = async (login) => {
    asked.push(login);
    if (login === "lookup-fails") throw new Error("HTTP 403");
    return access[login];
  };
  assert.deepEqual([...(await writersAmong(comments, accessOf))], ["maintainer", "custom-writer"]);
  assert.deepEqual(asked, ["maintainer", "custom-writer", "member-reads", "custom-reader"]);
  await assert.rejects(writersAmong([marker("lookup-fails")], accessOf), /HTTP 403/);
});

test("each tier waits for its own proof at the head, and a pending description always ends with it", () => {
  const none = { reviewed: false, fullGate: false };
  assert.equal(decide({ tier: "routine", reasons: [], markers: none, headSha: HEAD }).state, "success");
  assert.deepEqual(decide({ tier: "sensitive", reasons: ["sensitive path a"], markers: none, headSha: HEAD }), {
    state: "pending",
    description: `Sensitive (sensitive path a). Waits for a reviewed marker naming ${HEAD}.`,
    needed: [`merge-gate: reviewed ${HEAD}`],
  });
  assert.equal(decide({ tier: "sensitive", reasons: [], markers: { ...none, reviewed: true }, headSha: HEAD }).state, "success");
  // A long first reason is shortened; the count of the others and what the status waits for stay.
  const long = "critical path packages/shared/src/hooks/admin-ui/pool/useProtocolFundingOperationsController.ts";
  const critical = decide({ tier: "critical", reasons: [long, "symlink b"], markers: none, headSha: HEAD });
  assert.ok(critical.description.length <= 140, critical.description);
  assert.ok(critical.description.endsWith(` and 1 more). Waits for reviewed and full-gate markers naming ${HEAD}.`), critical.description);
  assert.deepEqual(critical.needed, [`merge-gate: reviewed ${HEAD}`, `merge-gate: full-gate ${HEAD}`]);
  assert.equal(decide({ tier: "critical", reasons: [], markers: { reviewed: true, fullGate: true }, headSha: HEAD }).state, "success");
  // A line break in a path never reaches a status, where it could start a workflow command.
  assert.doesNotMatch(decide({ tier: "critical", reasons: ["a\n::warning::b"], markers: none, headSha: HEAD }).description, /\n/);
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

test("a pull request is decided from the API and its commits: a removed link, a fork, and only writers' markers", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "gg-merge-gate-evaluate-"));
  try {
    const env = fixtureGitEnvironment();
    const git = (...args) => execFileSync("git", args, { cwd: root, env, encoding: "utf8" }).trim();
    git("init", "-q");
    mkdirSync(path.join(root, "docs"));
    writeFileSync(path.join(root, "docs/a.md"), "a\n");
    symlinkSync("a.md", path.join(root, "docs/link.md"));
    git("add", "--", "docs");
    git("commit", "-q", "-m", "base");
    const base = git("rev-parse", "HEAD");
    git("rm", "-q", "--", "docs/link.md");
    writeFileSync(path.join(root, "docs/a.md"), "b\n");
    git("commit", "-q", "-am", "head");
    const head = git("rev-parse", "HEAD");
    const comments = [
      { id: 1, updated_at: "t1", user: { login: "reader" }, body: `merge-gate: reviewed ${head}\nmerge-gate: full-gate ${head}` },
      { id: 2, updated_at: "t2", user: { login: "writer" }, body: `merge-gate: reviewed ${head}` },
    ];
    const access = { writer: { role_name: "write", permission: "write" }, reader: { role_name: "read", permission: "read" } };
    const github = async (route) => {
      if (route.startsWith("pulls/7/files")) return [{ filename: "docs/link.md", status: "removed" }, { filename: "docs/a.md", status: "modified" }];
      if (route.startsWith("compare/")) return { merge_base_commit: { sha: base } };
      if (route.startsWith("issues/7/comments")) return comments;
      const login = route.match(/^collaborators\/([^/]+)\/permission$/)?.[1];
      if (login) return access[login];
      throw new Error(`unexpected ${route}`);
    };
    const pull = (owner) => ({ number: 7, base: { sha: base, repo: { full_name: "o/r" } }, head: { sha: head, repo: { full_name: `${owner}/r` } } });
    const options = { github, cwd: root, env, policy };
    const removedLink = await evaluate(pull("o"), head, options);
    assert.ok(removedLink.reasons.includes("symlink docs/link.md"), removedLink.reasons.join("; "));
    // The reader's full-gate marker counts for nothing; the writer's reviewed marker counts.
    assert.deepEqual(removedLink.decision.needed, [`merge-gate: full-gate ${head}`]);
    comments.push({ id: 3, updated_at: "t3", user: { login: "writer" }, body: `merge-gate: full-gate ${head}` });
    assert.equal((await evaluate(pull("o"), head, options)).decision.state, "success");
    assert.ok((await evaluate(pull("fork"), head, options)).reasons.includes("a fork's pull request"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a run posts once for an open pull request into develop, unless its head or marker comments moved or nothing changed", async () => {
  const open = { number: 7, state: "open", base: { ref: "develop" }, head: { sha: HEAD } };
  const run = async ({ pulls, markerComments = [], statuses = [], state = "pending", exit = 0 }) => {
    const posted = [];
    let reads = 0;
    const answer = (value) => (value instanceof Error ? Promise.reject(value) : value);
    const github = async (route, request = {}) => {
      if (request.method === "POST") return void posted.push([route, request.body.state, request.body.context]);
      if (route === "pulls/7") return answer(pulls[Math.min(reads++, pulls.length - 1)]);
      if (route.startsWith("issues/7/comments")) return answer(markerComments);
      if (route.startsWith(`commits/${HEAD}/statuses`)) return answer(statuses);
      throw new Error(`unexpected ${route}`);
    };
    const decision = { state, description: `${state} for x.`, needed: [] };
    const deps = {
      env: { GITHUB_EVENT_NAME: "issue_comment" },
      event: { issue: { number: 7, pull_request: {} } },
      github,
      evaluate: async () => ({ decision, reasons: ["x"], commentsKey: markerCommentsKey([]) }),
      log: () => {},
      summary: () => {},
    };
    assert.equal(await main([], deps), exit);
    return posted;
  };
  assert.deepEqual(await run({ pulls: [open] }), [[`statuses/${HEAD}`, "pending", "Merge Gate"]]);
  assert.deepEqual(await run({ pulls: [{ ...open, base: { ref: "main" } }] }), []);
  assert.deepEqual(await run({ pulls: [{ ...open, state: "closed" }] }), []);
  assert.deepEqual(await run({ pulls: [open, { ...open, head: { sha: OTHER } }] }), []);
  assert.deepEqual(await run({ pulls: [open], markerComments: [{ id: 9, updated_at: "t", user: { login: "w" }, body: `merge-gate: reviewed ${HEAD}` }] }), []);
  assert.deepEqual(await run({ pulls: [open], statuses: [{ context: "Merge Gate", state: "pending", description: "pending for x." }] }), []);
  // A failed lookup confirms nothing: a hold still posts, so an older success cannot outlive its
  // proof, and a success is not posted.
  const lost = new Error("HTTP 502");
  assert.deepEqual(await run({ pulls: [open], statuses: lost }), [[`statuses/${HEAD}`, "pending", "Merge Gate"]]);
  assert.deepEqual(await run({ pulls: [open, lost] }), [[`statuses/${HEAD}`, "pending", "Merge Gate"]]);
  assert.deepEqual(await run({ pulls: [open], markerComments: lost, state: "success", exit: 2 }), []);
});
