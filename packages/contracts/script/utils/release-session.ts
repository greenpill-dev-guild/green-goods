/**
 * Shared broadcast-session assertions for the release operator's Bun wrappers.
 *
 * The operator unlocks one credential session per exact checkout: it asserts that `git HEAD` equals
 * the reviewed candidate before and after every boundary, then exports that candidate as
 * `GG_RELEASE_OPERATOR_SESSION`. A wrapper re-checks the session against its own checkout so a
 * session unlocked for one candidate can never sign from a different tree.
 *
 * Release identity — the manifest `sourceCommit` and hash — is a separate property, asserted where
 * the plan is validated. It cannot stand in for the checkout here: `sourceCommit` names the commit a
 * release was frozen from, so requiring `HEAD == sourceCommit` would need a commit containing its
 * own hash, which left every Celo boundary unrunnable.
 */
import { execFileSync } from "node:child_process";

const EXACT_COMMIT = /^[0-9a-f]{40}$/u;

export function resolveCheckoutCommit(repositoryRoot: string): string {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" }).trim();
}

export function assertReleaseOperatorSession(
  checkoutCommit: string,
  session = process.env.GG_RELEASE_OPERATOR_SESSION,
): void {
  if (!EXACT_COMMIT.test(checkoutCommit)) {
    throw new Error("Broadcast requires an exact 40-character checkout commit");
  }
  if (session !== checkoutCommit) {
    throw new Error("Broadcast release-operator session does not match the checked-out candidate");
  }
}
