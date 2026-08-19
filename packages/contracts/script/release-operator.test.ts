import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertAllowedOperatorCommand,
  assertArtifactCheckout,
  assertInteractiveSessionStart,
  assertPinnedCheckout,
  CEREMONY_STAGES,
  changedPromotionLeafPaths,
  completedBoundaries,
  createPasswordLease,
  parseSessionOptions,
  plannedStageBoundaries,
  RELEASE_OPERATOR_COMMANDS,
  tokenizeOperatorCommand,
  transactionHashFromBoundaryOutput,
} from "./release-operator";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function createCandidateRepository(): { repository: string; candidate: string } {
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
  return { repository, candidate: git(["rev-parse", "HEAD"]) };
}

describe("release operator session", () => {
  it("requires the exact pinned candidate and rejects retired broadcast modes", () => {
    const candidate = "a".repeat(40);
    expect(() => parseSessionOptions([])).toThrow(/requires --commit/);
    expect(() => parseSessionOptions(["--commit", "abc"])).toThrow(/requires --commit/);
    expect(parseSessionOptions(["--commit", candidate])).toEqual({ commit: candidate, help: false });
    for (const retired of ["--deploy-all", "--backfill-all", "--unpause-pooling", "--authorization"]) {
      expect(() => parseSessionOptions(["--commit", candidate, retired])).toThrow(/Unknown release operator option/);
    }
    expect(parseSessionOptions(["--help"])).toEqual({ help: true });
  });

  it("accepts only the reviewed ceremony stages and still pins the candidate", () => {
    const candidate = "a".repeat(40);

    expect(parseSessionOptions(["--commit", candidate, "--stage", "garden-accounts"])).toEqual({
      commit: candidate,
      stage: "garden-accounts",
      help: false,
    });
    expect(parseSessionOptions(["--commit", candidate, "--stage", "garden-safes"]).stage).toBe("garden-safes");
    expect(() => parseSessionOptions(["--commit", candidate, "--stage", "garden-relay"])).toThrow(
      /Unknown release ceremony stage/,
    );
    expect(() => parseSessionOptions(["--commit", candidate, "--stage"])).toThrow(/--stage requires one of/);
    // A stage never substitutes for the pinned candidate.
    expect(() => parseSessionOptions(["--stage", "garden-safes"])).toThrow(/requires --commit/);
    // Every stage must map to an allowlisted boundary script.
    for (const [, definition] of CEREMONY_STAGES) {
      expect(RELEASE_OPERATOR_COMMANDS.has(definition.script)).toBe(true);
    }
    expect(CEREMONY_STAGES.get("garden-accounts")?.boundaries).toBe(2);
    expect(CEREMONY_STAGES.get("garden-safes")?.boundaries).toBe(18);
    // The relay lane spans both chains, so its four boundaries are one reviewed stage.
    expect(parseSessionOptions(["--commit", candidate, "--stage", "relay"]).stage).toBe("relay");
    expect(CEREMONY_STAGES.get("relay")?.boundaries).toBe(4);
    expect(plannedStageBoundaries("relay", 0)).toEqual([1, 2, 3, 4]);
    // Six unsigned boundaries per Safe across all 18, resumed from its own checkpoint.
    expect(CEREMONY_STAGES.get("garden-roles")?.boundaries).toBe(108);
    expect(plannedStageBoundaries("garden-roles", 106)).toEqual([107, 108]);
    expect(plannedStageBoundaries("garden-roles", 108)).toEqual([]);
    expect(() => plannedStageBoundaries("garden-roles", 109)).toThrow(/but its plan defines 108/);
  });

  it("resumes a staged lane after its checkpoint without replaying a mined boundary", () => {
    // A fresh lane runs every boundary in order.
    expect(plannedStageBoundaries("garden-accounts", 0)).toEqual([1, 2]);
    expect(plannedStageBoundaries("garden-safes", 0)).toEqual(Array.from({ length: 18 }, (_, index) => index + 1));
    // A resumed lane starts at the first uncheckpointed boundary.
    expect(plannedStageBoundaries("garden-safes", 5)).toEqual(Array.from({ length: 13 }, (_, index) => index + 6));
    expect(plannedStageBoundaries("garden-safes", 17)).toEqual([18]);
    // A complete lane runs nothing rather than redeploying a mined Safe.
    expect(plannedStageBoundaries("garden-safes", 18)).toEqual([]);
    // A ledger claiming more boundaries than the plan defines is corruption, not a completed lane.
    expect(() => plannedStageBoundaries("garden-safes", 19)).toThrow(/but its plan defines 18/);
    expect(() => plannedStageBoundaries("garden-safes", -1)).toThrow(/non-negative integer/);
    expect(() => plannedStageBoundaries("garden-safes", 1.5)).toThrow(/non-negative integer/);
  });

  it("binds a staged step 2 to the transaction hash its step 1 actually verified", () => {
    const output = `DEPLOY_COORDINATOR verified as 0x${"1".repeat(64)}; close the credential session.\n`;

    expect(transactionHashFromBoundaryOutput(output, 1)).toBe(`0x${"1".repeat(64)}`);
    // Boundary output that mentions the plan before its receipt still resolves the receipt.
    expect(transactionHashFromBoundaryOutput(`plan 0x${"a".repeat(64)}\nverified as 0x${"b".repeat(64)};`, 1)).toBe(
      `0x${"b".repeat(64)}`,
    );
    expect(() => transactionHashFromBoundaryOutput("no receipt here", 1)).toThrow(
      /did not report a verified transaction hash/,
    );
    // A truncated hash is not a receipt.
    expect(() => transactionHashFromBoundaryOutput(`verified as 0x${"c".repeat(63)}`, 1)).toThrow(
      /did not report a verified transaction hash/,
    );
  });

  it("accepts both receipt-backed release and Garden Safe artifact promotions", () => {
    const { repository, candidate } = createCandidateRepository();
    const releaseArtifact = "packages/contracts/deployments/42161-latest.json";
    const safeArtifact = "packages/contracts/deployments/42220-settlement-safes.json";
    for (const artifact of [releaseArtifact, safeArtifact]) {
      fs.mkdirSync(path.dirname(path.join(repository, artifact)), { recursive: true });
      fs.writeFileSync(path.join(repository, artifact), "{}\n");
    }

    const releaseValidated: string[][] = [];
    const safeValidated: string[][] = [];
    expect(() =>
      assertInteractiveSessionStart(
        candidate,
        repository,
        (_candidate, _root, dirtyPaths) => releaseValidated.push(dirtyPaths),
        (_candidate, _root, dirtyPaths) => safeValidated.push(dirtyPaths),
      ),
    ).not.toThrow();
    expect(releaseValidated).toEqual([[releaseArtifact]]);
    expect(safeValidated).toEqual([[safeArtifact]]);

    fs.appendFileSync(path.join(repository, "reviewed.txt"), "drift\n");
    expect(() =>
      assertInteractiveSessionStart(
        candidate,
        repository,
        () => undefined,
        () => undefined,
      ),
    ).toThrow(/concurrent checkout drift/);
  });

  it("allows only explicitly receipt-backed deployment artifacts to differ from the candidate", () => {
    const { repository, candidate } = createCandidateRepository();
    const allowed = new Set(["reviewed.txt"]);
    fs.appendFileSync(path.join(repository, "reviewed.txt"), "promotion\n");
    expect(() => assertArtifactCheckout(candidate, repository, allowed)).not.toThrow();
    fs.writeFileSync(path.join(repository, "unrelated.txt"), "drift\n");
    expect(() => assertArtifactCheckout(candidate, repository, allowed)).toThrow(/concurrent checkout drift/);
  });

  it("keeps current-state promotion comparisons at exact leaf paths", () => {
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

  it("allowlists only one explicit GardenAccount or Garden Safe boundary per command", () => {
    const receipt = `0x${"cd".repeat(32)}`;
    expect([...RELEASE_OPERATOR_COMMANDS.keys()]).toEqual([
      "settlement:garden-accounts:deploy:celo",
      "settlement:garden-safes:deploy:celo",
      "settlement:garden-relay:deploy",
      "settlement:garden-roles:deploy",
    ]);
    expect(
      assertAllowedOperatorCommand(
        tokenizeOperatorCommand(
          `run settlement:garden-accounts:deploy:celo --plan .generated/runtime/accounts.json --step 2 --receipt ${receipt}`,
        ),
      ),
    ).toEqual({
      script: "settlement:garden-accounts:deploy:celo",
      args: ["--plan", ".generated/runtime/accounts.json", "--step", "2", "--receipt", receipt],
    });
    expect(
      assertAllowedOperatorCommand(
        tokenizeOperatorCommand(
          `run settlement:garden-safes:deploy:celo --plan .generated/runtime/final.json --step 1 --receipt ${receipt}`,
        ),
      ),
    ).toEqual({
      script: "settlement:garden-safes:deploy:celo",
      args: ["--plan", ".generated/runtime/final.json", "--step", "1", "--receipt", receipt],
    });
    expect(() =>
      assertAllowedOperatorCommand(
        tokenizeOperatorCommand("run settlement:garden-safes:swap:celo --plan .generated/runtime/swap.json --step 1"),
      ),
    ).toThrow(/not allowlisted/);
    expect(() =>
      assertAllowedOperatorCommand(
        tokenizeOperatorCommand("run settlement:garden-safes:deploy:celo --step 1 --step 2"),
      ),
    ).toThrow(/duplicated/);
    expect(() =>
      assertAllowedOperatorCommand(
        tokenizeOperatorCommand(
          "run settlement:garden-safes:deploy:celo --step 1 --rpc-url https://unreviewed.invalid",
        ),
      ),
    ).toThrow(/controlled by the frozen release session/);
    expect(() => assertAllowedOperatorCommand(tokenizeOperatorCommand("run pooling:deploy:arbitrum --step 1"))).toThrow(
      /not allowlisted/,
    );
    expect(() => tokenizeOperatorCommand("run 'unterminated")).toThrow(/Unclosed quote/);
  });

  it("rejects checkout drift before a release boundary executes", () => {
    const { repository, candidate } = createCandidateRepository();
    expect(() => assertPinnedCheckout(candidate, repository)).not.toThrow();
    fs.appendFileSync(path.join(repository, "reviewed.txt"), "drift\n");
    expect(() => assertPinnedCheckout(candidate, repository)).toThrow(/checkout to stay clean/);
  });

  it("rejects a checkpoint cursor that differs from its receipt ledger", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "release-checkpoint-"));
    temporaryDirectories.push(directory);
    const planPath = path.join(directory, "plan.json");
    const checkpointPath = path.join(directory, "checkpoint.json");
    fs.writeFileSync(planPath, '{"transactions":[{"nonce":1}]}\n');
    fs.writeFileSync(checkpointPath, '{"lastVerifiedStep":1,"verifiedBoundaries":[]}\n');
    expect(() => completedBoundaries(planPath, checkpointPath)).toThrow(/cursor differs from its receipt ledger/);
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
