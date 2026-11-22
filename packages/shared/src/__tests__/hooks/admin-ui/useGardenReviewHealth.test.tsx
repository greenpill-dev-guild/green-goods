import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGardenReviewHealth } from "../../../hooks/admin-ui/garden/useGardenReviewHealth";
import type { GardenReviewFlow } from "../../../modules/work/work-list";
import { createMockWork } from "../../test-utils/mock-factories";
import { createTestQueryClient } from "../../test-utils/query-client";

const flow = vi.hoisted(() => ({ current: null as GardenReviewFlow | null, fails: false }));
vi.mock("../../../modules/work/work-list", async (original) => ({
  ...(await original<typeof import("../../../modules/work/work-list")>()),
  readGardenReviewFlow: async () => {
    if (flow.fails) throw new Error("EAS unreachable");
    return flow.current;
  },
}));
vi.mock("../../../hooks/work/useWorkVisibility", () => ({
  workVisibilityQuery: () => ({ queryKey: ["visibility"], queryFn: async () => ({}) }),
}));

// Thursday 19 November 2026, 3 pm on the device's clock: this week began Monday the 16th.
const NOW = new Date(2026, 10, 19, 15);
const at = (month: number, day: number) =>
  Math.floor(new Date(2026, month - 1, day, 12).getTime() / 1000);

function renderHealth(entry = "/garden/health") {
  const client = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return renderHook(() => useGardenReviewHealth("0xgarden", true), { wrapper });
}

describe("Review Health's eight weeks", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    flow.current = {
      submitted: [
        { ...createMockWork({ id: "sent-this-week", createdAt: at(11, 17), status: "pending" }) },
        { ...createMockWork({ id: "sent-last-week", createdAt: at(11, 10), status: "approved" }) },
      ],
      reviewed: [
        {
          // Sent long before the chart, first decided this week: it counts this week.
          work: createMockWork({ id: "old-decided", createdAt: at(8, 1), status: "approved" }),
          firstDecidedAt: at(11, 18),
        },
      ],
      submittedComplete: true,
      reviewedReadFrom: null,
      reviewedComplete: true,
    } as unknown as GardenReviewFlow;
  });
  afterEach(() => {
    vi.useRealTimers();
    flow.fails = false;
  });

  it("covers eight Monday-first weeks, this one last", async () => {
    const { result } = renderHealth();
    await waitFor(() => expect(result.current.state).toBe("ready"));
    const { weeks } = result.current;
    expect(weeks).toHaveLength(8);
    expect(weeks.every((week) => week.start.getDay() === 1)).toBe(true);
    expect(weeks.at(-1)?.start).toEqual(new Date(2026, 10, 16));
    expect(weeks.at(-1)?.isCurrent).toBe(true);
    expect(weeks[0].start).toEqual(new Date(2026, 8, 28));
  });

  it("counts a submission in the week it was sent and a review in its first decision's week", async () => {
    const { result } = renderHealth();
    await waitFor(() => expect(result.current.state).toBe("ready"));
    const [lastWeek, thisWeek] = result.current.weeks.slice(-2);
    expect(thisWeek.submitted.map((work) => work.id)).toEqual(["sent-this-week"]);
    expect(lastWeek.submitted.map((work) => work.id)).toEqual(["sent-last-week"]);
    expect(thisWeek.reviewed.map((work) => work.id)).toEqual(["old-decided"]);
    expect(result.current.weeks.flatMap((week) => week.reviewed)).toHaveLength(1);
  });

  it("marks only the weeks a cut read could not cover", async () => {
    flow.current = {
      ...flow.current!,
      submittedComplete: false,
      reviewedReadFrom: at(11, 4),
    };
    const { result } = renderHealth();
    await waitFor(() => expect(result.current.state).toBe("ready"));
    const { weeks } = result.current;
    // Submissions past the last one read (17 Nov) are missing: only this week is short.
    expect(weeks.map((week) => week.submittedComplete)).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      false,
    ]);
    // Decisions before 4 Nov are missing: every week up to the one holding 4 Nov is short.
    expect(weeks.map((week) => week.reviewedComplete)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      true,
      true,
    ]);
  });

  it("keeps the last weeks read when a refresh fails, and says they are the last read", async () => {
    const { result } = renderHealth();
    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(result.current.stale).toBe(false);
    flow.fails = true;
    await act(async () => void (await result.current.retry()));
    await waitFor(() => expect(result.current.stale).toBe(true));
    expect(result.current.state).toBe("ready");
    expect(result.current.weeks.at(-1)?.submitted).toHaveLength(1);
  });

  it("opens the week and the list the URL names", async () => {
    const { result } = renderHealth("/garden/health?week=2026-11-16&list=reviewed");
    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(result.current.openWeek?.start).toEqual(new Date(2026, 10, 16));
    expect(result.current.openList).toBe("reviewed");
    expect(result.current.weekHref(result.current.weeks[0], "submitted")).toContain(
      "week=2026-09-28"
    );
  });
});
