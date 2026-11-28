import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  type Approval,
  claimBroadcast,
  GuardRefusal,
  type Observed,
  preflight,
} from "./production-qa-guard";

// Synthetic fixtures only: these addresses belong to no garden or tester.
const GARDEN = "0x00000000000000000000000000000000000000a1";
const GARDENER = "0x00000000000000000000000000000000000000b2";

const approval: Approval = {
  id: "approval-test-1",
  approvedBy: "afo",
  approvedAt: "2026-11-27T12:00:00Z",
  expiresAt: "2026-11-30T12:00:00Z",
  cases: [
    {
      caseId: "PWA-077",
      machine: "jarvis",
      origin: "https://greengoods.app",
      chainId: 42161,
      gardenAddress: GARDEN,
      signerRole: "gardener",
      signerAddress: GARDENER,
      maxBroadcasts: 1,
      maxFeeWei: "200000000000000",
    },
  ],
};

const observed: Observed = {
  caseId: "PWA-077",
  machine: "jarvis",
  origin: "https://greengoods.app",
  chainId: 42161,
  gardenAddress: GARDEN.toUpperCase().replace("0X", "0x"),
  signerAddress: GARDENER,
  feeWei: "30000000000000",
};

const now = new Date("2026-11-28T09:00:00Z");

function refusal(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    if (error instanceof GuardRefusal) return error.code;
    throw error;
  }
  return "allowed";
}

describe("production QA preflight", () => {
  it("allows exactly the approved case, target, chain, garden and signer", () => {
    expect(preflight(approval, observed, now).caseId).toBe("PWA-077");
  });

  it("refuses a case the approval does not name", () => {
    expect(refusal(() => preflight(approval, { ...observed, caseId: "PWA-137" }, now))).toBe(
      "not-approved"
    );
  });

  it("refuses after the approval expires", () => {
    expect(refusal(() => preflight(approval, observed, new Date("2026-12-01T00:00:00Z")))).toBe(
      "expired"
    );
  });

  it("refuses the wrong target: another origin or another machine", () => {
    expect(
      refusal(() =>
        preflight(approval, { ...observed, origin: "https://beta.greengoods.app" }, now)
      )
    ).toBe("wrong-target");
    expect(refusal(() => preflight(approval, { ...observed, machine: "cortana" }, now))).toBe(
      "wrong-target"
    );
  });

  it("refuses the wrong chain before anything is signed", () => {
    expect(refusal(() => preflight(approval, { ...observed, chainId: 100 }, now))).toBe(
      "wrong-chain"
    );
  });

  it("refuses another garden and another signer", () => {
    expect(
      refusal(() =>
        preflight(
          approval,
          { ...observed, gardenAddress: "0x00000000000000000000000000000000000000c3" },
          now
        )
      )
    ).toBe("wrong-garden");
    expect(
      refusal(() =>
        preflight(
          approval,
          { ...observed, signerAddress: "0x00000000000000000000000000000000000000d4" },
          now
        )
      )
    ).toBe("wrong-signer");
  });

  it("refuses a fee above the approved maximum", () => {
    expect(
      refusal(() => preflight(approval, { ...observed, feeWei: "200000000000001" }, now))
    ).toBe("over-limit");
  });
});

describe("broadcast claims", () => {
  let dir: string;
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("lets one job claim the approved broadcast and refuses a duplicate job", () => {
    dir = mkdtempSync(join(tmpdir(), "qa-claims-"));
    const approved = preflight(approval, observed, now);
    const claim = claimBroadcast(dir, approval, approved, "j-1");
    expect(claim).toMatch(/broadcast-1\.json$/);
    expect(refusal(() => claimBroadcast(dir, approval, approved, "j-2"))).toBe("duplicate");
  });

  it("stops at the approved number of broadcasts once earlier ones are reconciled", () => {
    dir = mkdtempSync(join(tmpdir(), "qa-claims-"));
    const approved = preflight(approval, observed, now);
    const claim = claimBroadcast(dir, approval, approved, "j-1");
    writeFileSync(claim, JSON.stringify({ jobId: "j-1", reconciled: { hash: "0xabc" } }));
    expect(refusal(() => claimBroadcast(dir, approval, approved, "j-2"))).toBe("over-limit");
  });
});
