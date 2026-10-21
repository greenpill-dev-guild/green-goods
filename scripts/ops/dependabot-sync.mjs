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
        if (!rootPin && !target.previous.has(pin.text)) continue;
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
      !/^dependabot\/(?:npm_and_yarn|bun)\//.test(pr.head?.ref ?? "") ||
      !/^[a-f0-9]{40}$/.test(pr.head?.sha ?? "")) {
    throw new Error("Expected an open, same-repository Dependabot package PR");
  }
}

export function syncPaths(root) {
  const tracked = git(root, "ls-files", "-z").split("\0").filter(Boolean);
  const manifests = tracked.filter((file) => manifestPattern.test(file));
  // Read ownership markers from the trusted checkout, rather than accepting paths
  // supplied by a PR or artifact. The existing docs generator owns this inventory.
  const generated = tracked.filter((file) => file.startsWith("docs/") && /\.(?:mdx|json)$/.test(file))
    .filter((file) => /^(?:generator: scripts\/docs\/generate\.mjs|  "generator": "scripts\/docs\/generate\.mjs",?)$/m.test(readFileSync(resolve(root, file), "utf8")));
  return { manifests, allowed: new Set([...manifests, "bun.lock", ...generated]) };
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
  const { manifests, allowed } = syncPaths(trustedRoot);
  const changes = git(root, "diff", "--name-status", "--no-renames", baseline, "HEAD").trim().split("\n").filter(Boolean);
  for (const change of changes) {
    const [status, file] = change.split("\t");
    if (status !== "M" || !allowed.has(file)) throw new Error(`Unexpected PR change: ${change}`);
    assertRegular(root, file);
    if (git(root, "ls-tree", "HEAD", "--", file).split(" ")[0] !== "100644") throw new Error(`Unexpected file mode: ${file}`);
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , root, trustedRoot, output] = process.argv;
  const bundle = prepareSync({ root: resolve(root), trustedRoot: resolve(trustedRoot), output: resolve(output), event: JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")) });
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${bundle.files.length > 0}\n`);
  console.log(`Prepared ${bundle.files.length} synchronized files for PR #${bundle.number}`);
}
