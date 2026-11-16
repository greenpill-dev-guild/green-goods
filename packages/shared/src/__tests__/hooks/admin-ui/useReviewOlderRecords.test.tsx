/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from "@testing-library/react";
import { useCallback, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ReviewPipelineStage,
  SortDirection,
} from "../../../hooks/admin-ui/review/review.utils";
import { useReviewOlderRecords } from "../../../hooks/admin-ui/review/useReviewOlderRecords";
import type { GardenListPages } from "../../../types/garden-detail";

const PAGE = 50;

interface PendingRead {
  land: () => void;
  fail: () => void;
}
const connectivity = vi.hoisted(() => ({ online: true }));

vi.mock("../../../hooks/app/useOnlineStatus", () => ({
  useOnlineStatus: () => connectivity.online,
}));

/**
 * A garden's work read a page at a time, the way `useWorks` reads it: one row
 * past the window says there is more, a widened window shows nothing older
 * until its read lands, and a landed read carries a new read time. Each read
 * waits in `reads` until the test lands it or fails it; a failed read changes
 * nothing but ending.
 */
function usePagedWork(total: number, reads: PendingRead[], reread: () => void): GardenListPages {
  const [take, setTake] = useState(PAGE);
  const [read, setRead] = useState({ rows: Math.min(total, PAGE + 1), at: 1 });
  const [inFlight, setInFlight] = useState(false);
  const loadOlder = useCallback(() => {
    const widened = take + PAGE;
    setTake(widened);
    setInFlight(true);
    reads.push({
      land: () => {
        setRead((last) => ({ rows: Math.min(total, widened + 1), at: last.at + 1 }));
        setInFlight(false);
      },
      fail: () => setInFlight(false),
    });
  }, [reads, take, total]);
  return {
    hasOlder: read.rows > take,
    loadOlder,
    reread,
    isLoadingOlder: inFlight && take > PAGE,
    readAt: read.at,
  };
}

/** A garden with more hypercerts than the page holds. */
const OLDER_HYPERCERTS: GardenListPages = {
  hasOlder: true,
  loadOlder: () => undefined,
  reread: () => undefined,
  isLoadingOlder: false,
  readAt: 1,
};

interface Props {
  garden?: string;
  stage: ReviewPipelineStage;
  sortDirection: SortDirection;
  workReadable: boolean;
}

function renderReview(total: number, initial: Props, hypercertPages = OLDER_HYPERCERTS) {
  const reads: PendingRead[] = [];
  const asked = { pages: 0, rereads: 0 };
  const reread = () => {
    asked.rereads += 1;
  };
  const view = renderHook(
    (props: Props) => {
      const pages = usePagedWork(total, reads, reread);
      const workPages = {
        ...pages,
        loadOlder: () => {
          asked.pages += 1;
          pages.loadOlder();
        },
      };
      return useReviewOlderRecords({ garden: "0xgarden", ...props, workPages, hypercertPages });
    },
    { initialProps: initial }
  );
  const landNextRead = () => act(() => reads.shift()?.land());
  const failNextRead = () => act(() => reads.shift()?.fail());
  return { ...view, asked, landNextRead, failNextRead, pendingReads: () => reads.length };
}

describe("useReviewOlderRecords", () => {
  beforeEach(() => {
    connectivity.online = true;
  });

  it("reads the whole history for Oldest first and lists nothing until its last page lands", () => {
    // 130 works: the 50 newest, then two more pages.
    const review = renderReview(130, {
      stage: "work",
      sortDirection: "oldest",
      workReadable: true,
    });
    const seen = [review.result.current.readsWorkHistory];

    expect(review.asked.pages).toBe(1);
    review.landNextRead();
    seen.push(review.result.current.readsWorkHistory);
    expect(review.asked.pages).toBe(2);
    review.landNextRead();

    // The last read holds all 130, so nothing older remains and the list shows.
    expect(review.asked.pages).toBe(2);
    expect(seen).toEqual([true, true]);
    expect(review.result.current.readsWorkHistory).toBe(false);
    expect(review.result.current.olderWork).toBeUndefined();
  });

  it("offers each list its next page on request, without reading ahead", () => {
    const review = renderReview(130, {
      stage: "work",
      sortDirection: "newest",
      workReadable: true,
    });

    expect(review.result.current.readsWorkHistory).toBe(false);
    expect(review.result.current.olderHypercerts).toBeDefined();
    expect(review.asked.pages).toBe(0);

    act(() => review.result.current.olderWork?.onShowOlder?.());
    expect(review.asked.pages).toBe(1);
    // The widened window has nothing older to show until its read lands, and the
    // control stays, busy, so a steward's focus is not dropped while it loads.
    expect(review.result.current.olderWork?.isLoading).toBe(true);
    review.landNextRead();
    expect(review.result.current.olderWork?.isLoading).toBe(false);

    act(() => review.result.current.olderWork?.onShowOlder?.());
    review.landNextRead();
    // 130 works fill the third page, so nothing is left to offer.
    expect(review.asked.pages).toBe(2);
    expect(review.result.current.olderWork).toBeUndefined();
  });

  // Widening again after a failure would ask a bigger read of a source that
  // just failed, so the retry reads the same width.
  it("keeps the button after its page fails to load, and asks for the same page again", () => {
    const review = renderReview(130, {
      stage: "work",
      sortDirection: "newest",
      workReadable: true,
    });

    act(() => review.result.current.olderWork?.onShowOlder?.());
    review.failNextRead();
    expect(review.result.current.olderWork?.isLoading).toBe(false);

    act(() => review.result.current.olderWork?.onShowOlder?.());
    expect(review.asked).toEqual({ pages: 1, rereads: 1 });
  });

  // A failed or paused read never lands its page: reading on would hold the
  // loading rows over the error the tab must show.
  it("stops reading when the work read fails, and asks again once it reads", () => {
    const review = renderReview(200, {
      stage: "work",
      sortDirection: "oldest",
      workReadable: true,
    });
    expect(review.asked.pages).toBe(1);

    review.rerender({ stage: "work", sortDirection: "oldest", workReadable: false });
    review.landNextRead();
    expect(review.result.current.readsWorkHistory).toBe(false);
    expect(review.asked.pages).toBe(1);

    review.rerender({ stage: "work", sortDirection: "oldest", workReadable: true });
    expect(review.result.current.readsWorkHistory).toBe(true);
    expect(review.asked.pages).toBe(2);
  });

  it("still says there is more offline, where no page can be read, without offering one", () => {
    connectivity.online = false;
    const review = renderReview(130, {
      stage: "work",
      sortDirection: "oldest",
      workReadable: true,
    });

    expect(review.result.current.readsWorkHistory).toBe(false);
    expect(review.result.current.olderWork).toEqual({ isLoading: false });
    expect(review.result.current.olderHypercerts).toEqual({ isLoading: false });
    expect(review.asked.pages).toBe(0);
    expect(review.pendingReads()).toBe(0);
  });

  it("keeps a page on its way with its garden while another garden is open", () => {
    const review = renderReview(130, {
      stage: "work",
      sortDirection: "newest",
      workReadable: true,
    });
    act(() => review.result.current.olderWork?.onShowOlder?.());

    review.rerender({
      garden: "0xother",
      stage: "work",
      sortDirection: "newest",
      workReadable: true,
    });
    expect(review.result.current.olderWork).toBeUndefined();
    review.rerender({
      garden: "0xgarden",
      stage: "work",
      sortDirection: "newest",
      workReadable: true,
    });
    expect(review.result.current.olderWork?.isLoading).toBe(true);
  });
});
