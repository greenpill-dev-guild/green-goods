import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EASWork, EASWorkApproval } from "../../../types/eas-responses";
import { GQLClient, GRAPHQL_TIMEOUT_MS, TimeoutError } from "../../../modules/data/graphql-client";

const seams = vi.hoisted(() => ({
  list: vi.fn(),
  approvals: vi.fn(),
  byUID: vi.fn(),
  approvalsForWork: vi.fn(),
  activity: vi.fn(),
  range: vi.fn(),
  visibility: vi.fn(async () => ({
    chainId: 42161,
    excludedWorkUIDs: [] as string[],
    excludedApprovalUIDs: [] as string[],
  })),
}));

vi.mock("../../../modules/work/work-visibility", async (original) => ({
  ...(await original<typeof import("../../../modules/work/work-visibility")>()),
  readWorkVisibility: seams.visibility,
}));

vi.mock("../../../modules/data/eas", () => ({
  WORK_LIST_PAGE_SIZE: 50,
  getWorkListPage: seams.list,
  getWorksByUIDs: seams.byUID,
  getWorkApprovalsForWork: seams.approvalsForWork,
  readWorkApprovalsForWorks: seams.approvals,
  getGardenActivitySince: seams.activity,
  getWorksInRange: seams.range,
}));

const CONFIGURED_UID = `0x${"1".repeat(64)}`;
const chain = vi.hoisted(() => ({ workApprovalUID: "" }));
vi.mock("../../../config/blockchain", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../config/blockchain")>()),
  getEASConfig: () => ({ WORK_APPROVAL: { uid: chain.workApprovalUID } }),
}));

const {
  readApprovedWorks,
  readGardenActivity,
  readGardenReviewFlow,
  readGardenWorkRange,
  readWorkByUID,
  readWorkList,
} = await import("../../../modules/work/work-list");

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

  it("reads at most two gardens at once, and a failed read frees its turn", async () => {
    const pending: Array<{ resolve: (works: EASWork[]) => void; reject: (error: Error) => void }> =
      [];
    seams.list.mockImplementation(
      () => new Promise<EASWork[]>((resolve, reject) => pending.push({ resolve, reject }))
    );
    const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

    const reads = ["a", "b", "c", "d"].map((garden) =>
      readWorkList({ garden, chainId: 42161 }).catch((error: Error) => error)
    );
    await settle();
    expect(seams.list).toHaveBeenCalledTimes(2);

    pending[0].reject(new Error("getWorkListPage timed out after 12000ms"));
    await settle();
    expect(seams.list).toHaveBeenCalledTimes(3);

    for (const read of pending.slice(1)) read.resolve([]);
    await settle();
    pending[3].resolve([]);

    const results = await Promise.all(reads);
    expect(results[0]).toBeInstanceOf(Error);
    expect(results.slice(1)).toEqual([[], [], []]);
    expect(seams.list.mock.calls.map(([garden]) => garden)).toEqual(["a", "b", "c", "d"]);
  });

  it("aborts timed-out HTTP requests before queued garden reads start", async () => {
    vi.useFakeTimers();
    let activeRequests = 0;
    let peakRequests = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            activeRequests += 1;
            peakRequests = Math.max(peakRequests, activeRequests);
            init?.signal?.addEventListener(
              "abort",
              () => {
                activeRequests -= 1;
                reject(init.signal?.reason);
              },
              { once: true }
            );
          })
      )
    );
    const client = new GQLClient("https://example.test/graphql");
    seams.list.mockImplementation(async () => {
      const result = await client.query("query WorkList { works }", {}, "getWorkListPage");
      if (result.error) throw result.error;
      return [];
    });

    try {
      const reads = ["a", "b", "c", "d"].map((garden) =>
        readWorkList({ garden, chainId: 42161 }).catch((error: Error) => error)
      );
      await vi.advanceTimersByTimeAsync(GRAPHQL_TIMEOUT_MS * 2);
      const results = await Promise.all(reads);

      expect(results.every((result) => result instanceof TimeoutError)).toBe(true);
      expect(peakRequests).toBe(2);
      expect(activeRequests).toBe(0);
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });
});

describe("readGardenActivity", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads a garden's week however far back each work began", async () => {
    seams.activity.mockResolvedValue({
      works: [work("work-new"), work("work-decided")],
      decisions: [
        approval("approval-new", "work-decided", true),
        // A work from before the window, decided inside it.
        approval("approval-old", "work-old", false),
      ],
      truncated: false,
    });
    seams.byUID.mockResolvedValue([work("work-old")]);

    const activity = await readGardenActivity({ garden: "garden", chainId: 42161, since: 5 });

    expect(seams.activity).toHaveBeenCalledWith("garden", {
      chainId: 42161,
      since: 5,
      excludedWorkUIDs: [],
      excludedApprovalUIDs: [],
    });
    expect(seams.byUID).toHaveBeenCalledWith(["work-old"], 42161);
    expect(activity.complete).toBe(true);
    expect(activity.rows.map(({ id, approval }) => [id, approval?.id ?? approval])).toEqual([
      ["work-new", null],
      ["work-decided", "approval-new"],
      ["work-old", "approval-old"],
    ]);
  });

  it("says the week is incomplete when a list ran over or an older work could not be read", async () => {
    seams.activity.mockResolvedValue({
      works: [work("work-new")],
      decisions: [approval("approval-old", "work-old", false)],
      truncated: false,
    });
    seams.byUID.mockRejectedValue(new Error("getWorksByUIDs timed out"));

    const unread = await readGardenActivity({ garden: "garden", chainId: 42161, since: 5 });
    expect(unread.complete).toBe(false);
    expect(unread.rows.map(({ id }) => id)).toEqual(["work-new"]);

    seams.activity.mockResolvedValue({ works: [work("work-new")], decisions: [], truncated: true });
    const cut = await readGardenActivity({ garden: "garden", chainId: 42161, since: 5 });
    expect(cut.complete).toBe(false);
  });
});

describe("readGardenWorkRange", () => {
  beforeEach(() => vi.clearAllMocks());
  const GARDEN = "0x2222222222222222222222222222222222222222" as const;
  const period = { garden: GARDEN, chainId: 42161, from: 100, to: 200 };

  it("gives a period's works their latest decision and leaves an unread status unknown", async () => {
    seams.range.mockResolvedValue({
      works: [work("approved"), work("waiting"), work("unread")],
      truncated: false,
    });
    seams.approvals.mockResolvedValue({
      approvals: [approval("approval", "approved", true)],
      failedWorkUIDs: ["unread"],
    });

    const range = await readGardenWorkRange(period);

    expect(seams.range).toHaveBeenCalledWith(GARDEN, {
      chainId: 42161,
      from: 100,
      to: 200,
      excludedWorkUIDs: [],
      excludedApprovalUIDs: [],
    });
    expect(range.complete).toBe(true);
    // null is read and undecided; a missing approval is a status nobody could read.
    expect(range.rows.map(({ id, approval }) => [id, approval?.id ?? approval])).toEqual([
      ["approved", "approval"],
      ["waiting", null],
      ["unread", undefined],
    ]);
  });

  it("keeps the works when no decision can be read, and says when the period was cut", async () => {
    seams.range.mockResolvedValue({ works: [work("work")], truncated: true });
    seams.approvals.mockRejectedValue(new Error("EAS timed out"));

    const range = await readGardenWorkRange(period);

    expect(range.complete).toBe(false);
    expect(range.rows).toEqual([work("work")]);
  });
});

describe("readWorkByUID", () => {
  it("does not reopen an excluded work through its direct link", async () => {
    seams.visibility.mockResolvedValueOnce({
      chainId: 42161,
      excludedWorkUIDs: ["work-hidden"],
      excludedApprovalUIDs: [],
    });
    seams.byUID.mockResolvedValue([work("work-hidden")]);
    seams.approvalsForWork.mockResolvedValue([]);

    await expect(readWorkByUID("WORK-HIDDEN", 42161)).resolves.toBeNull();
  });
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

// PRD-1578: Review Health counts a reviewed work once, in the week of its first decision.
describe("readGardenReviewFlow", () => {
  beforeEach(() => vi.clearAllMocks());
  const at = (id: string, workUID: string, createdAt: number) => ({
    ...approval(id, workUID, true),
    createdAt,
  });
  const garden = "0x2222222222222222222222222222222222222222" as const;

  it("places each reviewed work at its first decision, sent in the period or before it", async () => {
    seams.range.mockResolvedValue({
      works: [{ ...work("new"), createdAt: 150 }],
      truncated: false,
    });
    seams.activity.mockResolvedValue({
      works: [],
      decisions: [at("d-new", "new", 160), at("d-old", "old", 170), at("d-again", "again", 180)],
      truncated: false,
    });
    seams.approvals.mockResolvedValue({
      // "again" was first decided before the period, so its later decision does not count.
      approvals: [
        at("d-new", "new", 160),
        at("d-old", "old", 170),
        at("d-first", "again", 50),
        at("d-again", "again", 180),
      ],
      failedWorkUIDs: [],
    });
    seams.byUID.mockResolvedValue([work("old"), work("again")]);

    const flow = await readGardenReviewFlow({ garden, chainId: 42161, from: 100, to: 200 });
    expect(flow.submitted.map((row) => row.id)).toEqual(["new"]);
    expect(flow.reviewed.map(({ work, firstDecidedAt }) => [work.id, firstDecidedAt])).toEqual([
      ["new", 160],
      ["old", 170],
    ]);
    expect(flow.reviewedReadFrom).toBeNull();
    expect(flow.reviewedComplete).toBe(true);
  });

  it("says where a cut decision read starts, and when decision histories could not be read", async () => {
    seams.range.mockResolvedValue({ works: [], truncated: false });
    seams.activity.mockResolvedValue({
      works: [],
      decisions: [at("d-1", "w-1", 190), at("d-2", "w-2", 140)],
      truncated: true,
      decisionsTruncated: true,
    });
    seams.approvals.mockResolvedValue({ approvals: [], failedWorkUIDs: ["w-1", "w-2"] });
    seams.byUID.mockResolvedValue([]);

    const flow = await readGardenReviewFlow({ garden, chainId: 42161, from: 100, to: 200 });
    expect(flow.reviewedReadFrom).toBe(140);
    expect(flow.reviewedComplete).toBe(false);
    expect(flow.reviewed).toEqual([]);

    // A long submissions list beside a whole decisions list hides no decision.
    seams.activity.mockResolvedValue({
      works: [],
      decisions: [],
      truncated: true,
      decisionsTruncated: false,
    });
    const whole = await readGardenReviewFlow({ garden, chainId: 42161, from: 100, to: 200 });
    expect(whole.reviewedReadFrom).toBeNull();
  });
});
