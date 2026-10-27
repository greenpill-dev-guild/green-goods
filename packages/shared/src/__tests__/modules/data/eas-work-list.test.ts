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
