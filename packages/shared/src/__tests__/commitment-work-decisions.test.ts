import { describe, expect, it } from "vitest";
import type { EASWorkApproval } from "../types/eas-responses";
import type { CommitmentWorkAttributionRecord } from "../modules/commitment-pooling/types-relations";
import { selectCommitmentWorkDecisions } from "../modules/commitment-pooling/work-decisions";

const WORK = `0x${"11".repeat(32)}` as const;
const APPROVAL = `0x${"22".repeat(32)}` as const;
const REJECTION = `0x${"33".repeat(32)}` as const;
const GARDEN = `0x${"44".repeat(20)}` as const;

function attribution(creditActive = false): CommitmentWorkAttributionRecord {
  return {
    id: "link-1",
    chainId: 42161,
    workUID: WORK,
    commitmentId: 7n,
    linkSeen: true,
    contributor: GARDEN,
    requirementIndex: 0,
    operationKey: null,
    linked: true,
    creditActive,
    linkedBy: GARDEN,
    linkedAt: 1,
    unlinkedBy: null,
    unlinkedAt: null,
    updatedAt: 1,
  };
}

function decision(id: string, approved: boolean): EASWorkApproval {
  return {
    id,
    stewardAddress: GARDEN,
    gardenerAddress: GARDEN,
    actionUID: 1,
    workUID: WORK,
    approved,
    feedback: "",
    confidence: approved ? 1 : 0,
    verificationMethod: approved ? 1 : 0,
    reviewNotesCID: "",
    createdAt: 1,
  };
}

async function classify(input: {
  approvals?: EASWorkApproval[];
  latest?: bigint;
  sequences?: Record<string, bigint>;
  creditActive?: boolean;
  fail?: boolean;
}) {
  return selectCommitmentWorkDecisions({
    chainId: 42161,
    garden: GARDEN,
    attributions: [attribution(input.creditActive)],
    dependencies: {
      getApprovals: async () => input.approvals ?? [],
      readLatestSequence: async () => {
        if (input.fail) throw new Error("rpc down");
        return input.latest ?? 0n;
      },
      readDecisionSequence: async (uid) => input.sequences?.[uid] ?? 0n,
    },
  });
}

describe("commitment Work decision classification", () => {
  it("distinguishes awaiting approval from legacy sequence-zero review", async () => {
    await expect(classify({ latest: 0n })).resolves.toMatchObject([{ state: "awaitingApproval" }]);
    await expect(
      classify({ approvals: [decision(APPROVAL, true)], latest: 0n })
    ).resolves.toMatchObject([{ state: "needsFreshReview" }]);
  });

  it("only reconciles the exact current nonzero approval", async () => {
    await expect(
      classify({
        approvals: [decision(APPROVAL, true)],
        latest: 2n,
        sequences: { [APPROVAL]: 2n },
      })
    ).resolves.toMatchObject([
      {
        state: "readyToReconcile",
        currentDecisionUID: APPROVAL,
        currentDecisionSequence: 2n,
      },
    ]);
  });

  it("marks a current rejection fresh-review-required and a current counted approval counted", async () => {
    await expect(
      classify({
        approvals: [decision(REJECTION, false)],
        latest: 3n,
        sequences: { [REJECTION]: 3n },
        creditActive: true,
      })
    ).resolves.toMatchObject([{ state: "needsFreshReview" }]);
    await expect(
      classify({
        approvals: [decision(APPROVAL, true)],
        latest: 2n,
        sequences: { [APPROVAL]: 2n },
        creditActive: true,
      })
    ).resolves.toMatchObject([{ state: "counted" }]);
  });

  it("requires a fresh review when the current approval recipient is not the provider garden", async () => {
    const mismatched = {
      ...decision(APPROVAL, true),
      gardenerAddress: `0x${"55".repeat(20)}`,
    };
    await expect(
      classify({
        approvals: [mismatched],
        latest: 2n,
        sequences: { [APPROVAL]: 2n },
      })
    ).resolves.toMatchObject([
      {
        state: "needsFreshReview",
        currentDecisionUID: null,
        currentDecisionSequence: null,
      },
    ]);
  });

  it("maps missing current candidates and read failures to unavailable", async () => {
    await expect(classify({ latest: 2n })).resolves.toMatchObject([{ state: "unavailable" }]);
    await expect(classify({ fail: true })).resolves.toMatchObject([{ state: "unavailable" }]);
  });
});
