import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEASConfig = {
  WORK: { uid: "0xWorkSchemaUID" },
  WORK_APPROVAL: { uid: "0xApprovalSchemaUID" },
};
vi.mock("../../config/blockchain", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../config/blockchain")>()),
  getEASConfig: vi.fn(() => mockEASConfig),
}));
vi.mock("../../modules/data/graphql", () => ({ easGraphQL: vi.fn((query) => query) }));

import { EASFetchError } from "../../modules/data/eas-read-validation";
import { REVIEW_HISTORY_LIMIT, readGardenReviewQueue } from "../../modules/data/eas-review-queue";
import type { GraphQLReader } from "../../modules/data/graphql-client";

const NOW = Date.UTC(2026, 8, 25, 12);
// EAS stores addresses checksummed and compares filters exactly.
const GARDEN = "0xA0Cf798816D4b9b9866b5330EEa46a18382f251e";
const STEWARD = "0x04D60647836bcA09c37B379550038BdaaFD82503";
const uid = (n: number) => `0x${n.toString(16).padStart(64, "0")}`;

const work = (n: number, timeCreated: number) => ({ id: uid(n), timeCreated });
const decision = (workNumber: number, timeCreated: number, id = uid(1000 + timeCreated)) => ({
  id,
  attester: STEWARD,
  recipient: GARDEN,
  timeCreated,
  decodedDataJson: JSON.stringify([
    { name: "workUID", value: { value: uid(workNumber) } },
    { name: "approved", value: { value: true } },
  ]),
});
const counts = (works: number, worksOverWeek: number, decisions: number) => ({
  workCount: { _count: { _all: works } },
  workOverWeekCount: { _count: { _all: worksOverWeek } },
  decisionCount: { _count: { _all: decisions } },
});

const query = vi.fn();
const reader = { query } as unknown as GraphQLReader;

describe("readGardenReviewQueue", () => {
  beforeEach(() => query.mockReset());

  it("lists the works no decision has settled, and when the latest decision landed", async () => {
    query.mockResolvedValue({
      data: {
        works: [work(1, 100), work(2, 200), work(3, 300)],
        // Newest first. The first work was decided twice; the second once.
        decisions: [decision(2, 450), decision(1, 400), decision(1, 350)],
        ...counts(3, 3, 3),
      },
    });

    await expect(
      readGardenReviewQueue(GARDEN.toLowerCase(), { chainId: 42161, now: NOW }, reader)
    ).resolves.toEqual({ lastReviewedAt: 450, waiting: [{ id: uid(3), submittedAt: 300 }] });

    const variables = query.mock.calls[0][1];
    expect(variables.works).toEqual({
      schemaId: { equals: mockEASConfig.WORK.uid },
      recipient: { equals: GARDEN },
      revoked: { equals: false },
    });
    expect(variables.decisions).toEqual({
      schemaId: { equals: mockEASConfig.WORK_APPROVAL.uid },
      recipient: { equals: GARDEN },
      revoked: { equals: false },
    });
    expect(variables.worksOverWeek.timeCreated).toEqual({
      lte: Math.floor((NOW - 7 * 24 * 60 * 60 * 1000) / 1000),
    });
    expect(variables.take).toBe(REVIEW_HISTORY_LIMIT + 1);
  });

  it("bounds the waiting work from counts when the history is longer than one read", async () => {
    query.mockResolvedValue({
      data: {
        works: Array.from({ length: REVIEW_HISTORY_LIMIT + 1 }, (_, n) => work(n, n)),
        decisions: [decision(7, 900), decision(5, 800)],
        // 450 works, 400 of them a week old, and 420 decisions: 30 wait at least,
        // but the decisions could have settled every week-old work.
        ...counts(450, 400, 420),
      },
    });

    await expect(
      readGardenReviewQueue(GARDEN, { chainId: 42161, now: NOW }, reader)
    ).resolves.toEqual({
      lastReviewedAt: 900,
      waiting: null,
      waitingAtLeast: 30,
      waitingOverWeekAtLeast: 0,
    });
  });

  it("has no review time for a garden nothing was decided in", async () => {
    query.mockResolvedValue({
      data: { works: [work(1, 100)], decisions: [], ...counts(1, 1, 0) },
    });

    await expect(readGardenReviewQueue(GARDEN, { now: NOW }, reader)).resolves.toEqual({
      lastReviewedAt: null,
      waiting: [{ id: uid(1), submittedAt: 100 }],
    });
  });

  it("fails rather than report an empty queue when EAS cannot answer", async () => {
    query.mockResolvedValue({ error: new Error("upstream unavailable") });

    await expect(readGardenReviewQueue(GARDEN, { now: NOW }, reader)).rejects.toBeInstanceOf(
      EASFetchError
    );
  });
});
