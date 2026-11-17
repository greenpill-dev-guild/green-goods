import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fixtureGitEnvironment } from "../lib/dev-shared.js";
import {
  GATE_CRITICAL_PATHS,
  GATE_INPUT_PATHS,
  classifyChange,
  decide,
  evaluate,
  globRegex,
  highestTier,
  loadMergePolicy,
  fetchCommit,
  main,
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
  // A lone CR breaks a line, so a marker after one counts.
  assert.deepEqual(markersFor([comment(`Done.\rmerge-gate: reviewed ${HEAD}`)], HEAD, canWrite), { reviewed: true, fullGate: false });
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
    `\`\`\`\nmerge-gate: reviewed ${HEAD}\n    \`\`\`\nmerge-gate: reviewed ${HEAD}`,
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
  // A push to develop that changes the gate's inputs decides every open pull request again.
  assert.deepEqual(await pullNumbers({ ref: "refs/heads/develop" }, "push", noLookup, async () => [3, 5]), [3, 5]);
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
  // Build configuration that changes compiled contracts is critical; other lockfiles and tool config are sensitive.
  for (const path of ["packages/contracts/foundry.toml", "packages/contracts/remappings.txt", ".gitmodules"]) assert.equal(policyTier(path, repositoryPolicy), "critical", path);
  // So are the production Agent's deploy and the other build and deploy inputs.
  const sensitive = ["packages/contracts/foundry.lock", "bunfig.toml", "packages/agent/bunfig.toml", "turbo.json", "packages/client/vitest.config.ts", ".oxlintrc.json"];
  sensitive.push("fly.toml", "packages/agent/Dockerfile", "packages/client/vercel.json", "packages/shared/tsconfig.json", "env.schema", ".husky/pre-push", "scripts/ops/vercel-ignore.mjs");
  for (const path of sensitive) {
    assert.equal(policyTier(path, repositoryPolicy), "sensitive", path);
  }
  assert.deepEqual(repositoryPolicy.requiredChecks, ["CI Gate", "Merge Gate"]);
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

test("a run posts once for an open pull request into develop, unless its head or a writer's marker moved or nothing changed", async () => {
  const open = { number: 7, state: "open", base: { ref: "develop" }, head: { sha: HEAD } };
  const access = { writer: { role_name: "write", permission: "write" }, outsider: { role_name: "read", permission: "read" } };
  const run = async ({ pulls, markerComments = [], statuses = [], state = "pending", exit = 0 }) => {
    const posted = [];
    let reads = 0;
    const answer = (value) => (value instanceof Error ? Promise.reject(value) : value);
    const github = async (route, request = {}) => {
      if (request.method === "POST") return void posted.push([route, request.body.state, request.body.context]);
      if (route === "pulls/7") return answer(pulls[Math.min(reads++, pulls.length - 1)]);
      if (route.startsWith("issues/7/comments")) return answer(markerComments);
      if (route.startsWith(`commits/${HEAD}/statuses`)) return answer(statuses);
      const login = route.match(/^collaborators\/([^/]+)\/permission$/)?.[1];
      if (login) return access[login] ?? Promise.reject(Object.assign(new Error("HTTP 404"), { status: 404 }));
      throw new Error(`unexpected ${route}`);
    };
    const decision = { state, description: `${state} for x.`, needed: [] };
    const deps = {
      env: { GITHUB_EVENT_NAME: "issue_comment" },
      event: { issue: { number: 7, pull_request: {} } },
      github,
      evaluate: async () => ({ decision, reasons: ["x"], markers: { reviewed: false, fullGate: false }, authors: new Set(), writers: new Set() }),
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
  const marker = (login) => ({ id: 9, updated_at: "t", user: { login }, body: `merge-gate: reviewed ${HEAD}` });
  // A writer's new marker changes what the run read, so the run it starts decides instead.
  assert.deepEqual(await run({ pulls: [open], markerComments: [marker("writer")] }), []);
  // Nobody else's comments can stop a post, nor can a login GitHub does not know.
  assert.deepEqual(await run({ pulls: [open], markerComments: [marker("outsider")] }), [[`statuses/${HEAD}`, "pending", "Merge Gate"]]);
  assert.deepEqual(await run({ pulls: [open], markerComments: [marker("gone")], state: "success" }), [[`statuses/${HEAD}`, "success", "Merge Gate"]]);
  assert.deepEqual(await run({ pulls: [open], statuses: [{ context: "Merge Gate", state: "pending", description: "pending for x." }] }), []);
  // A failed lookup confirms nothing: a hold still posts, so an older success cannot outlive its
  // proof, and a success is not posted.
  const lost = new Error("HTTP 502");
  assert.deepEqual(await run({ pulls: [open], statuses: lost }), [[`statuses/${HEAD}`, "pending", "Merge Gate"]]);
  assert.deepEqual(await run({ pulls: [open, lost] }), [[`statuses/${HEAD}`, "pending", "Merge Gate"]]);
  assert.deepEqual(await run({ pulls: [open], markerComments: lost, state: "success", exit: 2 }), []);
});

test("evaluate reads every classification input: the merge base, Shared mutation, deletions, refusals and limits", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "gg-merge-gate-inputs-"));
  try {
    const env = fixtureGitEnvironment();
    const git = (...args) => execFileSync("git", args, { cwd: root, env, encoding: "utf8" }).trim();
    const write = (file, text) => {
      mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      writeFileSync(path.join(root, file), text);
    };
    const signing = 'import { writeContract } from "@wagmi/core";\nexport const pay = () => writeContract({});\n';
    git("init", "-q");
    write("docs/a.md", "a\n");
    symlinkSync("a.md", path.join(root, "docs/link.md"));
    write("packages/shared/src/utils/send.ts", signing);
    git("add", "--", "docs", "packages");
    git("commit", "-q", "-m", "merge base");
    const mergeBase = git("rev-parse", "HEAD");
    // Develop moves on and turns the link into a file, so only the merge base shows it as one.
    git("rm", "-q", "--", "docs/link.md");
    write("docs/link.md", "now a file\n");
    git("add", "--", "docs/link.md");
    git("commit", "-q", "-m", "develop");
    const baseTip = git("rev-parse", "HEAD");
    git("checkout", "-q", mergeBase);
    git("rm", "-q", "--", "docs/link.md", "packages/shared/src/utils/send.ts");
    write("packages/shared/src/utils/pay.ts", signing);
    git("add", "--", "packages");
    git("commit", "-q", "-m", "head");
    const head = git("rev-parse", "HEAD");
    const pull = { number: 7, base: { sha: baseTip, repo: { full_name: "o/r" } }, head: { sha: head, repo: { full_name: "o/r" } } };
    const decideFiles = async (files) => {
      const github = async (route) => {
        if (route.startsWith("pulls/7/files")) {
          const page = Number(route.match(/[?&]page=(\d+)/)[1]);
          return files.slice((page - 1) * 100, page * 100);
        }
        if (route.startsWith(`compare/${baseTip}...${head}`)) return { merge_base_commit: { sha: mergeBase } };
        if (route.startsWith("issues/7/comments")) return [];
        throw new Error(`unexpected ${route}`);
      };
      return (await evaluate(pull, head, { github, cwd: root, env, policy })).reasons;
    };
    const removed = (filename) => ({ filename, status: "removed" });
    const reasons = await decideFiles([removed("docs/link.md"), removed("packages/shared/src/utils/send.ts"), removed("docs/ghost.md")]);
    assert.ok(reasons.includes("symlink docs/link.md"), reasons.join("; "));
    assert.ok(reasons.includes("deleted mutation path packages/shared/src/utils/send.ts"), reasons.join("; "));
    assert.ok(reasons.includes("path in neither tree docs/ghost.md"), reasons.join("; "));
    // A changed Shared file that reaches a signing primitive makes the selector's risk critical.
    assert.equal((await decideFiles([{ filename: "packages/shared/src/utils/pay.ts", status: "added" }]))[0], "selector risk critical");
    // A path the selector refuses is critical, and its message is kept.
    const refused = await decideFiles([{ filename: "packages/client/src/routes/[gardenId].test.tsx", status: "added" }]);
    assert.equal(refused[0], "selector risk unknown");
    assert.ok(refused.some((reason) => reason.startsWith("selector error: ")), refused.join("; "));
    const many = Array.from({ length: 3000 }, (_, index) => ({ filename: `docs/f${index}.md`, status: "modified" }));
    assert.ok((await decideFiles(many)).includes("more than 3000 files"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the workflow posts when CI Gate starts, and runs on every push to develop to decide whether to sweep", () => {
  const workflow = readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), "../../.github/workflows/merge-gate.yml"), "utf8");
  assert.match(workflow, /workflow_run:\n\s+workflows: \["CI Gate"\]\n\s+types: \[requested, completed\]/);
  // No path filter: GitHub drops one for a file past the first 3,000 a push changes.
  assert.match(workflow, /push:\n\s+branches: \[develop\]\n(?!\s+paths:)/);
  // Every input the gate's decision reads is critical to change.
  assert.deepEqual(GATE_INPUT_PATHS.filter((file) => !GATE_CRITICAL_PATHS.includes(file)), []);
});

test("a sweep after a push decides each open pull request into develop and skips the rest", async () => {
  const pulls = [
    { number: 3, state: "open", base: { ref: "develop" }, head: { sha: HEAD } },
    { number: 4, state: "open", base: { ref: "main" }, head: { sha: OTHER } },
  ];
  const posted = [];
  const github = async (route, request = {}) => {
    if (request.method === "POST") return void posted.push(route);
    if (route.startsWith("pulls?state=open")) return route.includes("page=1") ? pulls : [];
    const number = Number(route.match(/^pulls\/(\d+)$/)?.[1]);
    if (number) return pulls.find((pull) => pull.number === number);
    if (route.startsWith("issues/")) return [];
    if (route.startsWith("commits/")) return [];
    throw new Error(`unexpected ${route}`);
  };
  const deps = {
    env: { GITHUB_EVENT_NAME: "push" },
    event: { ref: "refs/heads/develop" },
    github,
    evaluate: async () => ({ decision: { state: "pending", description: "x", needed: [] }, reasons: [], markers: { reviewed: false, fullGate: false }, authors: new Set(), writers: new Set() }),
    log: () => {},
    summary: () => {},
  };
  assert.equal(await main([], deps), 0);
  // The hold first, then the decision; the pull request into main is left alone.
  assert.deepEqual(posted, [`statuses/${HEAD}`, `statuses/${HEAD}`]);
});

test("a push sweeps only when it changed a gate input, or when GitHub cannot say", async () => {
  const BEFORE = "a".repeat(40);
  const AFTER = "b".repeat(40);
  const run = async (files) => {
    const posted = [];
    const github = async (route, request = {}) => {
      if (request.method === "POST") return void posted.push(route);
      if (route.startsWith("pulls?state=open")) return route.includes("page=1") ? [{ number: 3, base: { ref: "develop" } }] : [];
      if (route === "pulls/3") return { number: 3, state: "open", base: { ref: "develop" }, head: { sha: HEAD } };
      if (route === `compare/${BEFORE}...${AFTER}`) return files === "error" ? Promise.reject(new Error("HTTP 502")) : { files };
      if (route.startsWith("issues/") || route.startsWith("commits/")) return [];
      throw new Error(`unexpected ${route}`);
    };
    const deps = {
      env: { GITHUB_EVENT_NAME: "push" },
      event: { ref: "refs/heads/develop", before: BEFORE, after: AFTER },
      github,
      evaluate: async () => ({ decision: { state: "success", description: "ok", needed: [] }, reasons: [], markers: null, authors: new Set(), writers: new Set() }),
      log: () => {},
      summary: () => {},
    };
    assert.equal(await main([], deps), 0);
    return posted.length;
  };
  assert.equal(await run([{ filename: "docs/a.md" }]), 0);
  assert.equal(await run([{ filename: "docs/old.md", previous_filename: ".agents/merge-policy.json" }]), 2);
  assert.equal(await run(Array.from({ length: 300 }, (_, index) => ({ filename: `docs/${index}.md` }))), 2);
  assert.equal(await run("error"), 2);
});

test("a run that read an older policy posts nothing, a failed freshness check holds back only success, and a sweep goes on past one failure", async () => {
  const CHECKOUT = "c".repeat(40);
  const TIP = "d".repeat(40);
  const POLICY = ".agents/merge-policy.json";
  const run = async ({ moved, state = "success", eventName = "issue_comment", pulls = { 3: { number: 3, state: "open", base: { ref: "develop" }, head: { sha: HEAD } } }, exit = 0 }) => {
    const posted = [];
    const github = async (route, request = {}) => {
      if (request.method === "POST") return void posted.push(route);
      if (route.startsWith("pulls?state=open")) return route.includes("page=1") ? Object.values(pulls).map((pull) => pull ?? { number: 9, base: { ref: "develop" } }) : [];
      const number = route.match(/^pulls\/(\d+)$/)?.[1];
      if (number) return pulls[number] ?? Promise.reject(new Error("HTTP 502"));
      if (route === "branches/develop") return { commit: { sha: TIP } };
      if (route.startsWith(`compare/${CHECKOUT}...${TIP}`)) return moved === "error" ? Promise.reject(new Error("HTTP 502")) : { files: moved?.map((filename) => ({ filename })) };
      if (route.startsWith("issues/") || route.startsWith("commits/")) return [];
      throw new Error(`unexpected ${route}`);
    };
    const deps = {
      env: { GITHUB_EVENT_NAME: eventName, GITHUB_SHA: CHECKOUT },
      event: eventName === "push" ? { ref: "refs/heads/develop" } : { issue: { number: 3, pull_request: {} } },
      github,
      evaluate: async () => ({ decision: { state, description: state, needed: [] }, reasons: [], markers: { reviewed: false, fullGate: false }, authors: new Set(), writers: new Set() }),
      log: () => {},
      summary: () => {},
    };
    assert.equal(await main([], deps), exit);
    return posted;
  };
  assert.deepEqual(await run({ moved: ["docs/a.md"] }), [`statuses/${HEAD}`]);
  assert.deepEqual(await run({ moved: [POLICY] }), []);
  // A hold from an older policy could stall a pull request the newer one passes, so it waits for the sweep too.
  assert.deepEqual(await run({ moved: [POLICY], state: "pending" }), []);
  // A comparison that lists no files or is cut short counts as moved.
  assert.deepEqual(await run({ moved: undefined }), []);
  assert.deepEqual(await run({ moved: Array.from({ length: 300 }, (_, index) => `docs/${index}.md`) }), []);
  // A failed comparison confirms nothing: success waits and the run reports it, but a hold still posts.
  assert.deepEqual(await run({ moved: "error", exit: 2 }), []);
  assert.deepEqual(await run({ moved: "error", state: "pending" }), [`statuses/${HEAD}`]);
  // A sweep whose checkout a newer policy push already passed leaves everything to the newer sweep.
  assert.deepEqual(await run({ eventName: "push", moved: [POLICY] }), []);
  // Pull request 9 fails to load; 3 is held, then decided, and the run reports the failure.
  assert.deepEqual(await run({ eventName: "push", moved: [], pulls: { 3: { number: 3, state: "open", base: { ref: "develop" }, head: { sha: HEAD } }, 9: undefined }, exit: 2 }), [`statuses/${HEAD}`, `statuses/${HEAD}`]);
});
