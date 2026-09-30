import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EASWork, EASWorkApproval } from "../../../types/eas-responses";

const seams = vi.hoisted(() => ({
  list: vi.fn(),
  approvals: vi.fn(),
  byUID: vi.fn(),
  approvalsForWork: vi.fn(),
}));

vi.mock("../../../modules/data/eas", () => ({
  WORK_LIST_PAGE_SIZE: 50,
  getWorkListPage: seams.list,
  getWorksByUIDs: seams.byUID,
  getWorkApprovalsForWork: seams.approvalsForWork,
  readWorkApprovalsForWorks: seams.approvals,
}));

const CONFIGURED_UID = `0x${"1".repeat(64)}`;
const chain = vi.hoisted(() => ({ workApprovalUID: "" }));
vi.mock("../../../config/blockchain", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../config/blockchain")>()),
  getEASConfig: () => ({ WORK_APPROVAL: { uid: chain.workApprovalUID } }),
}));

const { readApprovedWorks, readWorkByUID, readWorkList } = await import(
  "../../../modules/work/work-list"
);

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

describe("readWorkByUID", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens an older reviewed work outside the garden list window", async () => {
    seams.byUID.mockResolvedValue([work("work-older")]);
    seams.approvalsForWork.mockResolvedValue([approval("approval-1", "work-older", false)]);

    const row = await readWorkByUID("work-older", 42161);

    expect(seams.byUID).toHaveBeenCalledWith(["work-older"], 42161);
    expect(row?.approval?.approved).toBe(false);
  });

  it("retains the work with unknown review status if the approval read fails", async () => {
    seams.byUID.mockResolvedValue([work("work-older")]);
    seams.approvalsForWork.mockRejectedValue(new Error("Unavailable"));

    const row = await readWorkByUID("work-older", 42161);

    expect(row?.id).toBe("work-older");
    expect(row).not.toHaveProperty("approval");
  });
});

describe("readApprovedWorks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chain.workApprovalUID = CONFIGURED_UID;
  });

  it("calls approval unknown, not none, on a chain with no decision schema", async () => {
    chain.workApprovalUID = `0x${"0".repeat(64)}`;

    await expect(readApprovedWorks([work("work-1")], 42220)).resolves.toEqual({
      works: [],
      partial: true,
    });
    expect(seams.approvals).not.toHaveBeenCalled();
  });

  it("keeps only works whose latest decision approved them", async () => {
    const at = (decision: EASWorkApproval, createdAt: number) => ({ ...decision, createdAt });
    seams.approvals.mockResolvedValue({
      approvals: [
        approval("a-approved", "approved", true),
        approval("a-rejected", "rejected", false),
        at(approval("a-overturned-1", "overturned", true), 10),
        at(approval("a-overturned-2", "overturned", false), 20),
        at(approval("a-reinstated-1", "reinstated", false), 10),
        at(approval("a-reinstated-2", "reinstated", true), 20),
        approval("a-tied-1", "tied", true),
        approval("a-tied-2", "tied", false),
      ],
      failedWorkUIDs: [],
    });
    const works = ["approved", "pending", "rejected", "overturned", "reinstated", "tied"].map(work);

    const result = await readApprovedWorks(works, 42161);

    expect(result.works.map((row) => row.id)).toEqual(["approved", "reinstated"]);
    expect(result.partial).toBe(false);
  });

  it("leaves out work whose decisions could not be read, and says approved work may be missing", async () => {
    // A batch that fails part-way can already have returned some of its decisions.
    seams.approvals.mockResolvedValueOnce({
      approvals: [approval("a-1", "work-1", true), approval("a-2", "work-2", true)],
      failedWorkUIDs: ["work-2"],
    });
    await expect(readApprovedWorks([work("work-1"), work("work-2")], 42161)).resolves.toEqual({
      works: [work("work-1")],
      partial: true,
    });

    seams.approvals.mockRejectedValueOnce(new Error("Unavailable"));
    await expect(readApprovedWorks([work("work-1")], 42161)).resolves.toEqual({
      works: [],
      partial: true,
    });
  });
});
