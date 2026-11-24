#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { appendFileSync, lstatSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

const sections = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies", "overrides", "resolutions"];
const manifestPattern = /^(?:package\.json|docs\/package\.json|packages\/[^/]+\/package\.json)$/;
export const git = (root, ...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
const readJson = (root, file) => JSON.parse(readFileSync(resolve(root, file), "utf8"));

function version(value) {
  const match = typeof value === "string" && /^(\^|~)?(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if (!match) throw new Error(`Only stable semver pins can be synchronized: ${value}`);
  return { prefix: match[1] ?? "", number: match.slice(2).map(Number), text: match.slice(2).join(".") };
}

function order(left, right) {
  for (let index = 0; index < 3; index++) {
    if (left.number[index] !== right.number[index]) return Math.sign(left.number[index] - right.number[index]);
  }
  return 0;
}

// Both generation and publication enforce this boundary. Package scripts, dependency
// additions/removals, aliases and arbitrary URLs need a maintainer's review instead.
export function manifestUpdates(before, after) {
  const rest = (manifest) => Object.fromEntries(Object.entries(manifest).filter(([key]) => !sections.includes(key)));
  if (!isDeepStrictEqual(rest(before), rest(after))) throw new Error("Non-dependency manifest changes are not eligible");
  const updates = [];
  for (const section of sections) {
    const oldEntries = before[section] ?? {};
    const newEntries = after[section] ?? {};
    if (!isDeepStrictEqual(Object.keys(oldEntries).sort(), Object.keys(newEntries).sort())) {
      throw new Error(`Dependency additions or removals in ${section} are not eligible`);
    }
    for (const [name, next] of Object.entries(newEntries)) {
      if (isDeepStrictEqual(oldEntries[name], next)) continue;
      const oldVersion = version(oldEntries[name]);
      const newVersion = version(next);
      if (oldVersion.prefix !== newVersion.prefix || order(newVersion, oldVersion) <= 0) {
        throw new Error(`Expected an upgrade preserving the range prefix for ${name}`);
      }
      updates.push({ name, before: oldVersion, after: newVersion });
    }
  }
  return updates;
}

export function alignPins(before, after) {
  const targets = new Map();
  for (const [file, manifest] of Object.entries(after)) {
    for (const update of manifestUpdates(before[file], manifest)) {
      const existing = targets.get(update.name);
      if (existing && existing.after.text !== update.after.text) throw new Error(`Conflicting upgrades for ${update.name}`);
      if (!existing) targets.set(update.name, { ...update, previous: new Set() });
      targets.get(update.name).previous.add(update.before.text);
    }
  }
  const result = structuredClone(after);
  for (const [file, manifest] of Object.entries(result)) {
    for (const section of sections) {
      for (const [name, current] of Object.entries(manifest[section] ?? {})) {
        const target = targets.get(name);
        if (!target || typeof current !== "string" || !/^[~^]?\d+\.\d+\.\d+$/.test(current)) continue;
        const pin = version(current);
        const rootPin = file === "package.json";
        const sameLine = pin.number[0] === target.after.number[0];
        if (rootPin && ["overrides", "resolutions"].includes(section) && !sameLine) {
          throw new Error(`Root ${section}.${name} conflicts with ${target.after.text}; maintainer alignment required`);
        }
        if (!target.previous.has(pin.text) && !(rootPin && sameLine)) continue;
        if (order(pin, target.after) > 0) throw new Error(`Refusing to downgrade ${file}:${name}`);
        manifest[section][name] = `${pin.prefix}${target.after.text}`;
      }
    }
  }
  return { manifests: result, packages: [...targets.keys()].sort() };
}

export function assertDependabotPr(pr, repository) {
  if (pr.state !== "open" || pr.user?.login !== "dependabot[bot]" ||
      pr.head?.repo?.full_name !== repository || pr.base?.repo?.full_name !== repository ||
      !/^dependabot\/(?:npm_and_yarn|bun|github_actions)\//.test(pr.head?.ref ?? "") ||
      !/^[a-f0-9]{40}$/.test(pr.head?.sha ?? "")) {
    throw new Error("Expected an open, same-repository Dependabot dependency PR");
  }
}

export function syncPaths(root) {
  const tracked = git(root, "ls-files", "-z").split("\0").filter(Boolean);
  const manifests = tracked.filter((file) => manifestPattern.test(file));
  // Read ownership markers from the trusted checkout, rather than accepting paths
  // supplied by a PR or artifact. The existing docs generator owns this inventory.
  const generated = tracked.filter((file) => file.startsWith("docs/") && /\.(?:mdx|json)$/.test(file))
    .filter((file) => /^(?:generator: scripts\/docs\/generate\.mjs|  "generator": "scripts\/docs\/generate\.mjs",?)$/m.test(readFileSync(resolve(root, file), "utf8")));
  const actions = tracked.filter((file) => /^\.github\/(?:workflows\/[^/]+\.ya?ml|actions\/.+\/action\.ya?ml)$/.test(file));
  return { manifests, generated, actions, allowed: new Set([...manifests, "bun.lock", ...generated]) };
}

export function assertActionUpdates(before, after) {
  // Accept only the pinned commit in an existing uses entry. Permissions, shell
  // steps, action identities, comments and floating refs need maintainer review.
  const normalize = (source) => source.replace(/^([ \t]*(?:-[ \t]+)?uses:[ \t]+[\w./-]+@)[a-f0-9]{40}([ \t]*(?:#.*)?)$/gm, "$1<commit>$2");
  if (normalize(before) !== normalize(after)) throw new Error("Only pinned action commit updates are eligible");
}

function assertRegular(root, file) {
  const parts = file.split("/");
  for (let length = 1; length <= parts.length; length++) {
    if (lstatSync(resolve(root, ...parts.slice(0, length))).isSymbolicLink()) throw new Error(`Symlink is not eligible: ${file}`);
  }
  if (!lstatSync(resolve(root, file)).isFile()) throw new Error(`Expected a regular file: ${file}`);
}

export function prepareSync({ root, trustedRoot, event, output, run = execFileSync }) {
  const pr = event.pull_request;
  const repository = event.repository.full_name;
  assertDependabotPr(pr, repository);
  if (git(root, "rev-parse", "HEAD").trim() !== pr.head.sha ||
      git(trustedRoot, "rev-parse", "HEAD").trim() !== pr.base.sha) throw new Error("Checkout does not match the event");
  if (git(root, "status", "--porcelain").trim()) throw new Error("Candidate checkout must be clean");
  const baseline = git(root, "merge-base", "HEAD", pr.base.sha).trim();
  const { manifests, generated, actions, allowed } = syncPaths(trustedRoot);
  const actionPr = pr.head.ref.startsWith("dependabot/github_actions/");
  const eligible = actionPr ? new Set([...actions, ...generated]) : allowed;
  const changes = git(root, "diff", "--name-status", "--no-renames", baseline, "HEAD").trim().split("\n").filter(Boolean);
  for (const change of changes) {
    const [status, file] = change.split("\t");
    if (status !== "M" || !eligible.has(file)) throw new Error(`Unexpected PR change: ${change}`);
    assertRegular(root, file);
    if (git(root, "ls-tree", "HEAD", "--", file).split(" ")[0] !== "100644") throw new Error(`Unexpected file mode: ${file}`);
    if (actions.includes(file)) assertActionUpdates(git(root, "show", `${baseline}:${file}`), readFileSync(resolve(root, file), "utf8"));
  }
  const before = Object.fromEntries(manifests.map((file) => [file, JSON.parse(git(root, "show", `${baseline}:${file}`))]));
  const after = Object.fromEntries(manifests.map((file) => [file, readJson(root, file)]));
  const aligned = alignPins(before, after);
  for (const file of manifests) {
    if (!isDeepStrictEqual(after[file], aligned.manifests[file])) {
      writeFileSync(resolve(root, file), `${JSON.stringify(aligned.manifests[file], null, 2)}\n`);
    }
  }
  // Resolve the requested upgrades without running package lifecycle scripts.
  // Tool types are pinned too, so an unrelated `latest` tag cannot drift here.
  if (aligned.packages.length) run("bun", ["update", "--lockfile-only", "--ignore-scripts", ...aligned.packages], { cwd: root, stdio: "inherit" });
  run("bun", ["install", "--frozen-lockfile", "--ignore-scripts"], { cwd: root, stdio: "inherit" });
  run("node", [resolve(root, "scripts/docs/generate.mjs")], { cwd: root, stdio: "inherit" });
  run("node", [resolve(root, "scripts/docs/generate.mjs"), "--check"], { cwd: root, stdio: "inherit" });
  const repaired = git(root, "diff", "--name-only", "HEAD", "-z").split("\0").filter(Boolean);
  const files = repaired.map((file) => {
    if (!allowed.has(file)) throw new Error(`Generator changed an unexpected path: ${file}`);
    assertRegular(root, file);
    if (manifests.includes(file)) manifestUpdates(after[file], readJson(root, file));
    return { path: file, content: readFileSync(resolve(root, file)).toString("base64") };
  });
  const bundle = { repository, number: pr.number, headSha: pr.head.sha, files };
  writeFileSync(output, `${JSON.stringify(bundle)}\n`);
  return bundle;
}

function syncRunPr(run, repository) {
  if (run.event !== "pull_request" || run.status !== "completed" || run.conclusion !== "success" ||
      run.name !== "Dependabot Sync" || run.path !== ".github/workflows/dependabot-sync.yml" ||
      run.repository?.full_name !== repository || run.head_repository?.full_name !== repository ||
      !/^[a-f0-9]{40}$/.test(run.head_sha ?? "") || !Number.isSafeInteger(run.id) || run.id <= 0 ||
      run.pull_requests?.length !== 1 || !Number.isSafeInteger(run.pull_requests[0].number)) {
    throw new Error("Expected a successful same-repository Dependabot Sync PR run");
  }
  return run.pull_requests[0].number;
}

export async function syncPublication({ github, repository, run }) {
  const number = syncRunPr(run, repository);
  const [owner, repo] = repository.split("/");
  const { data: pr } = await github.rest.pulls.get({ owner, repo, pull_number: number });
  if (pr.state !== "open") return { skipped: "PR is no longer open" };
  assertDependabotPr(pr, repository);
  if (pr.head.sha !== run.head_sha || pr.head.ref !== run.head_branch) return { skipped: "PR head changed" };
  const { data } = await github.rest.actions.listWorkflowRunArtifacts({ owner, repo, run_id: run.id, per_page: 100 });
  const artifacts = data.artifacts.filter((artifact) => artifact.name === "dependabot-sync" && !artifact.expired);
  if (!artifacts.length) return { skipped: "Already synchronized; no repair artifact" };
  if (artifacts.length !== 1) throw new Error("Expected exactly one repair artifact");
  return { number, artifactId: artifacts[0].id };
}

// The workflow_run publisher consumes data only. It never executes PR code,
// installs PR dependencies, applies patches, or force-pushes a branch.
export async function publishSync({ github, repository, run, bundle, trustedRoot }) {
  const number = syncRunPr(run, repository);
  const [owner, repo] = repository.split("/");
  const coordinates = { owner, repo };
  if (bundle.repository !== repository || bundle.number !== number || bundle.headSha !== run.head_sha || !Array.isArray(bundle.files)) throw new Error("Artifact belongs to a different PR or run head");
  const { data: pr } = await github.rest.pulls.get({ ...coordinates, pull_number: number });
  if (pr.state !== "open") return { skipped: "PR is no longer open" };
  assertDependabotPr(pr, repository);
  if (pr.head.sha !== bundle.headSha || pr.head.ref !== run.head_branch) return { skipped: "PR head changed; a newer run will synchronize it" };
  const { manifests, allowed } = syncPaths(trustedRoot);
  const seen = new Set();
  const entries = [];
  for (const file of bundle.files) {
    if (!allowed.has(file.path) || seen.has(file.path) || typeof file.content !== "string") throw new Error("Unexpected artifact file");
    seen.add(file.path);
    const content = Buffer.from(file.content, "base64");
    if (content.toString("base64") !== file.content) throw new Error("Invalid artifact encoding");
    if (manifests.includes(file.path)) {
      const { data: original } = await github.rest.repos.getContent({ ...coordinates, path: file.path, ref: bundle.headSha });
      if (original.type !== "file" || original.encoding !== "base64") throw new Error("Expected a manifest file");
      manifestUpdates(JSON.parse(Buffer.from(original.content, "base64").toString()), JSON.parse(content.toString()));
    }
    entries.push({ path: file.path, content: file.content });
  }
  if (!entries.length) return { skipped: "Already synchronized" };
  const { data: parent } = await github.rest.git.getCommit({ ...coordinates, commit_sha: bundle.headSha });
  const tree = [];
  for (const entry of entries) {
    const { data: blob } = await github.rest.git.createBlob({ ...coordinates, content: entry.content, encoding: "base64" });
    tree.push({ path: entry.path, mode: "100644", type: "blob", sha: blob.sha });
  }
  const { data: nextTree } = await github.rest.git.createTree({ ...coordinates, base_tree: parent.tree.sha, tree });
  const { data: commit } = await github.rest.git.createCommit({
    ...coordinates,
    message: "chore(shared): synchronize Dependabot dependency files",
    tree: nextTree.sha,
    parents: [bundle.headSha],
  });
  // A concurrent update makes this fail as non-fast-forward. No newer work is lost.
  await github.rest.git.updateRef({ ...coordinates, ref: `heads/${pr.head.ref}`, sha: commit.sha, force: false });
  return { sha: commit.sha, files: entries.map((file) => file.path) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , root, trustedRoot, output] = process.argv;
  const bundle = prepareSync({ root: resolve(root), trustedRoot: resolve(trustedRoot), output: resolve(output), event: JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")) });
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${bundle.files.length > 0}\n`);
  console.log(`Prepared ${bundle.files.length} synchronized files for PR #${bundle.number}`);
}
