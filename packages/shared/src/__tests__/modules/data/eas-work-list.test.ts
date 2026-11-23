import { describe, expect, it, vi } from "vitest";

const mockEASConfig = {
  WORK: { uid: "0xWorkSchemaUID" },
  WORK_APPROVAL: { uid: "0xApprovalSchemaUID" },
};
vi.mock("../../../config/blockchain", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../config/blockchain")>()),
  getEASConfig: vi.fn(() => mockEASConfig),
}));
vi.mock("../../../modules/data/graphql", () => ({ easGraphQL: vi.fn((query) => query) }));

import {
  getGardenActivitySince,
  getWorkListPage,
  getWorksInRange,
  readWorkApprovalsForWorks,
} from "../../../modules/data/eas-work-list";
import type { GraphQLReader } from "../../../modules/data/graphql-client";

// EAS stores addresses checksummed and compares filters exactly.
const GARDEN = "0xA0Cf798816D4b9b9866b5330EEa46a18382f251e";
const GARDENER = "0x1111111111111111111111111111111111111111";
const STEWARD = "0x04D60647836bcA09c37B379550038BdaaFD82503";
const uid = (n: number) => `0x${n.toString(16).padStart(64, "0")}`;

const workRow = (n: number, timeCreated: number) => ({
  id: uid(n),
  attester: GARDENER,
  recipient: GARDEN,
  timeCreated,
  decodedDataJson: JSON.stringify([{ name: "title", value: { value: `Work ${n}` } }]),
});
const decisionRow = (n: number, workNumber: number, timeCreated: number) => ({
  id: uid(n),
  attester: STEWARD,
  recipient: GARDEN,
  timeCreated,
  decodedDataJson: JSON.stringify([
    { name: "workUID", value: { value: uid(workNumber) } },
    { name: "approved", value: { value: false } },
    { name: "feedback", value: { value: "Show the whole bed." } },
  ]),
});

describe("work presentation exclusions", () => {
  it("excludes selected work before the page and lookahead are counted", async () => {
    const records = [workRow(1, 500), workRow(2, 400), workRow(3, 300), workRow(4, 200)];
    const query = vi.fn(async (_document, variables) => ({
      data: {
        attestations: records
          .filter((row) => !variables.where.id?.notIn.includes(row.id))
          .slice(variables.skip, variables.skip + variables.take),
      },
    }));
    const options = { chainId: 42161, take: 2, skip: 0, excludedWorkUIDs: [uid(1)] };

    const page = await getWorkListPage(GARDEN, options, { query } as GraphQLReader);
    const older = await getWorkListPage(GARDEN, { ...options, skip: 2 }, {
      query,
    } as GraphQLReader);

    expect(page.map((row) => row.id)).toEqual([uid(2), uid(3)]);
    expect(older.map((row) => row.id)).toEqual([uid(4)]);
  });

  it("keeps hidden work and its decisions out of the activity window before its limit", async () => {
    const works = [workRow(1, 300), workRow(2, 200)];
    const decisions = [decisionRow(101, 1, 400), decisionRow(102, 2, 250)];
    const query = vi.fn(async (_document, variables) => ({
      data: {
        works: works.filter((row) => !variables.works.id?.notIn.includes(row.id)),
        decisions: decisions.filter((row) => !variables.decisions.id?.notIn.includes(row.id)),
      },
    }));
    const options = {
      chainId: 42161,
      since: 100,
      take: 1,
      excludedWorkUIDs: [uid(1)],
      excludedApprovalUIDs: [uid(101)],
    };

    const result = await getGardenActivitySince(GARDEN, options, { query } as GraphQLReader);

    expect(result.works.map((row) => row.id)).toEqual([uid(2)]);
    expect(result.decisions.map((row) => row.workUID)).toEqual([uid(2)]);
    expect(result.truncated).toBe(false);
  });
});

describe("readWorkApprovalsForWorks", () => {
  it("keeps successful batches and marks only a failed batch unknown", async () => {
    const workUIDs = Array.from(
      { length: 51 },
      (_, index) => `0x${index.toString(16).padStart(64, "0")}`
    );
    const query = vi
      .fn()
      .mockResolvedValueOnce({ data: { attestations: [] } })
      .mockResolvedValueOnce({ error: new Error("provider limit") });

    const result = await readWorkApprovalsForWorks(workUIDs, 42161, {
      query,
    } as unknown as GraphQLReader);

    expect(query).toHaveBeenCalledTimes(2);
    expect(result.approvals).toEqual([]);
    expect(result.failedWorkUIDs).toEqual([workUIDs[50]]);
  });

  it("reads a batch's decisions past one page, and counts the rows it could not read", async () => {
    // 100 decisions on work 1, then a second page holding one more and a malformed row.
    const first = Array.from({ length: 100 }, (_, index) => decisionRow(1000 + index, 1, index));
    const query = vi
      .fn()
      .mockResolvedValueOnce({ data: { attestations: first } })
      .mockResolvedValueOnce({
        data: { attestations: [decisionRow(2000, 1, 500), { id: uid(3000) }] },
      });

    const result = await readWorkApprovalsForWorks([uid(1)], 42161, {
      query,
    } as unknown as GraphQLReader);

    expect(query.mock.calls.map(([, variables]) => variables.skip)).toEqual([0, 100]);
    expect(result.approvals).toHaveLength(101);
    expect(result.dropped).toBe(1);
    expect(result.failedWorkUIDs).toEqual([]);

    // A later page that fails leaves the whole batch unknown, never half a history.
    const failing = vi
      .fn()
      .mockResolvedValueOnce({ data: { attestations: first } })
      .mockResolvedValueOnce({ error: new Error("provider limit") });
    const cut = await readWorkApprovalsForWorks([uid(1)], 42161, {
      query: failing,
    } as unknown as GraphQLReader);
    expect(cut.approvals).toEqual([]);
    expect(cut.failedWorkUIDs).toEqual([uid(1)]);
  });
});

describe("getGardenActivitySince", () => {
  it("reads one garden's works and decisions since a moment, and says when either ran over", async () => {
    const since = 1_800_000_000;
    const query = vi.fn().mockResolvedValue({
      data: {
        works: [workRow(1, since + 300), workRow(2, since + 200)],
        // Newest first: a decision on the first work and one on a work from before the window.
        decisions: [decisionRow(101, 1, since + 400), decisionRow(102, 9, since + 100)],
      },
    });

    const page = await getGardenActivitySince(
      GARDEN.toLowerCase(),
      { chainId: 42161, since, take: 2 },
      { query } as unknown as GraphQLReader
    );

    const variables = query.mock.calls[0][1];
    expect(variables.works).toEqual({
      schemaId: { equals: mockEASConfig.WORK.uid },
      recipient: { equals: GARDEN },
      revoked: { equals: false },
      timeCreated: { gt: since },
    });
    expect(variables.decisions).toEqual({
      schemaId: { equals: mockEASConfig.WORK_APPROVAL.uid },
      recipient: { equals: GARDEN },
      revoked: { equals: false },
      timeCreated: { gt: since },
    });
    // One row past the limit tells a full window from a cut one.
    expect(variables.take).toBe(3);
    expect(page.works.map(({ id, createdAt }) => ({ id, createdAt }))).toEqual([
      { id: uid(1), createdAt: since + 300 },
      { id: uid(2), createdAt: since + 200 },
    ]);
    expect(
      page.decisions.map(({ workUID, approved, feedback, createdAt }) => ({
        workUID,
        approved,
        feedback,
        createdAt,
      }))
    ).toEqual([
      { workUID: uid(1), approved: false, feedback: "Show the whole bed.", createdAt: since + 400 },
      { workUID: uid(9), approved: false, feedback: "Show the whole bed.", createdAt: since + 100 },
    ]);
    expect(page.truncated).toBe(false);

    query.mockResolvedValue({
      data: {
        works: [workRow(1, since + 3), workRow(2, since + 2), workRow(3, since + 1)],
        decisions: [],
      },
    });
    const cut = await getGardenActivitySince(GARDEN, { chainId: 42161, since, take: 2 }, {
      query,
    } as unknown as GraphQLReader);
    expect(cut.works).toHaveLength(2);
    expect(cut.truncated).toBe(true);
  });
});

describe("getWorksInRange", () => {
  // 450 works, one a second, so a range read has to page past EAS's first answer.
  const records = Array.from({ length: 450 }, (_, index) => workRow(index + 1, 1000 + index));
  const query = vi.fn(async (_document, variables) => {
    const { timeCreated, id } = variables.where;
    return {
      data: {
        attestations: records
          .filter((row) => row.timeCreated >= timeCreated.gte && row.timeCreated < timeCreated.lt)
          .filter((row) => !id?.notIn.includes(row.id))
          .slice(variables.skip, variables.skip + variables.take),
      },
    };
  });
  const reader = { query } as unknown as GraphQLReader;

  it("reads every work of the range, oldest first, however many pages that takes", async () => {
    const range = { chainId: 42161, from: 1000, to: 1450, excludedWorkUIDs: [uid(2)] };
    const page = await getWorksInRange(GARDEN, range, reader);

    expect(page.truncated).toBe(false);
    expect(page.works).toHaveLength(449);
    expect(page.works.slice(0, 2).map((work) => work.id)).toEqual([uid(1), uid(3)]);
    expect(page.works.at(-1)?.id).toBe(uid(450));
    // The start is in the range and the end is not.
    const narrow = await getWorksInRange(GARDEN, { chainId: 42161, from: 1010, to: 1012 }, reader);
    expect(narrow.works.map((work) => work.createdAt)).toEqual([1010, 1011]);
  });

  it("says the range is cut when it holds more than one read lists", async () => {
    const cut = await getWorksInRange(
      GARDEN,
      { chainId: 42161, from: 1000, to: 1450, limit: 300 },
      reader
    );
    expect(cut.works).toHaveLength(300);
    expect(cut.truncated).toBe(true);
    const exact = await getWorksInRange(
      GARDEN,
      { chainId: 42161, from: 1000, to: 1300, limit: 300 },
      reader
    );
    expect(exact.works).toHaveLength(300);
    expect(exact.truncated).toBe(false);
  });

  it("says when a row it left out as malformed was sent", async () => {
    const malformed = vi.fn(async () => ({
      data: {
        attestations: [workRow(1, 1000), { id: uid(2), timeCreated: 1001 }, workRow(3, 1002)],
      },
    }));
    const page = await getWorksInRange(GARDEN, { chainId: 42161, from: 1000, to: 1450 }, {
      query: malformed,
    } as unknown as GraphQLReader);
    expect(page.works.map((work) => work.id)).toEqual([uid(1), uid(3)]);
    expect(page.droppedAt).toEqual([1001]);
  });

  it("lists a work once when a late attestation shifts the next page back over it", async () => {
    // The second page starts one row early, as when an earlier attestation is indexed
    // between the two reads.
    const shifted = vi.fn(async (_document, variables) => {
      const start = variables.skip === 0 ? 0 : variables.skip - 1;
      return { data: { attestations: records.slice(start, start + variables.take) } };
    });
    const page = await getWorksInRange(GARDEN, { chainId: 42161, from: 1000, to: 1450 }, {
      query: shifted,
    } as unknown as GraphQLReader);
    const ids = page.works.map((work) => work.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
