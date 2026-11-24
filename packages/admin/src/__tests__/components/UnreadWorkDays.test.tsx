/**
 * @vitest-environment happy-dom
 */

import type {
  GardenWorkCalendar,
  WorkCalendarDay,
} from "@green-goods/shared/hooks/admin-ui/garden/useGardenWorkspaceController";
import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorkCalendarGrid } from "@/views/Garden/components/WorkCalendarGrid";
import { ReviewWorkQueue } from "@/views/Review/components/ReviewWorkQueue";
import { renderWithProviders } from "../test-utils";

const NO_COUNTS = { total: 0, approved: 0, pending: 0, rejected: 0, unknown: 0 };

function day(key: string, coverage: WorkCalendarDay["coverage"]): WorkCalendarDay {
  return {
    day: key,
    inMonth: true,
    isToday: false,
    isFuture: false,
    counts: NO_COUNTS,
    works: [],
    coverage,
  };
}

describe("a day whose statuses could not be read", () => {
  it("does not call Pending all caught up, and points to the day's whole list", () => {
    const onShowWholeDay = vi.fn();
    renderWithProviders(
      <ReviewWorkQueue
        items={[]}
        scope="pending"
        unknownIds={new Set(["0xunread"])}
        onShowWholeDay={onShowWholeDay}
        worksLoading={false}
        hasDataError={false}
        normalizedSearch=""
        debouncedSearch=""
        actionsMap={new Map()}
        selectedWorkId={undefined}
        onOpenWorkDetail={vi.fn()}
        onClearSearch={vi.fn()}
      />
    );

    expect(screen.queryByText("All caught up")).not.toBeInTheDocument();
    expect(screen.getByText("Some statuses could not be read")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show Whole Day" }));
    expect(onShowWholeDay).toHaveBeenCalledOnce();
  });

  it("opens from the phone's list of days, as a grid day does", () => {
    const handleOpenDay = vi.fn();
    const calendar = {
      weeks: [
        [
          day("2026-11-16", "whole"),
          day("2026-11-17", "whole"),
          day("2026-11-18", "unread"),
          day("2026-11-19", "unread"),
          day("2026-11-20", "unread"),
          day("2026-11-21", "unread"),
          day("2026-11-22", "unread"),
        ],
      ],
      openDay: null,
      handleOpenDay,
    } as unknown as GardenWorkCalendar;

    renderWithProviders(<WorkCalendarGrid calendar={calendar} monthLabel="November 2026" />);

    const list = screen.getByRole("list", { name: "November 2026, newest day first" });
    fireEvent.click(within(list).getByRole("button", { name: /November 19: not read/ }));
    expect(handleOpenDay).toHaveBeenCalledWith("2026-11-19");
  });
});
