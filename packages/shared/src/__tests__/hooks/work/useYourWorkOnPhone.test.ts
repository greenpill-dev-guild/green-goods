/**
 * Your Work on this phone, in one garden (PWA Home step 8): the reads behind Home's Continue,
 * and what they say about loading and failure. Which items belong is the selector's, tested in
 * modules/work/your-work-on-phone.test.ts.
 *
 * @vitest-environment happy-dom
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useYourWorkOnPhone } from "../../../hooks/work/useYourWorkOnPhone";
import type { Work } from "../../../types/domain";
import { createMockWork } from "../../test-utils/mock-factories";

const ME = "0xa11ce00000000000000000000000000000000001";
const GARDEN = "0x6a7de00000000000000000000000000000000aaa";
const OTHER_GARDEN = "0x0757e00000000000000000000000000000000bbb";

const mocks = vi.hoisted(() => ({
  works: [] as Work[],
  myWorksLoading: false,
  myWorksError: false,
  myWorksRefetch: vi.fn(async () => ({ status: "success" })),
  drafts: [] as Array<{ id: string; gardenAddress: string | null }>,
  draftsLoading: false,
  refetchDrafts: vi.fn(async () => undefined),
  proofs: [] as Array<{ id: string; garden: string | null }>,
  queueUnavailable: false,
  waitingDecisionWorkIds: new Set<string>() as ReadonlySet<string>,
  decisionFor: vi.fn(() => undefined),
  needsReviewGardens: [] as string[][],
  decidedHere: [] as Work[],
  needsReviewLoading: false,
  needsReviewError: false,
  needsReviewRefetch: vi.fn(async () => true),
  linkedWorkIds: new Set<string>() as ReadonlySet<string>,
  queueRefresh: vi.fn(),
}));

vi.mock("../../../hooks/auth/useUser", () => ({ useUser: () => ({ user: { id: ME } }) }));
vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({ usePrimaryAddress: () => ME }));
// The reads are the edges: the indexer and the queue behind them are not this hook's.
vi.mock("../../../hooks/work/useMyWorks", () => ({
  useMyWorks: () => ({
    data: mocks.works,
    isLoading: mocks.myWorksLoading,
    isError: mocks.myWorksError,
    refetch: mocks.myWorksRefetch,
  }),
}));
vi.mock("../../../hooks/work/useDrafts", () => ({
  useDrafts: () => ({
    drafts: mocks.drafts,
    isLoading: mocks.draftsLoading,
    refetchDrafts: mocks.refetchDrafts,
  }),
}));
vi.mock("../../../hooks/client-ui/commitment/usePendingProof", () => ({
  usePendingProof: () => ({ items: mocks.proofs, isUnavailable: mocks.queueUnavailable }),
}));
vi.mock("../../../hooks/work/useWorkUploads", () => ({
  useWorkUploads: () => ({
    waitingDecisionWorkIds: mocks.waitingDecisionWorkIds,
    decisionFor: mocks.decisionFor,
  }),
}));
vi.mock("../../../hooks/work/useNeedsReview", () => ({
  useNeedsReview: (gardenIds: string[]) => {
    mocks.needsReviewGardens.push(gardenIds);
    return {
      decidedHere: gardenIds.length > 0 ? mocks.decidedHere : [],
      isLoading: gardenIds.length > 0 && mocks.needsReviewLoading,
      isError: gardenIds.length > 0 && mocks.needsReviewError,
      refetch: mocks.needsReviewRefetch,
    };
  },
}));
vi.mock("../../../hooks/commitment-pooling/useCommitmentQueueState", () => ({
  useCommitmentQueueState: () => ({
    linkedWorkIds: mocks.linkedWorkIds,
    refresh: mocks.queueRefresh,
  }),
}));

const render = () => renderHook(() => useYourWorkOnPhone(GARDEN)).result.current;

function queuedWork(id: string, overrides: Partial<Work> = {}): Work {
  return createMockWork({
    id,
    status: "offline",
    gardenerAddress: ME,
    gardenAddress: GARDEN,
    ...overrides,
  });
}

describe("useYourWorkOnPhone", () => {
  beforeEach(() => {
    mocks.works = [];
    mocks.myWorksLoading = false;
    mocks.myWorksError = false;
    mocks.drafts = [];
    mocks.draftsLoading = false;
    mocks.proofs = [];
    mocks.queueUnavailable = false;
    mocks.waitingDecisionWorkIds = new Set();
    mocks.needsReviewGardens = [];
    mocks.decidedHere = [];
    mocks.needsReviewLoading = false;
    mocks.needsReviewError = false;
    mocks.linkedWorkIds = new Set();
    vi.clearAllMocks();
  });

  it("lists and counts the garden's items still on this phone", () => {
    mocks.works = [
      queuedWork("0xoffline_0001"),
      queuedWork("0xoffline_0002", { gardenAddress: OTHER_GARDEN }),
    ];
    mocks.drafts = [
      { id: "d1", gardenAddress: GARDEN },
      { id: "d2", gardenAddress: OTHER_GARDEN },
    ];
    mocks.proofs = [{ id: "p1", garden: GARDEN }];

    const onPhone = render();

    expect(onPhone.submissions.map((work) => work.id)).toEqual(["0xoffline_0001"]);
    expect(onPhone.drafts.map((draft) => draft.id)).toEqual(["d1"]);
    expect(onPhone.proofs.map((proof) => proof.id)).toEqual(["p1"]);
    expect(onPhone.count).toBe(3);
  });

  it("reads the garden's work for reviews only while a review from this phone waits", () => {
    render();
    expect(mocks.needsReviewGardens.at(-1)).toEqual([]);

    mocks.waitingDecisionWorkIds = new Set(["0xdec1"]);
    mocks.decidedHere = [
      createMockWork({ id: "0xDEC1", status: "approved", gardenAddress: GARDEN }),
    ];
    const onPhone = render();

    expect(mocks.needsReviewGardens.at(-1)).toEqual([GARDEN]);
    expect(onPhone.decisions.map((work) => work.id)).toEqual(["0xDEC1"]);
  });

  it("is loading while the phone's lists are first read, and while a waiting review's garden is", () => {
    expect(render().isLoading).toBe(false);

    mocks.draftsLoading = true;
    expect(render().isLoading).toBe(true);

    mocks.draftsLoading = false;
    mocks.myWorksLoading = true;
    expect(render().isLoading).toBe(true);

    mocks.myWorksLoading = false;
    mocks.needsReviewLoading = true;
    expect(render().isLoading).toBe(false);
    mocks.waitingDecisionWorkIds = new Set(["0xdec1"]);
    expect(render().isLoading).toBe(true);
  });

  it("fails when the queue or a waiting review's garden cannot be read, not when only the record's read of the reader's work does", () => {
    mocks.myWorksError = true;
    expect(render().isError).toBe(false);

    mocks.queueUnavailable = true;
    const queueFailed = render();
    expect(queueFailed.isError).toBe(true);
    expect(queueFailed.queueUnreadable).toBe(true);

    mocks.queueUnavailable = false;
    mocks.needsReviewError = true;
    mocks.waitingDecisionWorkIds = new Set(["0xdec1"]);
    const gardenFailed = render();
    expect(gardenFailed.isError).toBe(true);
    expect(gardenFailed.queueUnreadable).toBe(false);
  });

  it("marks work a link queued on this phone counts, by its id or by its client id", () => {
    mocks.linkedWorkIds = new Set(["0xoffline_0001", "client-7"]);
    const onPhone = render();

    expect(onPhone.isLinked(queuedWork("0xoffline_0001"))).toBe(true);
    expect(
      onPhone.isLinked(
        queuedWork("0xoffline_0002", { metadata: JSON.stringify({ clientWorkId: "client-7" }) })
      )
    ).toBe(true);
    expect(onPhone.isLinked(queuedWork("0xoffline_0003"))).toBe(false);
  });

  it("reads everything again on refetch, the queue included", () => {
    mocks.waitingDecisionWorkIds = new Set(["0xdec1"]);
    render().refetch();

    expect(mocks.queueRefresh).toHaveBeenCalledTimes(1);
    expect(mocks.myWorksRefetch).toHaveBeenCalledTimes(1);
    expect(mocks.refetchDrafts).toHaveBeenCalledTimes(1);
    expect(mocks.needsReviewRefetch).toHaveBeenCalledTimes(1);
  });
});
