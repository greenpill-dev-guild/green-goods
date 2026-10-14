import { describe, expect, it } from "vitest";
import { selectWorkDecisionReadback } from "../modules/commitment-pooling/work-decision-readback";
import type { CommitmentWorkDecision } from "../modules/commitment-pooling/work-decisions";

const WORK = `0x${"11".repeat(32)}` as const;
const DECISION = `0x${"22".repeat(32)}` as const;

function decision(
  state: CommitmentWorkDecision["state"],
  currentDecisionUID: CommitmentWorkDecision["currentDecisionUID"] = DECISION
): CommitmentWorkDecision {
  return {
    workUID: WORK,
    attribution: {} as CommitmentWorkDecision["attribution"],
    state,
    currentDecisionUID,
    currentDecisionSequence: 2n,
  };
}

function readback(state?: CommitmentWorkDecision["state"], options = {}) {
  return selectWorkDecisionReadback({
    submitted: [{ workUID: WORK, decisionUID: DECISION }],
    byWorkUID: new Map(state ? [[WORK, decision(state)]] : []),
    readAvailable: true,
    isError: false,
    ...options,
  });
}

describe("steward Work-decision readback", () => {
  it("succeeds only for the same submitted decision indexed as counted", () => {
    expect(readback("counted")).toBe("succeeded");
    expect(
      selectWorkDecisionReadback({
        submitted: [{ workUID: WORK, decisionUID: DECISION }],
        byWorkUID: new Map([[WORK, decision("counted", `0x${"33".repeat(32)}`)]]),
        readAvailable: true,
        isError: false,
      })
    ).toBe("pending");
  });

  it("keeps ready or missing indexed rows pending", () => {
    expect(readback("readyToReconcile")).toBe("pending");
    expect(readback()).toBe("pending");
  });

  it("keeps unavailable and fresh-review outcomes explicit", () => {
    expect(readback("unavailable")).toBe("unavailable");
    expect(readback("needsFreshReview")).toBe("needsFreshReview");
    expect(readback("counted", { readAvailable: false })).toBe("unavailable");
  });
});
