#!/usr/bin/env node
// Merge Gate: the "Merge Gate" commit status, which holds a pull request into develop to the proof
// its tier in .agents/merge-policy.json asks for. Routine needs nothing beyond CI Gate. Sensitive
// needs a marker that a fresh agent's adversarial review was addressed at the exact head. Critical
// needs that marker and one that the selector's full critical gate passed at the same head.
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
// The gate, the policies and selector it reads, and the workflows that gate or release: a change to
// any of them changes what every later merge must prove, whatever the policies say about it.
export const GATE_CRITICAL_PATHS = [
  ".agents/merge-policy.json",
  ".github/workflows/ci-gate.yml",
  ".github/workflows/merge-gate.yml",
  ".github/workflows/release.yml",
  "scripts/data/validation-policy.json",
  "scripts/quality/merge-gate.mjs",
  "scripts/quality/select-validation.mjs",
  "scripts/quality/shared-mutation-surface.mjs",
];
const SYMLINK_MODE = "120000";
const SUBMODULE_MODE = "160000";
// Anyone may comment on a public repository; only the owner and collaborators write markers.
const MARKER_AUTHORS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);
const MARKER_RE = /^merge-gate:\s+(reviewed|full-gate)\s+([0-9a-f]{40})\b/gim;

export function loadMergePolicy(root = repoRoot) {
  return JSON.parse(readFileSync(resolve(root, ".agents/merge-policy.json"), "utf8"));
}

/** The merge-settings tool's globs: `**` spans folders, `*` and `?` stay inside one. */
export function globRegex(glob) {
  const pattern = glob.replace(/\*\*|\*|\?|[.+^${}()|[\]\\]/g, (token) => ({ "**": ".*", "*": "[^/]*", "?": "[^/]" })[token] ?? `\\${token}`);
  return new RegExp(`^${pattern}$`);
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
 * policy's globs and the gate's own list. A symlink, a submodule, a fork, a file list GitHub cut
 * short, or a changed Shared file the gate could not read is critical.
 */
export function classifyChange({ paths, modes, selectorRisk, policy, fork = false, truncated = false, unreadable = [] }) {
  const critical = [];
  const sensitive = [];
  if (fork) critical.push("a fork's pull request");
  if (truncated) critical.push(`more than ${GITHUB_FILE_LIMIT} files`);
  for (const path of paths) {
    const mode = modes.get(path);
    if (mode === SYMLINK_MODE) critical.push(`symlink ${path}`);
    if (mode === SUBMODULE_MODE) critical.push(`submodule ${path}`);
    const tier = GATE_CRITICAL_PATHS.includes(path) ? "critical" : policyTier(path, policy);
    if (tier === "critical") critical.push(`critical path ${path}`);
    if (tier === "sensitive") sensitive.push(`sensitive path ${path}`);
  }
  for (const path of unreadable) critical.push(`unreadable Shared file ${path}`);
  const risk = highestTier(selectorRisk);
  if (risk !== "routine") (risk === "critical" ? critical : sensitive).unshift(`selector risk ${selectorRisk}`);
  if (critical.length) return { tier: "critical", reasons: critical };
  if (sensitive.length) return { tier: "sensitive", reasons: sensitive };
  return { tier: "routine", reasons: [] };
}

/** The proofs the comments record for this head: only collaborators' markers naming its full SHA count. */
export function markersFor(comments, headSha) {
  const found = { reviewed: false, fullGate: false };
  for (const comment of comments) {
    if (!MARKER_AUTHORS.has(comment.author_association)) continue;
    for (const [, kind, sha] of String(comment.body ?? "").matchAll(MARKER_RE)) {
      if (sha.toLowerCase() !== headSha.toLowerCase()) continue;
      if (kind.toLowerCase() === "reviewed") found.reviewed = true;
      else found.fullGate = true;
    }
  }
  return found;
}

/** The status for one head: success once its tier's proof is recorded, pending until then. */
export function decide({ tier, reasons, markers, headSha }) {
  const head = headSha.slice(0, 9);
  const label = `${tier[0].toUpperCase()}${tier.slice(1)}`;
  if (tier === "routine") return { state: "success", description: "Routine: CI Gate is the proof." };
  const missing = [];
  if (!markers.reviewed) missing.push(`merge-gate: reviewed ${head}`);
  if (tier === "critical" && !markers.fullGate) missing.push(`merge-gate: full-gate ${head}`);
  if (!missing.length) return { state: "success", description: `${label}: proof recorded for ${head}.` };
  const cause = reasons.length > 1 ? `${reasons[0]} and ${reasons.length - 1} more` : reasons[0];
  return { state: "pending", description: `${label} (${cause}). Waits for ${missing.join(" and ")}.`.slice(0, 140) };
}

/** The open pull requests an event concerns. `findByHead` looks a fork's pull request up by its head branch. */
export async function pullNumbers(event, eventName, findByHead) {
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
 * The head's Shared package as files in a scratch folder, for the selector to read as text. Blobs
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
 * The head commit's objects, fetched only when missing. A depth limit would turn a full clone
 * shallow and hide history from every worktree that shares it, so only a clone that is already
 * shallow, as the workflow's checkout is, fetches with one.
 */
export function fetchCommit(sha, { cwd = repoRoot, env = process.env } = {}) {
  if (spawnSync("git", ["cat-file", "-e", `${sha}^{commit}`], { cwd, env }).status === 0) return;
  const shallow = execFileSync("git", ["rev-parse", "--is-shallow-repository"], { cwd, env, encoding: "utf8" }).trim() === "true";
  execFileSync("git", ["fetch", "--quiet", "--no-tags", ...(shallow ? ["--depth=1"] : []), "origin", sha], { cwd, env, stdio: ["ignore", "ignore", "inherit"] });
}

async function github(path, { method = "GET", body, token, repository }) {
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
  if (!response.ok) throw new Error(`${method} ${path.split("?")[0]}: HTTP ${response.status}`);
  return response.status === 204 ? null : response.json();
}

async function paginate(path, options, limit = Number.POSITIVE_INFINITY) {
  const items = [];
  for (let page = 1; items.length < limit; page++) {
    const batch = await github(`${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`, options);
    items.push(...batch);
    if (batch.length < 100) break;
  }
  return items;
}

/** The status for one pull request's head, every read pinned to that commit. */
async function evaluate(pull, headSha, options) {
  const files = await paginate(`pulls/${pull.number}/files`, options, GITHUB_FILE_LIMIT);
  const paths = [...new Set(files.flatMap((file) => (file.previous_filename ? [file.filename, file.previous_filename] : [file.filename])))];
  const deletedPaths = [...new Set(files.flatMap((file) => (file.status === "removed" ? [file.filename] : file.previous_filename ? [file.previous_filename] : [])))];
  fetchCommit(headSha);
  const entries = treeEntries(headSha);
  const sharedRoot = materializeShared(entries);
  try {
    const unreadable = paths.filter(
      (path) => path.startsWith("packages/shared/") && entries.get(path)?.type === "blob" && entries.get(path).mode !== SYMLINK_MODE && !existsSync(join(sharedRoot, path)),
    );
    const mutationPaths = resolveMutationPaths(paths, { cwd: sharedRoot });
    const selectorRisk = selectValidation({ changedPaths: paths, deletedPaths, mutationPaths, intent: "merge", ci: true }).risk;
    const change = classifyChange({
      paths,
      modes: new Map([...entries].map(([path, entry]) => [path, entry.mode])),
      selectorRisk,
      policy: loadMergePolicy(),
      fork: pull.head.repo?.full_name !== pull.base.repo.full_name,
      truncated: files.length >= GITHUB_FILE_LIMIT,
      unreadable,
    });
    const comments = await paginate(`issues/${pull.number}/comments`, options);
    return decide({ ...change, markers: markersFor(comments, headSha), headSha });
  } finally {
    rmSync(sharedRoot, { recursive: true, force: true });
  }
}

/**
 * In the workflow, decide every pull request the event concerns and post its status. With
 * `--dry-run <number>`, decide that pull request and print the decision without posting.
 */
async function main(argv = process.argv.slice(2)) {
  const dryRun = argv[0] === "--dry-run" ? Number(argv[1]) : null;
  if (argv.length && !(dryRun > 0 && argv.length === 2)) {
    console.error("usage: node scripts/quality/merge-gate.mjs [--dry-run <pull request number>]");
    return 2;
  }
  const options = { token: process.env.GITHUB_TOKEN, repository: process.env.GITHUB_REPOSITORY };
  const bases = (process.env.MERGE_GATE_BASES ?? "develop").split(",").map((base) => base.trim()).filter(Boolean);
  const runUrl = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  const findByHead = (head) => github(`pulls?state=open&head=${encodeURIComponent(head)}`, options);
  const numbers = dryRun
    ? [dryRun]
    : await pullNumbers(JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")), process.env.GITHUB_EVENT_NAME, findByHead);
  let failed = false;
  for (const number of numbers) {
    const pull = await github(`pulls/${number}`, options);
    if (!dryRun && (pull.state !== "open" || !bases.includes(pull.base.ref))) continue;
    // The snapshot: every read below, and the status, are for this commit only.
    const headSha = pull.head.sha;
    let decision;
    try {
      decision = await evaluate(pull, headSha, options);
    } catch (error) {
      failed = true;
      decision = { state: "error", description: `Could not decide, so nothing passes: ${error.message}`.slice(0, 140) };
    }
    if (!dryRun) {
      await github(`statuses/${headSha}`, {
        ...options,
        method: "POST",
        body: { state: decision.state, context: STATUS_CONTEXT, description: decision.description, target_url: runUrl },
      });
    }
    const line = `#${number} at ${headSha.slice(0, 9)}: ${decision.state}. ${decision.description}`;
    console.log(line);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n`);
  }
  return failed ? 2 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(`Merge Gate could not run: ${error.message}`);
      process.exitCode = 2;
    },
  );
}
