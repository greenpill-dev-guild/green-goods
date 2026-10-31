/** @direct-test-subject ./source-upgrade-resume */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { sourceUpgradePlanRevision } from "./source-upgrade-resume";

const directories: string[] = [];
afterEach(() => {
  for (const root of directories.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});
function fixture() {
  const repository = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "source-plan-resume-")));
  directories.push(repository);
  const root = repository + "/packages/contracts";
  fs.mkdirSync(root, { recursive: true });
  const env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Resume fixture",
    GIT_AUTHOR_EMAIL: "resume-fixture@example.invalid",
    GIT_COMMITTER_NAME: "Resume fixture",
    GIT_COMMITTER_EMAIL: "resume-fixture@example.invalid",
  };
  const git = (...args: string[]) =>
    execFileSync("git", ["-c", "commit.gpgsign=false", ...args], {
      cwd: root,
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  execFileSync("git", ["init", repository], { env, stdio: "ignore" });
  fs.mkdirSync(root + "/src");
  fs.mkdirSync(root + "/script");
  fs.mkdirSync(root + "/config");
  fs.writeFileSync(root + "/src/Module.sol", "public fixture source");
  fs.writeFileSync(root + "/config/release.json", "{}");
  git("add", "src/Module.sol", "config/release.json");
  git("commit", "-m", "fixture source");
  const planned = git("rev-parse", "HEAD");
  const commit = (file: string, text: string) => {
    fs.writeFileSync(root + "/" + file, text);
    git("add", "--", file);
    git("commit", "-m", "fixture change");
    return git("rev-parse", "HEAD");
  };
  return { root, planned, commit, git, manifest: root + "/config/release.json" };
}
describe("explicit source CREATE plan resume", () => {
  it("keeps the original revision without requiring a resume at the same HEAD", () => {
    const f = fixture();
    expect(sourceUpgradePlanRevision(f.root, f.manifest, f.planned, f.planned, false)).toBe(f.planned);
  });
  it("permits a descendant operator-only checkpoint without changing the plan's source revision", () => {
    const f = fixture(),
      current = f.commit("script/operator.ts", "public tooling revision");
    expect(sourceUpgradePlanRevision(f.root, f.manifest, current, f.planned, true)).toBe(f.planned);
  });
  it("requires the explicit resume flag after a new tooling commit", () => {
    const f = fixture(),
      current = f.commit("script/operator.ts", "public tooling revision");
    expect(() => sourceUpgradePlanRevision(f.root, f.manifest, current, f.planned, false)).toThrow("resume-plan");
  });
  it("rejects changed Solidity despite an explicit resume request", () => {
    const f = fixture(),
      current = f.commit("src/Module.sol", "different deployed source");
    expect(() => sourceUpgradePlanRevision(f.root, f.manifest, current, f.planned, true)).toThrow();
  });
  it("rejects changed manifest or compiler settings", () => {
    for (const file of ["config/release.json", "foundry.toml"]) {
      const f = fixture(),
        current = f.commit(file, "changed release input");
      expect(() => sourceUpgradePlanRevision(f.root, f.manifest, current, f.planned, true)).toThrow();
    }
  });
  it("rejects a revision outside the current candidate's ancestry", () => {
    const f = fixture(),
      future = f.commit("script/operator.ts", "future tooling");
    expect(() => sourceUpgradePlanRevision(f.root, f.manifest, f.planned, future, true)).toThrow();
  });
});
