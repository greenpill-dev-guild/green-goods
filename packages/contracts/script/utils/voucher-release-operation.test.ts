import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { assertVoucherSourcesCommitted, voucherJsonPath } from "../deploy/voucher-release";
import { releaseRevision } from "./release-inputs";
const temporary: string[] = [];
function fixture() {
  const root = realpathSync(mkdtempSync(path.join(os.tmpdir(), "voucher-source-scope-")));
  temporary.push(root);
  const contracts = path.join(root, "packages/contracts");
  mkdirSync(contracts, { recursive: true });
  const env = { ...process.env };
  for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE"]) delete env[key];
  execFileSync("git", ["init", "--quiet", root], { env });
  return { root, contracts, env, manifest: path.join(contracts, "config/voucher-pilot-release.json") };
}
afterEach(() => {
  for (const p of temporary.splice(0)) rmSync(p, { recursive: true, force: true });
});
describe("voucher release source and output ownership", () => {
  it("captures a clean tracked revision and rejects ignored or dirty manifest inputs", () => {
    const f = fixture();
    mkdirSync(path.dirname(f.manifest), { recursive: true });
    writeFileSync(f.manifest, "{}");
    const git = (args: string[]) => execFileSync("git", args, { cwd: f.root, env: f.env, encoding: "utf8" });
    git(["add", "--", "packages/contracts/config/voucher-pilot-release.json"]);
    // Synthetic temporary repository, not the user's checkout or signing identity.
    git([
      "-c",
      "commit.gpgsign=false",
      "-c",
      "core.hooksPath=/dev/null",
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "--quiet",
      "-m",
      "fixture",
    ]);
    expect(releaseRevision(f.contracts, f.manifest)).toBe(git(["rev-parse", "HEAD"]).trim());
    writeFileSync(f.manifest, '{"changed":true}');
    expect(() => releaseRevision(f.contracts, f.manifest)).toThrow("unchanged deployment inputs");
    writeFileSync(path.join(f.root, ".gitignore"), "ignored.json\n");
    const ignored = path.join(f.contracts, "config/ignored.json");
    writeFileSync(ignored, "{}");
    writeFileSync(f.manifest, "{}");
    expect(() => releaseRevision(f.contracts, ignored)).toThrow();
  });
  it("rejects dirty vendored/build inputs without blocking unrelated notes", () => {
    const f = fixture();
    mkdirSync(path.join(f.root, "notes"));
    writeFileSync(path.join(f.root, "notes/unrelated.md"), "separate work");
    expect(() => assertVoucherSourcesCommitted(f.contracts, f.manifest)).not.toThrow();
    mkdirSync(path.join(f.contracts, "lib/vendor"), { recursive: true });
    const dependency = path.join(f.contracts, "lib/vendor/Fixture.sol");
    writeFileSync(dependency, "// synthetic dependency fixture");
    expect(() => assertVoucherSourcesCommitted(f.contracts, f.manifest)).toThrow("unchanged deployment inputs");
    rmSync(dependency);
    writeFileSync(path.join(f.root, "bunfig.toml"), "[install]\n");
    expect(() => assertVoucherSourcesCommitted(f.contracts, f.manifest)).toThrow("unchanged deployment inputs");
  });
  it("confines JSON output to the owned directory and rejects traversal or sibling prefixes", () => {
    const f = fixture(),
      owned = path.join(f.contracts, ".generated/voucher-release");
    mkdirSync(owned, { recursive: true });
    expect(voucherJsonPath(owned, path.join(owned, "candidate.json"))).toBe(path.join(owned, "candidate.json"));
    for (const target of [
      path.join(f.contracts, "deployments/100-latest.json"),
      `${owned}-sibling/receipt.json`,
      path.join(owned, "../other.json"),
      path.join(owned, "candidate.env"),
    ])
      expect(() => voucherJsonPath(owned, target)).toThrow("owned JSON directory");
  });
  it("rejects symlink escapes before reading or writing canonical evidence", () => {
    const f = fixture(),
      owned = path.join(f.contracts, ".generated/voucher-release"),
      outside = path.join(f.contracts, "deployments");
    mkdirSync(owned, { recursive: true });
    mkdirSync(outside);
    writeFileSync(path.join(outside, "100-latest.json"), "original canonical evidence");
    symlinkSync(outside, path.join(owned, "escape"));
    expect(() => voucherJsonPath(owned, path.join(owned, "escape/100-latest.json"))).toThrow("symlinks");
    expect(readFileSync(path.join(outside, "100-latest.json"), "utf8")).toBe("original canonical evidence");
  });
});
