/**
 * Your Work on this phone, in the active garden's scope (PWA Home steps 8 and 12): the reads behind
 * Home's Continue, and what they say about loading and failure. Which items belong is the
 * selector's, tested in modules/work/your-work-on-phone.test.ts.
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
const LEFT_GARDEN = "0x1ef70000000000000000000000000000000000dd";

const mocks = vi.hoisted(() => ({
  activeGardenId: null as string | null,
  works: [] as Work[],
  myWorksLoading: false,
  queuedLoading: false,
  queuedError: false,
  myWorksError: false,
  myWorksRefetch: vi.fn(async () => ({ status: "success" })),
  drafts: [] as Array<{ id: string; gardenAddress: string | null }>,
  draftsLoading: false,
  draftsError: false,
  refetchDrafts: vi.fn(async () => undefined),
  proofs: [] as Array<{ id: string; garden: string | null; savedGarden: string | null }>,
  queueLoading: false,
  queueUnavailable: false,
  uploadsLoading: false,
  uploadsError: false,
  uploadsRefetch: vi.fn(),
  waitingDecisionWorkIds: new Set<string>() as ReadonlySet<string>,
  waitingDecisionGardenIds: [] as string[],
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
// The active garden's own rule: its garden, a garden the member left and what names none show;
// OTHER_GARDEN is another of the member's gardens, which waits until the chip switches to it.
vi.mock("../../../hooks/garden/useActiveGarden", async () => {
  const { isInGardenListScope } = await vi.importActual<
    typeof import("../../../modules/garden/active-garden")
  >("../../../modules/garden/active-garden");
  return {
    useActiveGarden: () => ({
      gardenId: mocks.activeGardenId,
      inScope: (gardens: readonly (string | null | undefined)[]) =>
        isInGardenListScope(
          {
            activeGardenId: mocks.activeGardenId,
            memberGardenIds: new Set([GARDEN, OTHER_GARDEN]),
          },
          gardens
        ),
    }),
  };
});
vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({ usePrimaryAddress: () => ME }));
// The reads are the edges: the indexer and the queue behind them are not this hook's.
vi.mock("../../../hooks/work/useMyWorks", () => ({
  useMyWorks: () => ({
    data: mocks.works,
    isLoading: mocks.myWorksLoading,
    isLoadingQueued: mocks.queuedLoading,
    isErrorQueued: mocks.queuedError,
    isError: mocks.myWorksError,
    refetch: mocks.myWorksRefetch,
  }),
}));
vi.mock("../../../hooks/work/useDrafts", () => ({
  useDrafts: () => ({
    drafts: mocks.drafts,
    isLoading: mocks.draftsLoading,
    isError: mocks.draftsError,
    refetchDrafts: mocks.refetchDrafts,
  }),
}));
vi.mock("../../../hooks/client-ui/commitment/usePendingProof", () => ({
  usePendingProof: () => ({ items: mocks.proofs, isUnavailable: mocks.queueUnavailable }),
}));
vi.mock("../../../hooks/work/useWorkUploads", () => ({
  useWorkUploads: () => ({
    waitingDecisionWorkIds: mocks.waitingDecisionWorkIds,
    waitingDecisionGardenIds: mocks.waitingDecisionGardenIds,
    decisionFor: mocks.decisionFor,
    isLoading: mocks.uploadsLoading,
    isError: mocks.uploadsError,
    refetch: mocks.uploadsRefetch,
  }),
}));
// Each garden's list holds its own works: a garden that is not read lists nothing.
vi.mock("../../../hooks/work/useNeedsReview", () => ({
  useNeedsReview: (gardenIds: string[]) => {
    mocks.needsReviewGardens.push(gardenIds);
    const read = new Set(gardenIds.map((garden) => garden.toLowerCase()));
    return {
      decidedHere: mocks.decidedHere.filter((work) => read.has(work.gardenAddress.toLowerCase())),
      isLoading: gardenIds.length > 0 && mocks.needsReviewLoading,
      isError: gardenIds.length > 0 && mocks.needsReviewError,
      savedAt: undefined,
      refetch: mocks.needsReviewRefetch,
    };
  },
}));
vi.mock("../../../hooks/commitment-pooling/useCommitmentQueueState", () => ({
  useCommitmentQueueState: () => ({
    linkedWorkIds: mocks.linkedWorkIds,
    isLoading: mocks.queueLoading,
    isUnavailable: mocks.queueUnavailable,
    refresh: mocks.queueRefresh,
  }),
}));

const render = () => renderHook(() => useYourWorkOnPhone()).result.current;

function queuedWork(id: string, overrides: Partial<Work> = {}): Work {
  return createMockWork({
    id,
    status: "offline",
    gardenerAddress: ME,
    gardenAddress: GARDEN,
    ...overrides,
  });
}

/** A review this phone made, queued: its work, and the garden its job writes to. */
function queueReview(id: string, gardenAddress: string) {
  mocks.waitingDecisionWorkIds = new Set([...mocks.waitingDecisionWorkIds, id.toLowerCase()]);
  mocks.waitingDecisionGardenIds = [...new Set([...mocks.waitingDecisionGardenIds, gardenAddress])];
  mocks.decidedHere = [
    ...mocks.decidedHere,
    createMockWork({ id, status: "approved", gardenAddress }),
  ];
}

describe("useYourWorkOnPhone", () => {
  beforeEach(() => {
    mocks.activeGardenId = GARDEN;
    mocks.works = [];
    mocks.myWorksLoading = false;
    mocks.queuedLoading = false;
    mocks.queuedError = false;
    mocks.myWorksError = false;
    mocks.drafts = [];
    mocks.draftsLoading = false;
    mocks.draftsError = false;
    mocks.proofs = [];
    mocks.queueLoading = false;
    mocks.queueUnavailable = false;
    mocks.uploadsLoading = false;
    mocks.uploadsError = false;
    mocks.waitingDecisionWorkIds = new Set();
    mocks.waitingDecisionGardenIds = [];
    mocks.needsReviewGardens = [];
    mocks.decidedHere = [];
    mocks.needsReviewLoading = false;
    mocks.needsReviewError = false;
    mocks.linkedWorkIds = new Set();
    vi.clearAllMocks();
  });

  it("lists and counts the active garden's items still on this phone", () => {
    mocks.works = [
      queuedWork("0xoffline_0001"),
      queuedWork("0xoffline_0002", { gardenAddress: OTHER_GARDEN }),
    ];
    mocks.drafts = [
      { id: "d1", gardenAddress: GARDEN },
      { id: "d2", gardenAddress: OTHER_GARDEN },
    ];
    mocks.proofs = [
      { id: "p1", garden: OTHER_GARDEN, savedGarden: GARDEN },
      { id: "p2", garden: GARDEN, savedGarden: OTHER_GARDEN },
    ];

    const onPhone = render();

    expect(onPhone.submissions.map((work) => work.id)).toEqual(["0xoffline_0001"]);
    expect(onPhone.drafts.map((draft) => draft.id)).toEqual(["d1"]);
    expect(onPhone.proofs.map((proof) => proof.id)).toEqual(["p1"]);
    expect(onPhone.count).toBe(3);
  });

  it("lists a review queued for a garden the member left, as the badge counts it, and reads only the gardens waiting reviews name", () => {
    render();
    expect(mocks.needsReviewGardens.at(-1)).toEqual([]);

    queueReview("0xDEC1", GARDEN);
    queueReview("0xDEC2", LEFT_GARDEN);
    // Another of the member's gardens: it is listed once the chip switches there.
    queueReview("0xDEC3", OTHER_GARDEN);
    const onPhone = render();

    expect(mocks.needsReviewGardens.at(-1)).toEqual([GARDEN, LEFT_GARDEN]);
    expect(onPhone.decisions.map((work) => work.id)).toEqual(["0xDEC1", "0xDEC2"]);
    expect(onPhone.count).toBe(2);
  });

  it("waits on a cold mount until the queue's uploads and promise acts are read, so a phone holding only a queued review or proof never reads as empty", () => {
    expect(render().isLoading).toBe(false);

    mocks.uploadsLoading = true;
    const uploadsUnread = render();
    expect(uploadsUnread.isLoading).toBe(true);
    expect(uploadsUnread.count).toBe(0);

    mocks.uploadsLoading = false;
    mocks.queueLoading = true;
    expect(render().isLoading).toBe(true);
  });

  it("is loading while the drafts, the queued work or a waiting review's garden is first read, not the record's read of the reader's work", () => {
    mocks.draftsLoading = true;
    expect(render().isLoading).toBe(true);

    mocks.draftsLoading = false;
    mocks.myWorksLoading = true;
    expect(render().isLoading).toBe(false);

    mocks.myWorksLoading = false;
    mocks.queuedLoading = true;
    expect(render().isLoading).toBe(true);

    mocks.queuedLoading = false;
    mocks.needsReviewLoading = true;
    expect(render().isLoading).toBe(false);
    queueReview("0xdec1", GARDEN);
    expect(render().isLoading).toBe(true);
  });

  it("fails when this phone's queue, uploads, queued work or drafts cannot be read, and says the retry needs no connection", () => {
    mocks.myWorksError = true;
    expect(render().isError).toBe(false);

    for (const unreadable of [
      "queueUnavailable",
      "uploadsError",
      "queuedError",
      "draftsError",
    ] as const) {
      mocks[unreadable] = true;
      const failed = render();
      expect(failed.isError).toBe(true);
      expect(failed.queueUnreadable).toBe(true);
      mocks[unreadable] = false;
    }
  });

  it("fails without blaming the queue when a waiting review's garden cannot be read", () => {
    mocks.needsReviewError = true;
    expect(render().isError).toBe(false);

    queueReview("0xdec1", LEFT_GARDEN);
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

  it("reads everything again on refetch, the queue and its uploads included", () => {
    queueReview("0xdec1", GARDEN);
    render().refetch();

    expect(mocks.queueRefresh).toHaveBeenCalledTimes(1);
    expect(mocks.uploadsRefetch).toHaveBeenCalledTimes(1);
    expect(mocks.myWorksRefetch).toHaveBeenCalledTimes(1);
    expect(mocks.refetchDrafts).toHaveBeenCalledTimes(1);
    expect(mocks.needsReviewRefetch).toHaveBeenCalledTimes(1);
  });
});
