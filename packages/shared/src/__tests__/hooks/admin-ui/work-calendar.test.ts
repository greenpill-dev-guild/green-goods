import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gardensKeys } from "../../../config/query-keys/garden";
import { worksKeys } from "../../../config/query-keys/work";
import { useCalendarNow } from "../../../hooks/admin-ui/garden/useCalendarNow";
import { useGardenWorkCalendar } from "../../../hooks/admin-ui/garden/useGardenWorkCalendar";
import { refreshApprovalReads } from "../../../modules/work/approval-read-refresh";
import {
  buildWorkCalendar,
  parseWorkDay,
  parseWorkMonth,
  workDayRange,
  workMonthRange,
} from "../../../hooks/admin-ui/garden/workCalendar";
import { parseWorkScope } from "../../../hooks/admin-ui/review/review.utils";
import { useReviewWorkDay } from "../../../hooks/admin-ui/review/useReviewWorkDay";
import { resolveReviewRouteState } from "../../../hooks/admin-ui/review/review.workbenchModel";
import { adminRoutes } from "../../../utils/navigation/admin-routes";
import { createMockWork } from "../../test-utils/mock-factories";
import { createTestQueryClient } from "../../test-utils/query-client";

const rangeRead = vi.hoisted(() => ({
  current: {
    works: [] as unknown[],
    unknownIds: new Set<string>(),
    complete: true,
    readThrough: null as number | null,
    hasRead: true,
    isLoading: false,
    isFetching: false,
    isError: false,
    isPaused: false,
    refetch: () => Promise.resolve(),
  },
}));
vi.mock("../../../hooks/work/useGardenWorkRange", () => ({
  useGardenWorkRange: () => rangeRead.current,
}));

// Local wall times, so the suite reads the same in every zone it runs in.
const at = (year: number, month: number, day: number, hour = 12) =>
  Math.floor(new Date(year, month - 1, day, hour).getTime() / 1000);
const NOW = new Date(2026, 10, 19, 15);

describe("the Activity calendar's month", () => {
  const works = [
    createMockWork({ id: "late-oct", createdAt: at(2026, 10, 31, 23), status: "approved" }),
    createMockWork({ id: "first", createdAt: at(2026, 11, 1, 0), status: "approved" }),
    createMockWork({ id: "second", createdAt: at(2026, 11, 1, 9), status: "pending" }),
    createMockWork({ id: "rejected", createdAt: at(2026, 11, 19, 8), status: "rejected" }),
    createMockWork({ id: "unread", createdAt: at(2026, 11, 19, 9), status: "pending" }),
  ];
  const calendar = buildWorkCalendar(works, new Set(["unread"]), "2026-11", NOW);
  const cells = calendar.weeks.flat();
  const cell = (day: string) => cells.find((item) => item.day === day);

  it("counts each submission once, on the day it was sent, and never a neighbouring month's", () => {
    expect(calendar.counts).toEqual({ total: 4, approved: 1, pending: 1, rejected: 1, unknown: 1 });
    expect(calendar.daysWithWork).toBe(2);
    expect(cell("2026-11-01")?.works.map((work) => work.id)).toEqual(["first", "second"]);
    // A status nobody could read is unknown, never counted as pending.
    expect(cell("2026-11-19")?.counts).toMatchObject({ rejected: 1, unknown: 1, pending: 0 });
    // October's last day pads the first week and holds nothing of October's.
    expect(cell("2026-10-31")).toMatchObject({ inMonth: false, works: [] });
    expect(cells.reduce((sum, item) => sum + item.counts.total, 0)).toBe(calendar.counts.total);
  });

  it("lays the month out in whole Monday-first weeks and marks today and the days to come", () => {
    expect(calendar.weeks.map((week) => week.length)).toEqual([7, 7, 7, 7, 7, 7]);
    expect(calendar.weeks[0][0].day).toBe("2026-10-26");
    expect(calendar.weeks.at(-1)?.at(-1)?.day).toBe("2026-12-06");
    expect(cell("2026-11-19")).toMatchObject({ isToday: true, isFuture: false });
    expect(cell("2026-11-20")).toMatchObject({ isToday: false, isFuture: true });
  });

  it("reads the days after a cut read as not read, and the day it stopped in as a minimum", () => {
    // The read stopped at 08:00 on the 19th, partway through the day.
    const cut = buildWorkCalendar(works, new Set(), "2026-11", NOW, at(2026, 11, 19, 8));
    const cutCell = (day: string) => cut.weeks.flat().find((item) => item.day === day);
    expect(cutCell("2026-11-01")?.coverage).toBe("whole");
    expect(cutCell("2026-11-19")).toMatchObject({ coverage: "partial" });
    // A read that stopped on the 10th leaves every later day that has begun unread, never empty.
    expect(
      buildWorkCalendar(works, new Set(), "2026-11", NOW, at(2026, 11, 10, 8))
        .weeks.flat()
        .filter((item) => item.inMonth && item.day > "2026-11-10" && !item.isFuture)
        .every((item) => item.coverage === "unread")
    ).toBe(true);
    expect(cutCell("2026-11-20")?.coverage).toBe("whole");
    expect(calendar.weeks.flat().every((item) => item.coverage === "whole")).toBe(true);
  });

  it("reads a month and a day as half-open ranges that meet without a gap", () => {
    const month = workMonthRange("2026-11");
    expect(month).toEqual({ from: at(2026, 11, 1, 0), to: at(2026, 12, 1, 0) });
    expect(workMonthRange("2026-12").from).toBe(month.to);
    expect(workDayRange("2026-11-30")).toEqual({ from: at(2026, 11, 30, 0), to: month.to });
  });
});

describe("the month and day a URL names", () => {
  it("falls back to this month for a missing, malformed or future month", () => {
    expect(parseWorkMonth("2026-08", NOW)).toBe("2026-08");
    for (const value of [null, "", "2026-13", "nov", "2026-12", "2027-01"]) {
      expect(parseWorkMonth(value, NOW)).toBe("2026-11");
    }
  });

  it("accepts only a real calendar day that has begun", () => {
    expect(parseWorkDay("2026-11-19", NOW)).toBe("2026-11-19");
    for (const value of [null, "2026-11-20", "2026-02-30", "2026-11", "yesterday"]) {
      expect(parseWorkDay(value, NOW)).toBeNull();
    }
  });
});

describe("Review's Work tab on one day", () => {
  const routeState = (
    dayParam: string | null,
    scopeParam: string | null,
    pathname = "/review/work"
  ) =>
    resolveReviewRouteState({
      pathname,
      sortParam: null,
      scopeParam,
      dayParam,
      routedWorkIdParam: undefined,
      routedAssessmentIdParam: undefined,
      activeContentId: null,
    });

  it("shows every status for a day unless a scope narrows it, and pending without a day", () => {
    expect(routeState("2020-05-04", null)).toMatchObject({
      workDay: "2020-05-04",
      workScope: "all",
    });
    expect(routeState("2020-05-04", "pending").workScope).toBe("pending");
    expect(routeState("2020-05-04", "approved").workScope).toBe("approved");
    expect(routeState(null, null)).toMatchObject({ workDay: null, workScope: "pending" });
    expect(parseWorkScope("all")).toBe("pending");
    // A day left in the URL narrows only the Work tab.
    expect(routeState("2020-05-04", null, "/review/assess").workDay).toBeNull();
  });

  it("writes the day into Review links, and a scope only where it is not the default", () => {
    const garden = "0x1111111111111111111111111111111111111111";
    expect(adminRoutes.reviewWork({ gardenId: garden, day: "2026-11-19", scope: "all" })).toBe(
      `/review/work?gardenId=${garden}&day=2026-11-19`
    );
    expect(adminRoutes.reviewWork({ gardenId: garden, day: "2026-11-19", scope: "pending" })).toBe(
      `/review/work?gardenId=${garden}&scope=pending&day=2026-11-19`
    );
    expect(adminRoutes.reviewWork({ gardenId: garden, scope: "pending" })).toBe(
      `/review/work?gardenId=${garden}`
    );
    expect(
      adminRoutes.gardenActivity({ gardenId: garden, month: "2026-10", day: "2026-10-03" })
    ).toBe(`/garden/activity?gardenId=${garden}&month=2026-10&day=2026-10-03`);
  });
});

describe("the calendar's today on a Hub left open", () => {
  afterEach(() => vi.useRealTimers());

  it("holds through the day and moves on once the local day turns", () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date(2026, 10, 30, 23, 59));
    const { result } = renderHook(() => useCalendarNow());
    const first = result.current;

    act(() => vi.advanceTimersByTime(30_000));
    expect(result.current).toBe(first);

    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.getMonth()).toBe(11);
    expect(result.current.getDate()).toBe(1);
  });
});

describe("a decision made from the calendar's day", () => {
  it("rereads the garden's months and days, so the decision does not flip back to Pending", () => {
    const client = createTestQueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    refreshApprovalReads(client, 42161, { gardenId: "0xGarden", workUID: "0xwork" }, false);
    const day = worksKeys.range("0xgarden", 42161, 100, 200);
    const prefixes = invalidate.mock.calls.map(([filters]) => filters?.queryKey ?? []);
    expect(prefixes.some((prefix) => prefix.every((part, index) => part === day[index]))).toBe(
      true
    );
  });

  it("rereads the garden's Gardeners readiness, so a member's stage follows the decision", () => {
    const client = createTestQueryClient();
    const readiness = gardensKeys.memberReadiness("0xGarden", ["0xMember"], 42161);
    client.setQueryData(readiness, {});
    refreshApprovalReads(client, 42161, { gardenId: "0xGarden", workUID: "0xwork" }, false);
    expect(client.getQueryState(readiness)?.isInvalidated).toBe(true);
  });
});

describe("the calendar's URL", () => {
  afterEach(() => {
    vi.useRealTimers();
    rangeRead.current = { ...rangeRead.current, hasRead: true, isPaused: false, isError: false };
  });

  function renderCalendar(entry: string) {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(MemoryRouter, { initialEntries: [entry] }, children);
    return renderHook(
      () => ({
        calendar: useGardenWorkCalendar({ gardenId: "0xgarden", active: true }),
        location: useLocation(),
        navigate: useNavigate(),
      }),
      { wrapper }
    );
  }

  it("opens a day linked without its month in that day's month", () => {
    const { result } = renderCalendar("/garden/activity?day=2026-10-03");
    expect(result.current.calendar.month).toBe("2026-10");
    expect(result.current.calendar.openDay?.day).toBe("2026-10-03");
  });

  it("keeps the feed's range when a day opens", () => {
    const { result } = renderCalendar("/garden/activity?range=7d");
    act(() => result.current.calendar.handleOpenDay("2026-11-03"));
    expect(result.current.location.search).toContain("range=7d");
    expect(result.current.location.search).toContain("day=2026-11-03");
  });

  // A dialog that switches what it shows replaces its URL; closing it still goes back.
  it("closes a pushed day back onto the page beneath, after a replace while it stays open", () => {
    const { result } = renderCalendar("/garden/activity?range=7d");
    act(() => result.current.calendar.handleOpenDay("2026-11-03"));
    act(() =>
      result.current.navigate("/garden/activity?range=7d&day=2026-11-03&list=x", { replace: true })
    );
    act(() => result.current.calendar.handleCloseDay());
    expect(result.current.location.search).toBe("?range=7d");
  });

  it("keeps a month read before going offline and says it is the last read", () => {
    rangeRead.current = { ...rangeRead.current, hasRead: true, isPaused: true };
    const { result } = renderCalendar("/garden/activity");
    expect(result.current.calendar.state).toBe("ready");
    expect(result.current.calendar.stale).toBe(true);
    expect(result.current.calendar.refreshFailed).toBe(false);
  });

  it("keeps a month whose reread failed online, and says the refresh failed", () => {
    rangeRead.current = { ...rangeRead.current, hasRead: true, isError: true };
    const { result } = renderCalendar("/garden/activity");
    expect(result.current.calendar.state).toBe("ready");
    expect(result.current.calendar.refreshFailed).toBe(true);
    expect(result.current.calendar.stale).toBe(false);
  });
});

describe("Show Whole Day on a Review day", () => {
  it("drops only the scope, so the day stays open on every status", () => {
    const updateSearch = vi.fn();
    const { result } = renderHook(() =>
      useReviewWorkDay({
        gardenId: "0xgarden",
        day: "2026-11-20",
        workScope: "pending",
        updateSearch,
      })
    );
    act(() => result.current.handleShowWholeDay?.());
    expect(updateSearch).toHaveBeenCalledWith({ scope: undefined });
    expect(parseWorkScope(undefined, true)).toBe("all");
  });

  it("knows no status of the day until its read lands, so nothing can be decided from it", () => {
    const settled = rangeRead.current;
    rangeRead.current = { ...settled, hasRead: false, isPaused: true };
    try {
      const { result } = renderHook(() =>
        useReviewWorkDay({
          gardenId: "0xgarden",
          day: "2026-11-20",
          workScope: "all",
          updateSearch: vi.fn(),
        })
      );
      expect(result.current.workDayStatusKnown).toBe(false);
    } finally {
      rangeRead.current = settled;
    }
  });

  it("is not offered off a day", () => {
    const { result } = renderHook(() =>
      useReviewWorkDay({
        gardenId: "0xgarden",
        day: null,
        workScope: "pending",
        updateSearch: vi.fn(),
      })
    );
    expect(result.current.handleShowWholeDay).toBeUndefined();
  });
});
