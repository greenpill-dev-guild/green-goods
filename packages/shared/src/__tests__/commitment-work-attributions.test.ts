/**
 * Work → commitment attribution, read from the work's side.
 *
 * The indexer's CommitmentWorkAttribution was only ever read commitment → work.
 * The Work Review view needs the other direction: given a work, which
 * commitment does it fulfil, at which requirement row, and is the link still
 * live. One entity, one more where clause, and a typed record both sides share.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCommitmentDetail,
  getCommitmentWorkAttributionsByWork,
} from "../modules/commitment-pooling/data";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("../modules/data/graphql-client", () => ({
  greenGoodsIndexer: { query: (...args: unknown[]) => mocks.query(...args) },
}));

const WORK = `0x${"ab".repeat(32)}`;
const CONTRIBUTOR = "0x1111111111111111111111111111111111111111";

const row = (overrides: Record<string, unknown> = {}) => ({
  id: `42161-9-${WORK}`,
  chainId: 42161,
  workUID: WORK,
  commitmentId: "9",
  linkSeen: true,
  contributor: CONTRIBUTOR,
  requirementIndex: 1,
  operationKey: `0x${"cd".repeat(32)}`,
  linked: true,
  creditActive: true,
  latestDecisionSequence: "3",
  latestDecisionUID: null,
  linkedBy: CONTRIBUTOR,
  linkedAt: 1_700_000_000,
  unlinkedBy: null,
  unlinkedAt: null,
  updatedAt: 1_700_000_100,
  ...overrides,
});

describe("getCommitmentWorkAttributionsByWork", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("asks for the work's own attributions, seen ones only, and types what comes back", async () => {
    mocks.query.mockResolvedValue({ data: { CommitmentWorkAttribution: [row()] } });

    const result = await getCommitmentWorkAttributionsByWork(42161, WORK);

    const [document, variables] = mocks.query.mock.calls[0] as [string, Record<string, unknown>];
    expect(document).toContain("workUID: { _eq: $workUID }");
    expect(document).toContain("linkSeen: { _eq: true }");
    expect(variables).toEqual({ chainId: 42161, workUID: WORK });
    expect(result).toEqual([
      {
        id: `42161-9-${WORK}`,
        chainId: 42161,
        workUID: WORK,
        commitmentId: 9n,
        linkSeen: true,
        contributor: CONTRIBUTOR,
        requirementIndex: 1,
        operationKey: `0x${"cd".repeat(32)}`,
        linked: true,
        creditActive: true,
        linkedBy: CONTRIBUTOR,
        linkedAt: 1_700_000_000,
        unlinkedBy: null,
        unlinkedAt: null,
        updatedAt: 1_700_000_100,
      },
    ]);
  });

  it("keeps an unlinked record rather than hiding it: the history is the point", async () => {
    mocks.query.mockResolvedValue({
      data: { CommitmentWorkAttribution: [row({ linked: false, unlinkedBy: CONTRIBUTOR })] },
    });

    const [attribution] = await getCommitmentWorkAttributionsByWork(42161, WORK);
    expect(attribution?.linked).toBe(false);
    expect(attribution?.unlinkedBy).toBe(CONTRIBUTOR);
  });

  it("drops an unseen placeholder the indexer returns anyway", async () => {
    mocks.query.mockResolvedValue({
      data: { CommitmentWorkAttribution: [row({ linkSeen: false })] },
    });

    expect(await getCommitmentWorkAttributionsByWork(42161, WORK)).toEqual([]);
  });
});

describe("getCommitmentDetail work attributions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("types the detail's attributions the same way", async () => {
    mocks.query.mockImplementation(async (document: string) => {
      if (document.includes("CommitmentDetailIndex")) {
        return {
          data: {
            Commitment: [
              {
                id: "42161-9",
                chainId: 42161,
                commitmentId: "9",
                creationSeen: true,
                state: "ACCEPTED",
                approvedUnits: "0",
                evidenceCount: 0,
                cycleId: "0",
                targetUnits: "3",
                confirmers: [],
                contributorCount: 1,
                contributorsFrozen: false,
              },
            ],
            CommitmentRequirement: [],
            CommitmentWorkAttribution: [row()],
          },
        };
      }
      return { data: {} };
    });

    const detail = await getCommitmentDetail(42161, 9n);
    expect(detail?.workAttributions).toEqual([
      expect.objectContaining({
        workUID: WORK,
        commitmentId: 9n,
        requirementIndex: 1,
        linked: true,
      }),
    ]);
  });
});
