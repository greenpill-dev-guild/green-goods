#!/usr/bin/env node
/**
 * Vercel Ignored Build Step for the five Green Goods sites.
 *
 * Every push creates a deployment for each Vercel project on this repository.
 * Vercel's own "skip unaffected projects" only understands workspace packages,
 * so a change under `tests/`, `scripts/`, `.claude/` or `.plans/` rebuilds every
 * site, and a restack rebuilds sites the branch never touched. This step asks
 * the narrower question: has anything this site is built from changed since it
 * last deployed on this branch?
 *
 * Exit 0 skips the build, exit 1 builds. Skipping is the only answer that can
 * lose a deploy, so every unknown builds: an unresolvable base commit, a failed
 * fetch, a git error, an unknown site, a crash in this file.
 *
 * Runs before install, from the project's Root Directory, in a depth-10 clone,
 * so it is dependency-free (node: builtins and git only).
 *
 * Callers: `ignoreCommand` in docs/vercel.json and
 * packages/{admin,client,qa,shared}/vercel.json.
 *
 * Ask what a site would do for the current checkout:
 *   VERCEL_GIT_COMMIT_REF=<branch> VERCEL_GIT_PREVIOUS_SHA=<sha> \
 *     node scripts/ops/vercel-ignore.mjs docs
 */
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// Production always builds: a missed input here would strand a release.
const ALWAYS_BUILD_REFS = new Set(["main"]);
// A branch with no deployment yet is compared with staging instead.
const FALLBACK_BRANCH = "develop";
const FETCH_TIMEOUT_MS = 20_000;

const TESTS = /\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)__tests__\//;
const STORIES = /\.stories\.[cm]?[jt]sx?$/;
const MARKDOWN = /\.md$/;
const STORYBOOK_ONLY = /^packages\/shared\/(\.storybook\/|vercel\.json$)/;

// Entries ending in "/" are directory prefixes; the rest are exact paths.
const TOOLCHAIN = [
  "package.json",
  "bun.lock",
  "bunfig.toml",
  "tsconfig.json",
  "tsconfig.base.json",
  "patches/",
  "scripts/postinstall/",
  "scripts/lib/",
  "scripts/dev/node-cli.js",
  "scripts/ops/vercel-ignore.mjs",
];
// The only contracts paths the web bundles import (the package's `exports`).
const CONTRACT_ARTIFACTS = [
  "packages/contracts/package.json",
  "packages/contracts/abis/",
  "packages/contracts/deployments/",
];
const APP_BUILD = [".env.schema", "scripts/dev/remove-public-sourcemaps.js"];

function app(name) {
  return {
    inputs: [
      ...TOOLCHAIN,
      ...APP_BUILD,
      ...CONTRACT_ARTIFACTS,
      `packages/${name}/`,
      "packages/shared/",
    ],
    // `tsc -b` typechecks tests and stories, but none of these reach the bundle.
    never: [TESTS, STORIES, MARKDOWN, STORYBOOK_ONLY],
  };
}

/**
 * What each site is built from. A path outside a site's `inputs` cannot change
 * its output. When a build starts reading a new file from outside its own
 * directory, add it here; vercel-ignore.test.mjs checks the known ones.
 */
export const SITES = {
  client: app("client"),
  admin: app("admin"),
  // Storybook globs admin and client stories (packages/shared/.storybook/main.ts)
  // and publishes the files listed in .storybook/prepare-design-assets.mjs.
  design: {
    inputs: [
      ...TOOLCHAIN,
      ...CONTRACT_ARTIFACTS,
      "packages/shared/",
      "packages/admin/src/",
      "packages/client/src/",
      "DESIGN.md",
      "packages/admin/DESIGN.md",
      "packages/client/DESIGN.browser.md",
      "packages/client/DESIGN.pwa.md",
      "docs/DESIGN.md",
      "docs/static/img/green-goods-logo.png",
      "scripts/design/build-story-gallery.mjs",
    ],
    never: [TESTS],
  },
  // Generated pages are committed under docs/docs, so docs/ is the whole site.
  // The repo-wide gates in docs/scripts/vercel-build.mjs check; they add nothing.
  docs: {
    inputs: [...TOOLCHAIN, "docs/"],
    never: [TESTS],
  },
  // packages/qa/build.mjs projects the catalog and copies one shared stylesheet.
  qa: {
    inputs: [
      ...TOOLCHAIN,
      "packages/qa/",
      "scripts/data/qa-test-catalog.json",
      "packages/shared/src/styles/design-md.generated.css",
    ],
    never: [TESTS],
  },
};

export function isInput(site, path) {
  const { inputs, never } = SITES[site];
  const listed = inputs.some((entry) =>
    entry.endsWith("/") ? path.startsWith(entry) : path === entry
  );
  return listed && !never.some((pattern) => pattern.test(path));
}

const build = (reason, matches = []) => ({ build: true, reason, matches });

// Verdicts that need no comparison, so the caller can leave git alone.
function settledWithoutComparing({ site, ref }) {
  if (!Object.hasOwn(SITES, site ?? "")) return build(`unknown site "${site}"`);
  // Without the branch, production cannot be told apart from a preview. Vercel
  // omits it when a project does not expose system environment variables.
  if (!ref) return build("branch unknown (VERCEL_GIT_COMMIT_REF is not set)");
  if (ALWAYS_BUILD_REFS.has(ref)) return build(`${ref} always builds`);
  return null;
}

/**
 * The decision, free of git and the environment. `base` and `head` are resolved
 * commit SHAs; `changed` is the list of paths that differ between them, or null
 * when it could not be read.
 */
export function decide({ site, ref, base, head, changed }) {
  const settled = settledWithoutComparing({ site, ref });
  if (settled) return settled;
  if (!base || !head) return build("no commit to compare with");
  // Usually a redeploy someone asked for, to pick up new environment variables.
  if (base === head) return build("this is the commit compared with, so nothing to judge");
  if (!Array.isArray(changed)) return build("could not read the changed files");
  const matches = changed.filter((path) => isInput(site, path));
  if (matches.length > 0) return build(`${matches.length} input file(s) changed`, matches);
  const reason = `none of ${changed.length} changed file(s) feed this site`;
  return { build: false, reason, matches };
}

function git(args, options = {}) {
  try {
    return execFileSync("git", args, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 64 * 1024 * 1024,
      ...options,
    }).trim();
  } catch {
    return null;
  }
}

function remotes(env) {
  const list = ["origin"];
  const owner = env.VERCEL_GIT_REPO_OWNER ?? "";
  const slug = env.VERCEL_GIT_REPO_SLUG ?? "";
  const named = /^[\w.-]+$/;
  if (env.VERCEL_GIT_PROVIDER === "github" && named.test(owner) && named.test(slug)) {
    list.push(`https://github.com/${owner}/${slug}.git`);
  }
  return list;
}

function fetchFrom(env, target) {
  // Only a clone that is already shallow may take --depth: on a full clone it
  // would rewrite the repository into a shallow one.
  const shallow = git(["rev-parse", "--is-shallow-repository"]) === "true";
  const depth = shallow ? ["--depth=1"] : [];
  return remotes(env).some(
    (remote) =>
      git(["fetch", "--quiet", "--no-tags", ...depth, remote, target], {
        timeout: FETCH_TIMEOUT_MS,
      }) !== null
  );
}

function resolveCommit(env, sha) {
  if (!/^[0-9a-f]{7,40}$/i.test(sha)) return null;
  const present = () => git(["rev-parse", "--verify", "--quiet", `${sha}^{commit}`]);
  // The previous deployment often sits outside a depth-10 clone, and after a
  // restack it is no longer an ancestor at all.
  return present() ?? (fetchFrom(env, sha) ? present() : null);
}

function resolveBase(env) {
  const at = (sha) => sha.slice(0, 9);
  const previous = env.VERCEL_GIT_PREVIOUS_SHA;
  if (previous) {
    const sha = resolveCommit(env, previous);
    return sha
      ? { sha, note: `compared with the last deployment on this branch (${at(sha)})` }
      : { sha, note: "the last deployment on this branch could not be fetched" };
  }
  if (env.VERCEL_GIT_COMMIT_REF === FALLBACK_BRANCH) {
    return { sha: null, note: `no earlier deployment of ${FALLBACK_BRANCH} to compare with` };
  }
  const tip = fetchFrom(env, FALLBACK_BRANCH)
    ? git(["rev-parse", "--verify", "--quiet", "FETCH_HEAD^{commit}"])
    : null;
  const first = "no deployment on this branch yet";
  return tip
    ? { sha: tip, note: `${first}, so compared with ${FALLBACK_BRANCH} (${at(tip)})` }
    : { sha: tip, note: `${first}, and ${FALLBACK_BRANCH} could not be fetched` };
}

const NUL = String.fromCharCode(0);

/**
 * The paths that differ between two commits, or null if git could not say.
 *
 * `-z` prints each name verbatim and separates them with NUL. Without it git
 * wraps anything outside plain ASCII in quotes with escapes, so
 * `packages/qa/café.ts` arrives as `"packages/qa/caf\303\251.ts"` — which no
 * longer starts with its site's input prefix, and would skip a needed build.
 *
 * `--no-renames` reports a file moved out of an input directory as a deletion
 * there, instead of only naming where it landed.
 */
export function changedBetween(base, head, cwd = ROOT) {
  const diff = git(["diff", "--name-only", "--no-renames", "-z", base, head], { cwd });
  return diff === null ? null : diff.split(NUL).filter(Boolean);
}

function compare(env) {
  const head = git(["rev-parse", "--verify", "--quiet", "HEAD^{commit}"]);
  const { sha: base, note } = resolveBase(env);
  const changed = base && head && base !== head ? changedBetween(base, head) : null;
  return { base, head, changed, note };
}

function main() {
  const env = process.env;
  const site = process.argv[2];
  const ref = env.VERCEL_GIT_COMMIT_REF;
  const say = (line) => process.stdout.write(`vercel-ignore: ${line}\n`);

  const compared = settledWithoutComparing({ site, ref }) ? null : compare(env);
  const verdict = decide({ site, ref, ...compared });
  say(`site=${site} ref=${ref ?? "?"}`);
  if (compared) say(compared.note);
  say(`${verdict.build ? "BUILD" : "SKIP"}: ${verdict.reason}`);
  for (const path of verdict.matches.slice(0, 5)) say(`  ${path}`);
  if (verdict.matches.length > 5) say(`  and ${verdict.matches.length - 5} more`);
  process.exit(verdict.build ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
