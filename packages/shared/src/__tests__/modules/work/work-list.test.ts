import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EASWork, EASWorkApproval } from "../../../types/eas-responses";

const seams = vi.hoisted(() => ({ list: vi.fn(), approvals: vi.fn() }));

vi.mock("../../../modules/data/eas", () => ({
  WORK_LIST_PAGE_SIZE: 50,
  getWorkListPage: seams.list,
  readWorkApprovalsForWorks: seams.approvals,
}));

const { readWorkList } = await import("../../../modules/work/work-list");

function work(id: string): EASWork {
  return {
    id,
    title: id,
    actionUID: 1,
    gardenerAddress: "0x1111111111111111111111111111111111111111",
    gardenAddress: "0x2222222222222222222222222222222222222222",
    feedback: "",
    metadata: "{}",
    media: [],
    createdAt: 1,
  };
}

function approval(id: string, workUID: string, approved: boolean): EASWorkApproval {
  return {
    id,
    workUID,
    approved,
    createdAt: 10,
    stewardAddress: "0x3333333333333333333333333333333333333333",
    gardenerAddress: "0x1111111111111111111111111111111111111111",
    actionUID: 1,
    feedback: "",
    confidence: 0,
    verificationMethod: 0,
    reviewNotesCID: "",
  };
}

describe("readWorkList", () => {
  beforeEach(() => vi.clearAllMocks());

  it("preserves successful approval batches while failed works stay unknown", async () => {
    seams.list.mockResolvedValue([work("work-1"), work("work-2"), work("work-3")]);
    seams.approvals.mockResolvedValue({
      approvals: [approval("approval-1", "work-1", true)],
      failedWorkUIDs: ["work-2"],
    });

    const rows = await readWorkList({ garden: "garden", chainId: 42161 });

    expect(rows[0].approval?.approved).toBe(true);
    expect(rows[1]).not.toHaveProperty("approval");
    expect(rows[2].approval).toBeNull();
  });

  it("keeps status unknown when conflicting latest decisions share a timestamp", async () => {
    seams.list.mockResolvedValue([work("work-1")]);
    seams.approvals.mockResolvedValue({
      approvals: [approval("approval-a", "work-1", true), approval("approval-b", "work-1", false)],
      failedWorkUIDs: [],
    });

    const [row] = await readWorkList({ garden: "garden", chainId: 42161 });

    expect(row).not.toHaveProperty("approval");
  });
});
