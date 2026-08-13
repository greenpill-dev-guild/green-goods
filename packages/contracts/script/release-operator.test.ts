import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertAllowedOperatorCommand,
  assertAutomatedPinnedCheckout,
  assertPinnedCheckout,
  AUTOMATED_RELEASE_STAGE_ORDER,
  createPasswordLease,
  parseSessionOptions,
  RELEASE_OPERATOR_COMMANDS,
  tokenizeOperatorCommand,
} from "./release-operator";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("release operator session", () => {
  it("requires the exact pinned candidate commit before unlocking", () => {
    expect(() => parseSessionOptions([])).toThrow(/requires --commit/);
    expect(() => parseSessionOptions(["--commit", "abc"])).toThrow(/requires --commit/);
    expect(parseSessionOptions(["--commit", "a".repeat(40)])).toEqual({
      commit: "a".repeat(40),
      help: false,
      deployAll: false,
    });
    expect(parseSessionOptions(["--commit", "a".repeat(40), "--deploy-all"])).toEqual({
      commit: "a".repeat(40),
      help: false,
      deployAll: true,
    });
    expect(parseSessionOptions(["--help"])).toEqual({ help: true, deployAll: false });
  });

  it("allows only canonical deployment artifacts to change during automated release", () => {
    const repository = fs.mkdtempSync(path.join(os.tmpdir(), "release-automation-repository-"));
    temporaryDirectories.push(repository);
    const git = (args: string[]) =>
      execFileSync("git", args, { cwd: repository, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    git(["init"]);
    git(["config", "user.name", "Release Operator Test"]);
    git(["config", "user.email", "release-operator@example.invalid"]);
    git(["config", "commit.gpgsign", "false"]);
    fs.mkdirSync(path.join(repository, "deployments"));
    fs.writeFileSync(path.join(repository, "deployments/42161-latest.json"), "{}\n");
    fs.writeFileSync(path.join(repository, "reviewed.txt"), "reviewed\n");
    git(["add", "deployments/42161-latest.json", "reviewed.txt"]);
    git(["commit", "-m", "test: freeze release"]);
    const candidate = git(["rev-parse", "HEAD"]);
    const allowed = new Set(["deployments/42161-latest.json"]);

    fs.writeFileSync(path.join(repository, "deployments/42161-latest.json"), '{"pooling":"deployed"}\n');
    expect(() => assertAutomatedPinnedCheckout(candidate, repository, allowed)).not.toThrow();
    fs.appendFileSync(path.join(repository, "reviewed.txt"), "drift\n");
    expect(() => assertAutomatedPinnedCheckout(candidate, repository, allowed)).toThrow(/concurrent checkout drift/);
  });

  it("keeps the automated release in the frozen dependency order", () => {
    expect(AUTOMATED_RELEASE_STAGE_ORDER).toEqual([
      "assessment-resolver",
      "schema-preparation",
      "pooling",
      "schema-finalization",
      "settlement-module",
      "credit-registry",
      "pooling-integration-upgrade",
      "settlement-executor",
    ]);
  });

  it("rejects checkout drift before a release boundary executes", () => {
    const repository = fs.mkdtempSync(path.join(os.tmpdir(), "release-operator-repository-"));
    temporaryDirectories.push(repository);
    const git = (args: string[]) =>
      execFileSync("git", args, { cwd: repository, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    git(["init"]);
    git(["config", "user.name", "Release Operator Test"]);
    git(["config", "user.email", "release-operator@example.invalid"]);
    git(["config", "commit.gpgsign", "false"]);
    fs.writeFileSync(path.join(repository, "reviewed.txt"), "reviewed\n");
    git(["add", "reviewed.txt"]);
    git(["commit", "-m", "test: freeze candidate"]);
    const candidate = git(["rev-parse", "HEAD"]);

    expect(() => assertPinnedCheckout(candidate, repository)).not.toThrow();
    fs.appendFileSync(path.join(repository, "reviewed.txt"), "drift\n");
    expect(() => assertPinnedCheckout(candidate, repository)).toThrow(/checkout to stay clean/);
  });

  it("accepts only allowlisted Bun wrappers and never credential or RPC overrides", () => {
    const tokens = tokenizeOperatorCommand(
      'run pooling:schemas:arbitrum --step 2 --expected-nonce 123 --artifact "reviewed plan.json"',
    );
    expect(assertAllowedOperatorCommand(tokens)).toEqual({
      script: "pooling:schemas:arbitrum",
      args: ["--step", "2", "--expected-nonce", "123", "--artifact", "reviewed plan.json"],
    });
    expect(() => assertAllowedOperatorCommand(tokenizeOperatorCommand("run test"))).toThrow(/not allowlisted/);
    expect(() =>
      assertAllowedOperatorCommand(
        tokenizeOperatorCommand("run settlement:module:deploy:arbitrum --private-key 0x1234"),
      ),
    ).toThrow(/controlled by the frozen release session/);
    expect(() =>
      assertAllowedOperatorCommand(
        tokenizeOperatorCommand("run settlement:module:deploy:arbitrum --network celo --step 1"),
      ),
    ).toThrow(/controlled by the frozen release session/);
    expect(() =>
      assertAllowedOperatorCommand(
        tokenizeOperatorCommand("run settlement:module:deploy:arbitrum --sender 0x1234 --step 1"),
      ),
    ).toThrow(/controlled by the frozen release session/);
    expect(() =>
      assertAllowedOperatorCommand(tokenizeOperatorCommand("run pooling:deploy:arbitrum --artifact plan.json")),
    ).toThrow(/not allowlisted/);
    expect(() => assertAllowedOperatorCommand(tokenizeOperatorCommand("run pooling:deploy:arbitrum --step"))).toThrow(
      /requires a value/,
    );
    expect(() => tokenizeOperatorCommand("run 'unterminated")).toThrow(/Unclosed quote/);
  });

  it("excludes ownership and backfill from the paused deployer-owned ceremony", () => {
    expect([...RELEASE_OPERATOR_COMMANDS.keys()]).not.toContain("release:ownership:arbitrum");
    expect([...RELEASE_OPERATOR_COMMANDS.keys()]).not.toContain("release:ownership:celo");
    expect([...RELEASE_OPERATOR_COMMANDS.keys()]).not.toContain("pooling:backfill:arbitrum");
    expect(() =>
      assertAllowedOperatorCommand(tokenizeOperatorCommand("run release:ownership:arbitrum --step 1")),
    ).toThrow(/not allowlisted/);
    expect(() =>
      assertAllowedOperatorCommand(tokenizeOperatorCommand("run pooling:backfill:arbitrum --step 1")),
    ).toThrow(/not allowlisted/);
  });

  it("accepts exact mined-receipt recovery for every current deployer-signed wrapper", () => {
    const receipt = `0x${"ab".repeat(32)}`;
    const commands = [
      "assessment:upgrade:arbitrum",
      "pooling:schemas:arbitrum",
      "pooling:deploy:arbitrum",
      "pooling:finalize:arbitrum",
      "settlement:module:deploy:arbitrum",
      "credit:registry:deploy:arbitrum",
      "pooling:upgrade:arbitrum",
      "settlement:executor:deploy:celo",
    ];
    for (const command of commands) {
      expect(assertAllowedOperatorCommand(tokenizeOperatorCommand(`run ${command} --receipt ${receipt}`))).toEqual({
        script: command,
        args: ["--receipt", receipt],
      });
    }
  });

  it("uses a private 0600 password file and removes it when the session closes", () => {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "release-operator-test-"));
    temporaryDirectories.push(temporaryRoot);
    const lease = createPasswordLease("dummy-password", temporaryRoot);
    expect(fs.readFileSync(lease.filePath, "utf8")).toBe("dummy-password\n");
    expect(fs.statSync(lease.filePath).mode & 0o777).toBe(0o600);
    const directory = path.dirname(lease.filePath);
    lease.close();
    expect(fs.existsSync(lease.filePath)).toBe(false);
    expect(fs.existsSync(directory)).toBe(false);
    expect(() => lease.close()).not.toThrow();
  });
});
