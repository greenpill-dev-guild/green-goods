import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { changedBetween, decide, isInput, SITES } from "./vercel-ignore.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (path) => readFileSync(resolve(ROOT, path), "utf8");
const sitesBuiltFor = (path) => Object.keys(SITES).filter((site) => isInput(site, path));

const compared = { site: "docs", ref: "feature/x", base: "aaaaaaa", head: "bbbbbbb" };

test("skips only when the comparison is known and misses every input", () => {
  assert.equal(decide({ ...compared, changed: ["tests/e2e/login.spec.ts"] }).build, false);

  const mustBuild = [
    { ...compared, changed: ["docs/docs/intro.mdx"] },
    { ...compared, changed: null },
    { ...compared, base: null, changed: [] },
    { ...compared, head: null, changed: [] },
    { ...compared, base: compared.head, changed: [] },
    { ...compared, ref: "main", changed: [] },
    { ...compared, ref: undefined, changed: [] },
    { ...compared, site: "marketing", changed: [] },
    { ...compared, site: undefined, changed: [] },
    { ...compared, site: "constructor", changed: [] },
  ];
  for (const input of mustBuild) assert.equal(decide(input).build, true, JSON.stringify(input));
});

test("paths no site is built from rebuild nothing", () => {
  for (const path of [
    "tests/e2e/login.spec.ts",
    ".claude/skills/plan/SKILL.md",
    ".plans/active/feature/plan.md",
    ".github/workflows/client.yml",
    "AGENTS.md",
    "scripts/quality/check-ontology.mjs",
    "packages/agent/src/index.ts",
    "packages/indexer/schema.graphql",
    "packages/contracts/src/GardenToken.sol",
  ]) {
    assert.deepEqual(sitesBuiltFor(path), [], path);
  }
});

test("each site rebuilds for what it ships and nothing else", () => {
  const expected = {
    "packages/admin/src/views/Garden/index.tsx": ["admin", "design"],
    "packages/client/src/views/Home/index.tsx": ["client", "design"],
    "packages/admin/vercel.json": ["admin"],
    "packages/shared/src/hooks/useWork.ts": ["client", "admin", "design"],
    "packages/shared/src/hooks/useWork.test.ts": [],
    "packages/shared/src/components/Button/Button.stories.tsx": ["design"],
    "packages/shared/.storybook/main.ts": ["design"],
    "packages/shared/AGENTS.md": ["design"],
    "packages/contracts/deployments/42161-latest.json": ["client", "admin", "design"],
    "docs/docs/intro.mdx": ["docs"],
    "scripts/data/qa-test-catalog.json": ["qa"],
    "bun.lock": ["client", "admin", "design", "docs", "qa"],
    "scripts/ops/vercel-ignore.mjs": ["client", "admin", "design", "docs", "qa"],
  };
  for (const [path, sites] of Object.entries(expected)) {
    assert.deepEqual(sitesBuiltFor(path), sites, path);
  }
});

test("covers the files each build reads from outside its own directory", () => {
  const designAssets = [
    ...read("packages/shared/.storybook/prepare-design-assets.mjs").matchAll(
      /^\s*from: "([^"]+)"/gm
    ),
  ].map((match) => match[1]);
  assert.ok(designAssets.length >= 5, "design assets not found; update this reader");
  for (const path of designAssets) assert.ok(isInput("design", path), `design reads ${path}`);

  const storyRoots = [
    ...read("packages/shared/.storybook/main.ts").matchAll(/"(?:\.\.\/)+(packages\/[^"*]+)\*\*/g),
  ].map((match) => match[1]);
  assert.ok(storyRoots.length >= 2, "story globs not found; update this reader");
  for (const root of storyRoots) {
    assert.ok(isInput("design", `${root}Example.stories.tsx`), `design globs ${root}`);
  }

  const qaReads = [
    ...read("packages/qa/build.mjs").matchAll(/path\.join\(\s*repoRoot,((?:\s*"[^"]+",?)+)\s*\)/g),
  ].map((match) => [...match[1].matchAll(/"([^"]+)"/g)].map((part) => part[1]).join("/"));
  assert.ok(qaReads.length >= 2, "qa reads not found; update this reader");
  for (const path of qaReads) assert.ok(isInput("qa", path), `qa reads ${path}`);
});

test("a changed file whose name is not plain ASCII still matches its site", () => {
  // git quotes and escapes such names unless it is asked for -z output, and a
  // quoted path matches no input prefix, which would skip a needed build.
  const repo = mkdtempSync(join(tmpdir(), "vercel-ignore-"));
  const git = (...args) =>
    execFileSync("git", ["-C", repo, ...args], {
      stdio: ["ignore", "pipe", "ignore"],
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "t",
        GIT_AUTHOR_EMAIL: "t@example.invalid",
        GIT_COMMITTER_NAME: "t",
        GIT_COMMITTER_EMAIL: "t@example.invalid",
      },
    });
  try {
    git("init", "--quiet", "-b", "main");
    mkdirSync(join(repo, "packages/qa"), { recursive: true });
    writeFileSync(join(repo, "packages/qa/index.html"), "base");
    git("add", "-A");
    git("commit", "--quiet", "-m", "base");

    const accented = "packages/qa/café.ts";
    writeFileSync(join(repo, accented), "x");
    writeFileSync(join(repo, "packages/qa/naïve name.ts"), "y");
    git("add", "-A");
    git("commit", "--quiet", "-m", "unusual");

    const changed = changedBetween("HEAD~1", "HEAD", repo);
    assert.deepEqual(changed, [accented, "packages/qa/naïve name.ts"]);
    for (const path of changed) assert.ok(isInput("qa", path), `qa is built from ${path}`);
    assert.equal(decide({ site: "qa", ref: "feature/x", base: "a", head: "b", changed }).build, true);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("every site's vercel.json calls this step with a site it knows", () => {
  const roots = {
    client: "packages/client",
    admin: "packages/admin",
    design: "packages/shared",
    docs: "docs",
    qa: "packages/qa",
  };
  assert.deepEqual(Object.keys(roots).sort(), Object.keys(SITES).sort());
  for (const [site, root] of Object.entries(roots)) {
    const { ignoreCommand } = JSON.parse(read(`${root}/vercel.json`));
    const [, script, calledSite] = /^node (\S+) (\S+)$/.exec(ignoreCommand ?? "") ?? [];
    assert.equal(calledSite, site, `${root}/vercel.json`);
    assert.ok(existsSync(resolve(ROOT, root, script)), `${root}/vercel.json -> ${script}`);
    assert.equal(resolve(ROOT, root, script), resolve(ROOT, "scripts/ops/vercel-ignore.mjs"));
  }
});
