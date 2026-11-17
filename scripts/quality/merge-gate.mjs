#!/usr/bin/env node
// Merge Gate: the "Merge Gate" commit status, which holds a pull request into develop to the proof
// its tier in .agents/merge-policy.json asks for. Routine needs nothing beyond CI Gate. Sensitive
// needs a marker that a fresh agent's adversarial review was addressed at the head. Critical needs
// that marker and one that the selector's critical gate passed at the same head.
//
// Agents write the markers as pull request comments, so the gate is a process check: it makes a
// skipped proof visible and blocking, but it does not stop an agent set on bypassing it. The
// owner's approval sits at the release boundary instead (`release` in the merge policy).
//
// The workflow runs on workflow_run and issue_comment, so this script, the selector and both
// policies come from develop: a pull request cannot rewrite its own gate. Nothing from the pull
// request is checked out or run. Its paths come from the API, and its Shared files are read from
// fetched objects for the selector's mutation analysis, so `.gitattributes` and symlinks change
// nothing. Whatever the gate cannot classify is critical.
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveMutationPaths, selectValidation } from "./select-validation.mjs";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const STATUS_CONTEXT = "Merge Gate";
// GitHub lists at most 3,000 files for a pull request; past that the change cannot be classified.
const GITHUB_FILE_LIMIT = 3000;
const TIERS = ["routine", "sensitive", "critical"];
// The gate, the code it loads, the policies and selector it reads, CI Gate (the routine tier's
// whole proof), and the release workflow: a change to any of them changes what every later merge
// must prove, whatever the policies say about it.
export const GATE_CRITICAL_PATHS = [
  ".agents/merge-policy.json",
  ".github/workflows/ci-gate.yml",
  ".github/workflows/merge-gate.yml",
  ".github/workflows/release.yml",
  "scripts/data/validation-policy.json",
  "scripts/lib/dev-shared.js",
  "scripts/quality/ci-gate.mjs",
  "scripts/quality/merge-gate.mjs",
  "scripts/quality/select-validation.mjs",
  "scripts/quality/shared-mutation-surface.mjs",
];
// What the gate's decision reads. A push to develop that changes any of them starts a sweep that
// decides every open pull request again (the workflow's detect job compares each push with them).
export const GATE_INPUT_PATHS = [
  ".agents/merge-policy.json",
  ".github/workflows/merge-gate.yml",
  "scripts/data/validation-policy.json",
  "scripts/lib/dev-shared.js",
  "scripts/quality/merge-gate.mjs",
  "scripts/quality/select-validation.mjs",
  "scripts/quality/shared-mutation-surface.mjs",
];
const SYMLINK_MODE = "120000";
const SUBMODULE_MODE = "160000";
// Only accounts that can push write proof. An organization's read-only members comment as MEMBER
// too, so the comment's author association cannot tell them apart. A custom role names itself in
// `role_name` and carries its base access in `permission`, where maintain reads as write.
const WRITE_ROLES = new Set(["admin", "maintain", "write"]);
const WRITE_PERMISSIONS = new Set(["admin", "write"]);
// A marker names the head by its full SHA. A prefix can be ground: a fork could push a commit that
// shares a reviewed head's first characters and carry that head's proof over to it.
const MARKER_LINE = /^merge-gate:\s+(reviewed|full-gate)\s+([0-9a-f]{40})\b/i;
// How much of a SHA a description shows when it only names the head.
const SHORT_SHA = 9;
// GitHub's limit on a status description.
const DESCRIPTION_LIMIT = 140;

export function loadMergePolicy(root = repoRoot) {
  return JSON.parse(readFileSync(resolve(root, ".agents/merge-policy.json"), "utf8"));
}

// Globs as the check selector reads them: a double star before a slash spans zero or more folders
// (so a root package.json matches the policy's manifest glob), a lone double star spans any text,
// and a single star or question mark stays inside one folder.
export function globRegex(glob) {
  let source = "";
  for (let at = 0; at < glob.length; at++) {
    const char = glob[at];
    if (char === "*" && glob[at + 1] === "*") {
      const folders = glob[at + 2] === "/";
      source += folders ? "(?:.*/)?" : ".*";
      at += folders ? 2 : 1;
    } else if (char === "*") source += "[^/]*";
    else if (char === "?") source += "[^/]";
    else source += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${source}$`);
}

/** The highest of the tiers given; a tier the gate does not know counts as critical. */
export function highestTier(...tiers) {
  const rank = (tier) => (TIERS.includes(tier) ? TIERS.indexOf(tier) : TIERS.length - 1);
  return TIERS[Math.max(0, ...tiers.map(rank))];
}

/** The highest tier whose merge-policy globs match the path; a path no tier claims is critical. */
export function policyTier(path, policy) {
  for (const tier of [...TIERS].reverse()) {
    if ((policy.tiers?.[tier]?.paths ?? []).some((glob) => globRegex(glob).test(path))) return tier;
  }
  return "critical";
}

/**
 * A change's tier and the reasons that set it: the highest of the selector's risk, the merge
 * policy's globs and the gate's own list. A symlink or submodule in the head or the base (so
 * removing or replacing one counts), a changed path in neither tree, a fork, a file list GitHub
 * cut short, a changed Shared file the gate could not read, or a deleted Shared file whose code
 * reached a signing, sending, queue or session primitive is critical.
 */
export function classifyChange({
  paths,
  modes,
  baseModes = new Map(),
  selectorRisk,
  policy,
  fork = false,
  truncated = false,
  untraced = [],
  unreadable = [],
  deletedMutation = [],
}) {
  const critical = [];
  const sensitive = [];
  if (fork) critical.push("a fork's pull request");
  if (truncated) critical.push(`more than ${GITHUB_FILE_LIMIT} files`);
  for (const path of paths) {
    const sides = [modes.get(path), baseModes.get(path)];
    if (sides.includes(SYMLINK_MODE)) critical.push(`symlink ${path}`);
    if (sides.includes(SUBMODULE_MODE)) critical.push(`submodule ${path}`);
    const tier = GATE_CRITICAL_PATHS.includes(path) ? "critical" : policyTier(path, policy);
    if (tier === "critical") critical.push(`critical path ${path}`);
    if (tier === "sensitive") sensitive.push(`sensitive path ${path}`);
  }
  for (const path of untraced) critical.push(`path in neither tree ${path}`);
  for (const path of unreadable) critical.push(`unreadable Shared file ${path}`);
  for (const path of deletedMutation) critical.push(`deleted mutation path ${path}`);
  const risk = highestTier(selectorRisk);
  if (risk !== "routine") (risk === "critical" ? critical : sensitive).unshift(`selector risk ${selectorRisk}`);
  if (critical.length) return { tier: "critical", reasons: critical };
  if (sensitive.length) return { tier: "sensitive", reasons: sensitive };
  return { tier: "routine", reasons: [] };
}

/**
 * A comment's lines as a reader sees them. HTML comments hide what they hold, an unclosed one to
 * the end of the comment. So do fenced code blocks: only a bare fence of the opener's character, at
 * least as long and indented at most three spaces, closes one. Every Markdown line break ends a
 * line, a lone CR included; U+2028 does not, as Markdown does not break on it.
 */
function visibleLines(body) {
  const lines = [];
  let fence = null;
  for (const line of String(body ?? "").replace(/<!--[\s\S]*?(?:--!?>|$)/g, " ").split(/\r\n|\r|\n/)) {
    const [, marker, info] = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/) ?? [];
    if (fence) {
      if (marker?.[0] === fence[0] && marker.length >= fence.length && !info.trim()) fence = null;
      continue;
    }
    if (marker) fence = marker;
    else lines.push(line);
  }
  return lines;
}

/** Whether a comment holds a marker-shaped line at all, before anyone's access is looked up. */
export function hasMarker(comment) {
  return visibleLines(comment.body).some((line) => MARKER_LINE.test(line));
}

/**
 * The proofs the comments record for this head. A marker counts from an account `canWrite` accepts,
 * outside code blocks and HTML comments, when it names the head by its full SHA. A quoted line
 * starts with `>`, so a quoted marker never counts.
 */
export function markersFor(comments, headSha, canWrite) {
  const found = { reviewed: false, fullGate: false };
  const head = headSha.toLowerCase();
  for (const comment of comments) {
    if (!canWrite(comment.user?.login)) continue;
    for (const line of visibleLines(comment.body)) {
      const [, kind, sha] = line.match(MARKER_LINE) ?? [];
      if (!kind || sha.toLowerCase() !== head) continue;
      if (kind.toLowerCase() === "reviewed") found.reviewed = true;
      else found.fullGate = true;
    }
  }
  return found;
}

/**
 * The commenters who may write proof: those whose repository role is admin, maintain or write, or
 * a custom role built on write or maintain. `accessOf` looks one up as GitHub's
 * collaborator-permission response. A lookup that fails throws, so the run reports an error
 * instead of waiting on proof it could not read.
 */
export async function writersAmong(comments, accessOf) {
  const writers = new Set();
  for (const login of new Set(comments.filter(hasMarker).map((comment) => comment.user?.login).filter(Boolean))) {
    const access = await accessOf(login);
    if (WRITE_ROLES.has(access?.role_name) || WRITE_PERMISSIONS.has(access?.permission)) writers.add(login);
  }
  return writers;
}

// A path may hold control characters; none reaches a status or the log, where a line break could
// start a workflow command.
export const printable = (text) => String(text).replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, " ");
const fit = (text, room) => (text.length <= room ? text : `${text.slice(0, Math.max(0, room - 3))}...`);

/**
 * The status for one head: success once its tier's proof is recorded, pending until then. A
 * pending description always ends with what it waits for and the full head; the first reason is
 * shortened to the room left. `needed` holds the marker lines that would record the missing proof.
 */
export function decide({ tier, reasons, markers, headSha }) {
  const label = `${tier[0].toUpperCase()}${tier.slice(1)}`;
  if (tier === "routine") return { state: "success", description: "Routine: CI Gate is the proof.", needed: [] };
  const missing = [!markers.reviewed && "reviewed", tier === "critical" && !markers.fullGate && "full-gate"].filter(Boolean);
  if (!missing.length) return { state: "success", description: `${label}: proof recorded for ${headSha.slice(0, SHORT_SHA)}.`, needed: [] };
  const waits = missing.length > 1 ? "reviewed and full-gate markers" : `a ${missing[0]} marker`;
  const tail = `). Waits for ${waits} naming ${headSha}.`;
  const more = reasons.length > 1 ? ` and ${reasons.length - 1} more` : "";
  const room = DESCRIPTION_LIMIT - `${label} (`.length - more.length - tail.length;
  return {
    state: "pending",
    description: `${label} (${fit(printable(reasons[0] ?? "no reason given"), room)}${more}${tail}`,
    needed: missing.map((kind) => `merge-gate: ${kind} ${headSha}`),
  };
}

/**
 * The open pull requests an event concerns. `findByHead` looks a fork's pull request up by its head
 * branch; `listOpen` lists every open pull request into the gate's bases, which a push to develop
 * that changes the gate's inputs decides again.
 */
export async function pullNumbers(event, eventName, findByHead, listOpen = async () => []) {
  if (eventName === "push") return listOpen();
  if (eventName === "issue_comment") return event.issue?.pull_request ? [event.issue.number] : [];
  const run = event.workflow_run;
  if (eventName !== "workflow_run" || run?.event !== "pull_request") return [];
  const numbers = (run.pull_requests ?? []).map((pull) => pull.number);
  if (numbers.length || !run.head_repository?.owner?.login || !run.head_branch) return numbers;
  const pulls = await findByHead(`${run.head_repository.owner.login}:${run.head_branch}`);
  return pulls.filter((pull) => pull.head.sha === run.head_sha).map((pull) => pull.number);
}

/** Every entry of a commit's tree by path: mode, type and object id. */
export function treeEntries(sha, { cwd = repoRoot, env = process.env } = {}) {
  const listing = execFileSync("git", ["ls-tree", "-r", "-z", "--full-tree", sha], { cwd, env, maxBuffer: 1 << 28 }).toString("utf8");
  const entries = new Map();
  for (const record of listing.split("\0")) {
    if (!record) continue;
    const tab = record.indexOf("\t");
    const [mode, type, oid] = record.slice(0, tab).split(" ");
    entries.set(record.slice(tab + 1), { mode, type, oid });
  }
  return entries;
}

/** Blob contents, in order, through one `git cat-file --batch`. */
function readBlobs(oids, { cwd, env }) {
  if (!oids.length) return [];
  const output = execFileSync("git", ["cat-file", "--batch"], { cwd, env, input: `${oids.join("\n")}\n`, maxBuffer: 1 << 30 });
  const blobs = [];
  let at = 0;
  for (const oid of oids) {
    const newline = output.indexOf(0x0a, at);
    const [name, type, size] = output.subarray(at, newline).toString("utf8").split(" ");
    if (name !== oid || type !== "blob") throw new Error(`cannot read blob ${oid}`);
    blobs.push(output.subarray(newline + 1, newline + 1 + Number(size)));
    at = newline + 1 + Number(size) + 1;
  }
  return blobs;
}

/**
 * A tree's Shared package as files in a scratch folder, for the selector to read as text. Blobs
 * come from the object store, so `.gitattributes` cannot hide a file; links and submodules stay
 * out, and the caller holds them critical.
 */
export function materializeShared(entries, { cwd = repoRoot, env = process.env } = {}) {
  const root = mkdtempSync(join(tmpdir(), "merge-gate-"));
  const files = [...entries].filter(([path, entry]) => path.startsWith("packages/shared/") && entry.type === "blob" && entry.mode !== SYMLINK_MODE);
  const contents = readBlobs(files.map(([, entry]) => entry.oid), { cwd, env });
  files.forEach(([path], index) => {
    const target = resolve(root, path);
    if (!target.startsWith(`${root}${sep}`)) return;
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, contents[index]);
  });
  return root;
}

/**
 * A commit's objects, fetched only when missing. A depth limit would turn a full clone shallow and
 * hide history from every worktree that shares it, so only a clone that is already shallow, as the
 * workflow's checkout is, fetches with one.
 */
export function fetchCommit(sha, { cwd = repoRoot, env = process.env } = {}) {
  if (spawnSync("git", ["cat-file", "-e", `${sha}^{commit}`], { cwd, env }).status === 0) return;
  const shallow = execFileSync("git", ["rev-parse", "--is-shallow-repository"], { cwd, env, encoding: "utf8" }).trim() === "true";
  execFileSync("git", ["fetch", "--quiet", "--no-tags", ...(shallow ? ["--depth=1"] : []), "origin", sha], { cwd, env, stdio: ["ignore", "ignore", "inherit"] });
}

/** GitHub's REST API for one repository: `call(path, { method, body })` returns the parsed response. */
export function githubClient({ token, repository }) {
  return async (path, { method = "GET", body } = {}) => {
    const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw Object.assign(new Error(`${method} ${path.split("?")[0]}: HTTP ${response.status}`), { status: response.status });
    return response.status === 204 ? null : response.json();
  };
}

async function paginate(github, path, limit = Number.POSITIVE_INFINITY) {
  const items = [];
  for (let page = 1; items.length < limit; page++) {
    const batch = await github(`${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
    items.push(...batch);
    if (batch.length < 100) break;
  }
  return items;
}

/** Deleted Shared files whose code, as the base has it, reached a mutation primitive; unreadable ones too. */
function deletedMutationPaths(baseEntries, deletedPaths, git) {
  const deleted = deletedPaths.filter((path) => /^packages\/shared\/src\/.+\.[cm]?[jt]sx?$/.test(path));
  if (!deleted.length) return { deletedMutation: [], unreadable: [] };
  const baseRoot = materializeShared(baseEntries, git);
  try {
    return {
      deletedMutation: resolveMutationPaths(deleted, { cwd: baseRoot }),
      unreadable: deleted.filter((path) => !existsSync(join(baseRoot, path))),
    };
  } finally {
    rmSync(baseRoot, { recursive: true, force: true });
  }
}

// The commit GitHub diffs the pull request against, so a file develop changed or removed after the
// branch point reads as the pull request found it. Without it the run fails: the base tip could
// hold another version of a deleted file, one that no longer reaches a mutation primitive.
async function mergeBaseOf(github, pull, headSha) {
  const sha = (await github(`compare/${pull.base.sha}...${headSha}?per_page=1`)).merge_base_commit?.sha;
  if (!sha) throw new Error(`no merge base for ${headSha.slice(0, SHORT_SHA)}`);
  return sha;
}

// The selector refuses some paths outright (a test path with brackets, say). The gate needs only its
// risk, and one it cannot read counts as critical instead of failing every run; its message joins
// the reasons, so a broken selector shows.
function selectorRiskOf(change) {
  try {
    return { risk: selectValidation({ ...change, intent: "merge", ci: true }).risk };
  } catch (error) {
    return { risk: "unknown", error: printable(error.message) };
  }
}

// A collaborator's access, as GitHub reports it. A login GitHub does not know (HTTP 404) has none;
// any other failed lookup throws.
const accessLookup = (github) => (login) =>
  github(`collaborators/${encodeURIComponent(login)}/permission`).catch((error) => {
    if (error.status === 404) return { permission: "none" };
    throw error;
  });

/**
 * The decision for one pull request's head, every read pinned to that commit. It also returns the
 * reasons behind the tier, the markers it counted, and the marker authors it looked up and found
 * to be writers. `github` calls the repository's REST API (as `githubClient` does). `cwd` is a clone
 * that can fetch the pull request's commits.
 */
export async function evaluate(pull, headSha, { github, cwd = repoRoot, env = process.env, policy = loadMergePolicy() }) {
  const git = { cwd, env };
  const files = await paginate(github, `pulls/${pull.number}/files`, GITHUB_FILE_LIMIT);
  const paths = [...new Set(files.flatMap((file) => (file.previous_filename ? [file.filename, file.previous_filename] : [file.filename])))];
  const deletedPaths = [...new Set(files.flatMap((file) => (file.status === "removed" ? [file.filename] : file.previous_filename ? [file.previous_filename] : [])))];
  const baseSha = await mergeBaseOf(github, pull, headSha);
  fetchCommit(headSha, git);
  fetchCommit(baseSha, git);
  const entries = treeEntries(headSha, git);
  // A removed or renamed path is only in the base, so its mode is read there.
  const baseEntries = treeEntries(baseSha, git);
  const modesOf = (tree) => new Map([...tree].map(([path, entry]) => [path, entry.mode]));
  const sharedRoot = materializeShared(entries, git);
  try {
    const unreadable = paths.filter(
      (path) => path.startsWith("packages/shared/") && entries.get(path)?.type === "blob" && entries.get(path).mode !== SYMLINK_MODE && !existsSync(join(sharedRoot, path)),
    );
    const deleted = deletedMutationPaths(baseEntries, deletedPaths, git);
    const mutationPaths = resolveMutationPaths(paths, { cwd: sharedRoot });
    const selector = selectorRiskOf({ changedPaths: paths, deletedPaths, mutationPaths });
    const change = classifyChange({
      paths,
      modes: modesOf(entries),
      baseModes: modesOf(baseEntries),
      selectorRisk: selector.risk,
      policy,
      fork: pull.head.repo?.full_name !== pull.base.repo.full_name,
      truncated: files.length >= GITHUB_FILE_LIMIT,
      untraced: paths.filter((path) => !entries.has(path) && !baseEntries.has(path)),
      unreadable: [...unreadable, ...deleted.unreadable],
      deletedMutation: deleted.deletedMutation,
    });
    const reasons = selector.error ? [...change.reasons, `selector error: ${selector.error}`] : change.reasons;
    const comments = await paginate(github, `issues/${pull.number}/comments`);
    const authors = new Set(comments.filter(hasMarker).map((comment) => comment.user?.login).filter(Boolean));
    const writers = await writersAmong(comments, accessLookup(github));
    const markers = markersFor(comments, headSha, (login) => writers.has(login));
    return { decision: decide({ ...change, reasons, markers, headSha }), reasons, markers, authors, writers };
  } finally {
    rmSync(sharedRoot, { recursive: true, force: true });
  }
}

// What a sweep posts before it decides; if a stopped sweep leaves it, a recheck comment decides.
export const HOLD_DESCRIPTION = "Deciding again under a changed merge policy; comment merge-gate: recheck if this stays.";

// Whether a gate input changed between two commits. A comparison GitHub cut short, or one that lists
// no files, counts as changed; a failed lookup throws.
async function gateInputsChanged(github, from, to) {
  const files = (await github(`compare/${from}...${to}`)).files;
  if (!Array.isArray(files)) return true;
  return files.length >= 300 || files.some((entry) => GATE_INPUT_PATHS.includes(entry.filename) || GATE_INPUT_PATHS.includes(entry.previous_filename));
}

// Whether the gate's inputs changed on the base branch since this run checked it out. Such a run
// would post an older policy's decision, so the sweep that change started decides instead.
async function gateInputsMovedSince(github, checkout, base) {
  if (!checkout) return false;
  const tip = (await github(`branches/${encodeURIComponent(base)}`)).commit.sha;
  return tip !== checkout && gateInputsChanged(github, checkout, tip);
}

/**
 * Whether a push to develop changed what the gate reads. The workflow's detect job asks on every
 * push, since a path filter misses a file past the first 3,000 a large push changes. A force push,
 * an unknown range, or a comparison that fails sweeps: the three-dot comparison of a rewritten
 * history starts at the merge base, so it can miss a reverted policy.
 */
export async function pushChangedGateInputs(github, event) {
  const zero = /^0+$/;
  if (event.forced || !event.before || !event.after || zero.test(event.before) || zero.test(event.after)) return true;
  return gateInputsChanged(github, event.before, event.after).catch(() => true);
}

/**
 * In the workflow, decide every pull request the event concerns and post its status. With
 * `--dry-run <number>`, decide that pull request and print the decision without posting. `deps`
 * stands in for GitHub, the event, the decision and the output in tests.
 */
export async function main(argv = process.argv.slice(2), deps = {}) {
  const env = deps.env ?? process.env;
  const dryRun = argv[0] === "--dry-run" ? Number(argv[1]) : null;
  const detect = argv.length === 1 && argv[0] === "--push-changed";
  if (argv.length && !detect && !(dryRun > 0 && argv.length === 2)) {
    console.error("usage: node scripts/quality/merge-gate.mjs [--dry-run <pull request number> | --push-changed]");
    return 2;
  }
  const github = deps.github ?? githubClient({ token: env.GITHUB_TOKEN, repository: env.GITHUB_REPOSITORY });
  if (detect) {
    const sweep = await pushChangedGateInputs(github, deps.event ?? JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8")));
    (deps.log ?? ((line) => console.log(line)))(sweep ? "A gate input may have changed: sweep." : "No gate input changed in this push.");
    if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `sweep=${sweep}\n`);
    return 0;
  }
  const decideHead = deps.evaluate ?? evaluate;
  const log = deps.log ?? ((line) => console.log(line));
  const summary = deps.summary ?? ((line) => env.GITHUB_STEP_SUMMARY && appendFileSync(env.GITHUB_STEP_SUMMARY, `${line}\n`));
  const bases = (env.MERGE_GATE_BASES ?? "develop").split(",").map((base) => base.trim()).filter(Boolean);
  const runUrl = `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`;
  const findByHead = (head) => github(`pulls?state=open&head=${encodeURIComponent(head)}`);
  const listOpen = async () => (await paginate(github, "pulls?state=open")).filter((pull) => bases.includes(pull.base.ref)).map((pull) => pull.number);
  const numbers = dryRun
    ? [dryRun]
    : await pullNumbers(deps.event ?? JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8")), env.GITHUB_EVENT_NAME, findByHead, listOpen);
  let failed = false;
  const eventName = env.GITHUB_EVENT_NAME;
  // The commit this run's gate code and policies came from: develop's tip at checkout.
  const checkout = env.MERGE_GATE_CHECKOUT_SHA || env.GITHUB_SHA;
  if (!dryRun && eventName === "push") {
    // The detect job decided this push needs a sweep. The job checked out develop's tip when it
    // started, not the push, so whichever sweep the queue keeps read the newest policy.
    // Hold every open pull request first, so a sweep that stops part-way never leaves a success the
    // older policy granted. Holding a merge is always safe.
    for (const number of numbers) {
      try {
        const pull = await github(`pulls/${number}`);
        if (pull.state !== "open" || !bases.includes(pull.base.ref)) continue;
        await github(`statuses/${pull.head.sha}`, {
          method: "POST",
          body: { state: "pending", context: STATUS_CONTEXT, description: HOLD_DESCRIPTION, target_url: runUrl },
        });
      } catch (error) {
        failed = true;
        log(`#${number}: could not hold before the sweep (${printable(error.message)}).`);
      }
    }
  }
  for (const number of numbers) {
    try {
      const pull = await github(`pulls/${number}`);
      if (!dryRun && (pull.state !== "open" || !bases.includes(pull.base.ref))) continue;
      // The snapshot: every read below, and the status, are for this commit only.
      const headSha = pull.head.sha;
      const head = headSha.slice(0, SHORT_SHA);
      let outcome;
      try {
        outcome = await decideHead(pull, headSha, { github });
      } catch (error) {
        failed = true;
        const description = fit(printable(`Could not decide, so nothing passes: ${error.message}`), DESCRIPTION_LIMIT);
        outcome = { decision: { state: "error", description, needed: [] }, reasons: [], markers: null };
      }
      const { decision } = outcome;
      // A push, or a writer's marker written while the run read the pull request, leaves a mixed
      // snapshot; the run for the newer state decides instead. Only a change to what the writers'
      // markers prove counts, so nobody else's comments can stop a post. A re-read that fails confirms
      // nothing: pending or error still posts, since holding a merge is always safe, but success does not.
      let confirmed = true;
      try {
        const current = await github(`pulls/${number}`);
        if (current.head.sha !== headSha) {
          log(`#${number}: the head moved to ${current.head.sha.slice(0, SHORT_SHA)} while ${head} was read; nothing posted.`);
          continue;
        }
        if (outcome.markers) {
          const reread = await paginate(github, `issues/${number}/comments`);
          const newcomers = reread.filter((comment) => hasMarker(comment) && comment.user?.login && !outcome.authors.has(comment.user.login));
          const writers = new Set([...outcome.writers, ...(await writersAmong(newcomers, accessLookup(github)))]);
          const now = markersFor(reread, headSha, (login) => writers.has(login));
          if (now.reviewed !== outcome.markers.reviewed || now.fullGate !== outcome.markers.fullGate) {
            log(`#${number}: a writer's marker changed while ${head} was read; nothing posted.`);
            continue;
          }
        }
      } catch (error) {
        confirmed = false;
        log(`#${number}: could not re-read the pull request (${printable(error.message)}).`);
      }
      if (decision.state === "success" && !confirmed) {
        failed = true;
        log(`#${number} at ${head}: success not posted, since the snapshot could not be confirmed.`);
        continue;
      }
      const line = `#${number} at ${head}: ${decision.state}. ${decision.description}`;
      if (!dryRun) {
        // A run that read an older policy posts nothing: a success could carry a looser policy through,
        // and a hold could stall a pull request the newer policy passes. The sweep that change started
        // decides every open pull request, this one included, since its head predates this run. A
        // lookup that fails confirms no change, so only a success waits; a hold still posts.
        const moved = await gateInputsMovedSince(github, checkout, pull.base.ref).catch(() => null);
        if (moved === true || (moved === null && decision.state === "success")) {
          if (moved === null) failed = true;
          const why = moved ? `the gate's inputs changed on ${pull.base.ref} since this run checked it out` : "the policy's freshness could not be checked";
          log(`#${number}: ${why}; ${decision.state} not posted.`);
          continue;
        }
        // GitHub keeps at most 1,000 statuses for a head and context, so an unchanged decision is not
        // posted again. A failed lookup posts anyway, so an older success never outlives its proof.
        const latest = await github(`commits/${headSha}/statuses?per_page=100`).then(
          (statuses) => statuses.find((status) => status.context === STATUS_CONTEXT),
          () => undefined,
        );
        if (latest?.state === decision.state && latest?.description === decision.description) {
          log(`${line} Unchanged, so not posted again.`);
          continue;
        }
        await github(`statuses/${headSha}`, {
          method: "POST",
          body: { state: decision.state, context: STATUS_CONTEXT, description: decision.description, target_url: runUrl },
        });
      }
      log(line);
      summary(line);
      for (const reason of outcome.reasons) summary(`- ${printable(reason)}`);
      for (const marker of decision.needed) summary(`- record with: \`${marker}\``);
    } catch (error) {
      // One pull request's failure leaves the rest of a sweep to decide.
      failed = true;
      log(`#${number}: could not decide (${printable(error.message)}); left as it was.`);
    }
  }
  return failed ? 2 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(`Merge Gate could not run: ${printable(error.message)}`);
      process.exitCode = 2;
    },
  );
}
