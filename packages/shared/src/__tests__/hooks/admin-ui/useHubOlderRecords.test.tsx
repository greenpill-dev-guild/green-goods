/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from "@testing-library/react";
import { useCallback, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HubPipelineStage, SortDirection } from "../../../hooks/admin-ui/hub/hub.utils";
import { useHubOlderRecords } from "../../../hooks/admin-ui/hub/useHubOlderRecords";
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
function usePagedWork(total: number, reads: PendingRead[]): GardenListPages {
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
    isLoadingOlder: inFlight && take > PAGE,
    readAt: read.at,
  };
}

/** A garden with more hypercerts than the page holds. */
const OLDER_HYPERCERTS: GardenListPages = {
  hasOlder: true,
  loadOlder: () => undefined,
  isLoadingOlder: false,
  readAt: 1,
};

interface Props {
  stage: HubPipelineStage;
  sortDirection: SortDirection;
  workReadable: boolean;
}

function renderHub(total: number, initial: Props, hypercertPages = OLDER_HYPERCERTS) {
  const reads: PendingRead[] = [];
  const asked = { pages: 0 };
  const view = renderHook(
    (props: Props) => {
      const pages = usePagedWork(total, reads);
      const workPages = {
        ...pages,
        loadOlder: () => {
          asked.pages += 1;
          pages.loadOlder();
        },
      };
      return useHubOlderRecords({ ...props, workPages, hypercertPages });
    },
    { initialProps: initial }
  );
  const landNextRead = () => act(() => reads.shift()?.land());
  const failNextRead = () => act(() => reads.shift()?.fail());
  return { ...view, asked, landNextRead, failNextRead, pendingReads: () => reads.length };
}

describe("useHubOlderRecords", () => {
  beforeEach(() => {
    connectivity.online = true;
  });

  it("reads the whole history for Oldest first and lists nothing until its last page lands", () => {
    // 130 works: the 50 newest, then two more pages.
    const hub = renderHub(130, { stage: "work", sortDirection: "oldest", workReadable: true });
    const seen = [hub.result.current.readsWorkHistory];

    expect(hub.asked.pages).toBe(1);
    hub.landNextRead();
    seen.push(hub.result.current.readsWorkHistory);
    expect(hub.asked.pages).toBe(2);
    hub.landNextRead();

    // The last read holds all 130, so nothing older remains and the list shows.
    expect(hub.asked.pages).toBe(2);
    expect(seen).toEqual([true, true]);
    expect(hub.result.current.readsWorkHistory).toBe(false);
    expect(hub.result.current.olderWork).toBeUndefined();
  });

  it("offers each list its next page on request, without reading ahead", () => {
    const hub = renderHub(130, { stage: "work", sortDirection: "newest", workReadable: true });

    expect(hub.result.current.readsWorkHistory).toBe(false);
    expect(hub.result.current.olderHypercerts).toBeDefined();
    expect(hub.asked.pages).toBe(0);

    act(() => hub.result.current.olderWork?.onShowOlder());
    expect(hub.asked.pages).toBe(1);
    // The widened window has nothing older to show until its read lands, and the
    // control stays, busy, so a steward's focus is not dropped while it loads.
    expect(hub.result.current.olderWork?.isLoading).toBe(true);
    hub.landNextRead();
    expect(hub.result.current.olderWork?.isLoading).toBe(false);

    act(() => hub.result.current.olderWork?.onShowOlder());
    hub.landNextRead();
    // 130 works fill the third page, so nothing is left to offer.
    expect(hub.asked.pages).toBe(2);
    expect(hub.result.current.olderWork).toBeUndefined();
  });

  it("keeps the button after its page fails to load, idle, to ask again", () => {
    const hub = renderHub(130, { stage: "work", sortDirection: "newest", workReadable: true });

    act(() => hub.result.current.olderWork?.onShowOlder());
    hub.failNextRead();
    expect(hub.result.current.olderWork?.isLoading).toBe(false);

    act(() => hub.result.current.olderWork?.onShowOlder());
    expect(hub.asked.pages).toBe(2);
  });

  // A failed or paused read never lands its page: reading on would hold the
  // loading rows over the error the tab must show.
  it("stops reading when the work read fails, and asks again once it reads", () => {
    const hub = renderHub(200, { stage: "work", sortDirection: "oldest", workReadable: true });
    expect(hub.asked.pages).toBe(1);

    hub.rerender({ stage: "work", sortDirection: "oldest", workReadable: false });
    hub.landNextRead();
    expect(hub.result.current.readsWorkHistory).toBe(false);
    expect(hub.asked.pages).toBe(1);

    hub.rerender({ stage: "work", sortDirection: "oldest", workReadable: true });
    expect(hub.result.current.readsWorkHistory).toBe(true);
    expect(hub.asked.pages).toBe(2);
  });

  it("offers no older page offline, where none can be read", () => {
    connectivity.online = false;
    const hub = renderHub(130, { stage: "work", sortDirection: "oldest", workReadable: true });

    expect(hub.result.current.readsWorkHistory).toBe(false);
    expect(hub.result.current.olderWork).toBeUndefined();
    expect(hub.result.current.olderHypercerts).toBeUndefined();
    expect(hub.asked.pages).toBe(0);
    expect(hub.pendingReads()).toBe(0);
  });
});
