import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  AUTOMATED_RELEASE_EXCLUSIONS,
  AUTOMATED_RELEASE_STAGE_ORDER,
  assertAllowedOperatorCommand,
  assertAutomatedPinnedCheckout,
  assertAutomatedResumeStart,
  assertAutomatedSessionStart,
  assertGardenSafeSessionStart,
  assertPinnedCheckout,
  assertPlanCanResume,
  type CompleteSequenceAuthorization,
  changedPromotionLeafPaths,
  completedBoundaries,
  createPasswordLease,
  POOL_BACKFILL_REGISTRATION_BOUNDARIES,
  parseSessionOptions,
  planBoundaryExecutionSteps,
  RELEASE_OPERATOR_COMMANDS,
  shouldGenerateReviewedPlan,
  tokenizeOperatorCommand,
  validateCompleteSequenceAuthorization,
} from "./release-operator";
import type { ReleaseLock, ReleaseManifest } from "./utils/release-manifest";

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
      backfillAll: false,
      unpausePooling: false,
    });
    expect(() => parseSessionOptions(["--commit", "a".repeat(40), "--deploy-all"])).toThrow(/--authorization/);
    expect(
      parseSessionOptions([
        "--commit",
        "a".repeat(40),
        "--deploy-all",
        "--authorization",
        "/tmp/release-authorization.json",
      ]),
    ).toEqual({
      commit: "a".repeat(40),
      authorization: "/tmp/release-authorization.json",
      help: false,
      deployAll: true,
      backfillAll: false,
      unpausePooling: false,
    });
    expect(parseSessionOptions(["--commit", "a".repeat(40), "--backfill-all"])).toMatchObject({
      backfillAll: true,
      deployAll: false,
      unpausePooling: false,
    });
    expect(parseSessionOptions(["--commit", "a".repeat(40), "--unpause-pooling"])).toMatchObject({
      backfillAll: false,
      deployAll: false,
      unpausePooling: true,
    });
    expect(() => parseSessionOptions(["--commit", "a".repeat(40), "--backfill-all", "--unpause-pooling"])).toThrow(
      "only one automated release mode",
    );
    expect(() =>
      parseSessionOptions(["--commit", "a".repeat(40), "--authorization", "/tmp/release-authorization.json"]),
    ).toThrow(/only with --deploy-all/);
    expect(parseSessionOptions(["--help"])).toEqual({
      help: true,
      deployAll: false,
      backfillAll: false,
      unpausePooling: false,
    });
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
    const authorizationDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "release-authorization-"));
    temporaryDirectories.push(authorizationDirectory);
    const authorizationPath = path.join(authorizationDirectory, "release-authorization.json");
    const authorization = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../config/commitment-pooling-release-automation-authorization.json"),
        "utf8",
      ),
    ) as CompleteSequenceAuthorization;
    fs.writeFileSync(
      authorizationPath,
      `${JSON.stringify({ ...authorization, operatorCandidateCommit: candidate }, null, 2)}\n`,
      { mode: 0o600 },
    );

    fs.writeFileSync(path.join(repository, "deployments/42161-latest.json"), '{"pooling":"deployed"}\n');
    expect(() => assertAutomatedPinnedCheckout(candidate, repository, allowed)).not.toThrow();
    const validated: string[][] = [];
    expect(() =>
      assertAutomatedSessionStart(
        candidate,
        authorizationPath,
        repository,
        (_candidate, _root, dirtyPaths) => {
          validated.push(dirtyPaths);
        },
        allowed,
      ),
    ).not.toThrow();
    expect(validated).toEqual([["deployments/42161-latest.json"]]);
    validated.length = 0;
    expect(() =>
      assertAutomatedResumeStart(
        candidate,
        repository,
        (_candidate, _root, dirtyPaths) => {
          validated.push(dirtyPaths);
        },
        allowed,
      ),
    ).not.toThrow();
    expect(validated).toEqual([["deployments/42161-latest.json"]]);
    fs.appendFileSync(path.join(repository, "reviewed.txt"), "drift\n");
    expect(() => assertAutomatedPinnedCheckout(candidate, repository, allowed)).toThrow(/concurrent checkout drift/);
  });

  it("allows only an exactly verified Garden Safe artifact between bootstrap and owner swap", () => {
    const repository = fs.mkdtempSync(path.join(os.tmpdir(), "garden-safe-operator-repository-"));
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
    const artifact = "packages/contracts/deployments/42220-settlement-safes.json";
    fs.mkdirSync(path.dirname(path.join(repository, artifact)), { recursive: true });
    fs.writeFileSync(path.join(repository, artifact), '{"stage":"bootstrap"}\n');
    const validated: string[][] = [];

    expect(() =>
      assertGardenSafeSessionStart(
        candidate,
        repository,
        (_candidate, _root, dirtyPaths) => validated.push(dirtyPaths),
        new Set([artifact]),
      ),
    ).not.toThrow();
    expect(validated).toEqual([[artifact]]);
    fs.appendFileSync(path.join(repository, "reviewed.txt"), "drift\n");
    expect(() => assertGardenSafeSessionStart(candidate, repository, () => undefined, new Set([artifact]))).toThrow(
      /concurrent checkout drift/,
    );
  });

  it("binds one-command deployment to the exact reviewed sequence authorization", () => {
    const authorization: CompleteSequenceAuthorization = {
      schemaVersion: 2,
      kind: "PAUSED_RELEASE_COMPLETE_SEQUENCE_AUTHORIZATION",
      operatorCandidateCommit: "1".repeat(40),
      releaseId: "release-v1",
      releaseManifestHash: `0x${"ab".repeat(32)}`,
      releaseSourceCommit: "1".repeat(40),
      terminalState: "paused-deployer-owned",
      authorizedStages: [...AUTOMATED_RELEASE_STAGE_ORDER],
      excludedActions: [...AUTOMATED_RELEASE_EXCLUSIONS],
      authorizedBy: "Release owner",
      authorizedOn: "2026-08-12",
      authorizationRecord: "reviewed-release-handoff.md",
    };
    const manifest = { releaseId: authorization.releaseId } as ReleaseManifest;
    const lock = {
      releaseId: authorization.releaseId,
      manifestHash: authorization.releaseManifestHash,
      sourceCommit: authorization.releaseSourceCommit,
    } as ReleaseLock;

    expect(() =>
      validateCompleteSequenceAuthorization(authorization, manifest, lock, authorization.operatorCandidateCommit),
    ).not.toThrow();
    expect(() => validateCompleteSequenceAuthorization(authorization, manifest, lock, "2".repeat(40))).toThrow(
      /exact reviewed authorization/,
    );
    expect(() =>
      validateCompleteSequenceAuthorization(
        { ...authorization, authorizedStages: authorization.authorizedStages.slice(1) },
        manifest,
        lock,
        authorization.operatorCandidateCommit,
      ),
    ).toThrow(/exact reviewed authorization/);
  });

  it("validates newly added promotion objects at their exact leaf paths", () => {
    expect(
      changedPromotionLeafPaths(
        {},
        {
          releaseReceipts: {
            settlementModule: { transactionHash: `0x${"ab".repeat(32)}`, blockNumber: 493971677 },
          },
        },
      ),
    ).toEqual(["releaseReceipts.settlementModule.transactionHash", "releaseReceipts.settlementModule.blockNumber"]);
    expect(changedPromotionLeafPaths({ releaseReceipts: "owned" }, { releaseReceipts: {} })).toEqual([
      "releaseReceipts",
    ]);
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

  it("uses the real stage checkpoint and replays the last verified boundary before resuming", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "release-stage-resume-"));
    temporaryDirectories.push(directory);
    const planPath = path.join(directory, "pooling-transaction-plan.json");
    const checkpointPath = path.join(directory, "pooling-checkpoint.json");
    fs.writeFileSync(
      planPath,
      `${JSON.stringify({ transactions: [{ nonce: 40 }, { nonce: 41 }, { nonce: 42 }] }, null, 2)}\n`,
    );
    fs.writeFileSync(
      checkpointPath,
      `${JSON.stringify({ lastVerifiedStep: 1, verifiedBoundaries: [{ index: 1 }] }, null, 2)}\n`,
    );

    expect(completedBoundaries(planPath, checkpointPath)).toBe(1);
    expect(planBoundaryExecutionSteps(planPath, checkpointPath)).toEqual([1, 2, 3]);
    expect(() => assertPlanCanResume(planPath, checkpointPath, 41)).not.toThrow();
    expect(() => assertPlanCanResume(planPath, checkpointPath, 40)).toThrow(/next reviewed nonce is 41/);
  });

  it("preserves an uncheckpointed reviewed plan when the live nonce has advanced", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "release-plan-preservation-"));
    temporaryDirectories.push(directory);
    const planPath = path.join(directory, "pooling-transaction-plan.json");
    const checkpointPath = path.join(directory, "pooling-checkpoint.json");
    const plan = `${JSON.stringify({ expectedNonce: 80, transactions: [{ nonce: 80 }] }, null, 2)}\n`;
    fs.writeFileSync(planPath, plan);

    expect(shouldGenerateReviewedPlan(planPath, checkpointPath, 80)).toBe(false);
    expect(() => shouldGenerateReviewedPlan(planPath, checkpointPath, 81)).toThrow(/reviewed nonce is 80/);
    expect(fs.readFileSync(planPath, "utf8")).toBe(plan);
    expect(shouldGenerateReviewedPlan(path.join(directory, "missing.json"), checkpointPath, 81)).toBe(true);
  });

  it("replays a completed final boundary and rejects a cursor-only checkpoint", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "release-stage-complete-"));
    temporaryDirectories.push(directory);
    const planPath = path.join(directory, "settlement-module-transaction-plan.json");
    const checkpointPath = path.join(directory, "settlement-module-checkpoint.json");
    fs.writeFileSync(planPath, `${JSON.stringify({ transactions: [{ nonce: 70 }, { nonce: 71 }] }, null, 2)}\n`);
    fs.writeFileSync(
      checkpointPath,
      `${JSON.stringify({ lastVerifiedStep: 2, verifiedBoundaries: [{ index: 1 }, { index: 2 }] }, null, 2)}\n`,
    );

    expect(planBoundaryExecutionSteps(planPath, checkpointPath)).toEqual([2]);

    fs.writeFileSync(
      checkpointPath,
      `${JSON.stringify({ lastVerifiedStep: 2, verifiedBoundaries: [{ index: 1 }] }, null, 2)}\n`,
    );
    expect(() => completedBoundaries(planPath, checkpointPath)).toThrow(/cursor differs from its receipt ledger/);
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

  it("revalidates receipt-backed artifact promotions around every automated boundary", () => {
    const source = fs.readFileSync(path.join(__dirname, "release-operator.ts"), "utf8");
    const start = source.indexOf("function runAutomatedBunCommand");
    const end = source.indexOf("async function pendingNonce", start);
    const body = source.slice(start, end);

    expect(body.match(/assertVerifiedResumePromotions/gu)).toHaveLength(2);
    expect(body.indexOf("const beforeDirty")).toBeLessThan(body.indexOf("spawnSync"));
    expect(body.indexOf("const afterDirty")).toBeGreaterThan(body.indexOf("spawnSync"));
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

  it("keeps ownership and backfill out of the interactive boundary allowlist", () => {
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

  it("allows only the native/G$-clear Garden Safe bootstrap and reviewed owner-swap wrappers", () => {
    const receipt = `0x${"cd".repeat(32)}`;
    expect(
      assertAllowedOperatorCommand(
        tokenizeOperatorCommand(
          `run settlement:garden-safes:deploy:celo --plan .generated/runtime/bootstrap.json --step 1 --receipt ${receipt}`,
        ),
      ),
    ).toEqual({
      script: "settlement:garden-safes:deploy:celo",
      args: ["--plan", ".generated/runtime/bootstrap.json", "--step", "1", "--receipt", receipt],
    });
    expect(
      assertAllowedOperatorCommand(
        tokenizeOperatorCommand(
          "run settlement:garden-safes:swap:celo --plan .generated/runtime/swap.json --replacements .generated/runtime/replacements.json",
        ),
      ),
    ).toEqual({
      script: "settlement:garden-safes:swap:celo",
      args: ["--plan", ".generated/runtime/swap.json", "--replacements", ".generated/runtime/replacements.json"],
    });
    expect(() =>
      assertAllowedOperatorCommand(
        tokenizeOperatorCommand("run settlement:garden-safes:swap:celo --rpc-url https://unreviewed.invalid"),
      ),
    ).toThrow(/controlled by the frozen release session/);
  });

  it("keeps deployer backfill at 18 registrations so unpause remains a separate mode", () => {
    expect(POOL_BACKFILL_REGISTRATION_BOUNDARIES).toBe(18);
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
