import * as fs from "node:fs";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { assertReleaseOperatorSession, resolveCheckoutCommit } from "./release-session";

const CONTRACTS_ROOT = path.join(__dirname, "../..");
const REPOSITORY_ROOT = path.join(CONTRACTS_ROOT, "../..");
const RELEASE_MANIFEST = path.join(CONTRACTS_ROOT, "config/commitment-pooling-release.json");

describe("release operator broadcast session", () => {
  it("accepts the session the operator exports for the current checkout", () => {
    const checkout = resolveCheckoutCommit(REPOSITORY_ROOT);

    expect(() => assertReleaseOperatorSession(checkout, checkout)).not.toThrow();
  });

  it("rejects a session unlocked for a different checkout", () => {
    expect(() => assertReleaseOperatorSession("a".repeat(40), "b".repeat(40))).toThrow(
      /does not match the checked-out candidate/u,
    );
  });

  it("rejects a missing session", () => {
    expect(() => assertReleaseOperatorSession("a".repeat(40), undefined)).toThrow(
      /does not match the checked-out candidate/u,
    );
  });

  it("rejects a checkout commit that is not an exact 40-character hash", () => {
    expect(() => assertReleaseOperatorSession("abc", "abc")).toThrow(/exact 40-character checkout commit/u);
  });

  it("resolves the checkout commit as an exact 40-character hash", () => {
    expect(resolveCheckoutCommit(REPOSITORY_ROOT)).toMatch(/^[0-9a-f]{40}$/u);
  });

  /**
   * Regression guard for the gate that made every Celo broadcast boundary unrunnable. The wrappers
   * compared the operator session to the release manifest `sourceCommit` while the operator pinned
   * `git HEAD` to that same value, so broadcast required a commit that names its own hash.
   */
  it("does not gate broadcast on a release identity the checkout can never equal", () => {
    const manifest = JSON.parse(fs.readFileSync(RELEASE_MANIFEST, "utf8")) as { sourceCommit: string };

    expect(manifest.sourceCommit).not.toEqual(resolveCheckoutCommit(REPOSITORY_ROOT));
  });
});
