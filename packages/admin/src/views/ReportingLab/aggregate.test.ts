import { describe, expect, it } from "vitest";
import { buildCalendar, dayStateOf, measureSeries, reportWeeks, statusAt } from "./aggregate";
import { participation } from "./breakdowns";
import { dayKeyOf, instantAt } from "./dates";
import { compostGarden } from "./fixtureCompostGarden";
import { learningGarden } from "./fixtureLearningGarden";
import { LAB_REFERENCE_MS } from "./fixtureTools";
import { fundingSummary } from "./funding";
import type { ReportDataset, WorkRecord } from "./model";
import { ageBandOf, reviewHealth } from "./reviewHealth";
import { buildScenario } from "./scenarios";
import { closingDay, periodEnd } from "./scope";

const garden = compostGarden();
const at = (day: string, hour = 10) => instantAt(day, hour, 0, garden.utcOffsetMinutes);
let nextId = 0;

function record(overrides: Partial<WorkRecord>): WorkRecord {
  nextId += 1;
  return {
    id: `r-${nextId}`,
    actionId: "waste.sorting_breakdown",
    title: "Sort",
    accountId: "kestrel",
    submittedAt: at("2025-12-30"),
    decision: "pending",
    approvalReadable: true,
    quantities: { totalAmountKg: 10 },
    minutes: 60,
    media: "waste",
    photoCount: 1,
    ...overrides,
  };
}

function dataset(records: WorkRecord[], loadedFrom: number | null = null): ReportDataset {
  return {
    garden,
    records,
    reference: LAB_REFERENCE_MS,
    loadedFrom,
    totalAvailable: null,
    state: "ready",
  };
}

describe("reporting lab aggregation", () => {
  it("puts an instant on the day it was in the garden's own zone", () => {
    const instant = Date.UTC(2026, 0, 12, 22, 30);
    expect(dayKeyOf(instant, compostGarden().timeZone)).toBe("2026-01-13");
    expect(dayKeyOf(instant, learningGarden().timeZone)).toBe("2026-01-12");
  });

  it("adds a month's days up to exactly the records submitted in that month", () => {
    const data = buildScenario("compost");
    for (const month of ["2025-10", "2025-11", "2025-12", "2026-01"]) {
      for (const moment of [data.reference, periodEnd(month, data)]) {
        const calendar = buildCalendar({
          dataset: data,
          records: data.records,
          month,
          groupBy: "submitted",
          at: moment,
          status: "all",
        });
        const inMonth = data.records.filter((r) =>
          dayKeyOf(r.submittedAt, garden.timeZone).startsWith(month)
        );
        const cells = calendar.weeks.flat().filter((cell) => cell.inMonth);
        expect(cells.reduce((sum, cell) => sum + cell.counts.total, 0)).toBe(inMonth.length);
        for (const { counts } of cells) {
          expect(counts.approved + counts.pending + counts.rejected + counts.unknown).toBe(
            counts.total
          );
        }
      }
    }
  });

  it("reads a past month at its end or today, and reviews land on their review day", () => {
    const late = record({ id: "late", decision: "approved", reviewedAt: at("2026-01-05", 17) });
    const data = dataset([
      late,
      record({ id: "waiting" }),
      record({ id: "unread", approvalReadable: false }),
    ]);
    expect(statusAt(late, periodEnd("2025-12", data))).toBe("pending");
    expect(statusAt(late, data.reference)).toBe("approved");
    // A month's end is midnight starting the next day; its label still names the month's last day.
    expect(closingDay(periodEnd("2025-12", data), data)).toBe("2025-12-31");
    expect(closingDay(data.reference, data)).toBe("2026-01-16");

    const byReview = buildCalendar({
      dataset: data,
      records: data.records,
      month: "2026-01",
      groupBy: "reviewed",
      at: data.reference,
      status: "all",
    });
    const reviewedDays = byReview.weeks.flat().filter((cell) => cell.counts.total > 0);
    expect(reviewedDays.map((cell) => [cell.day, cell.records.map((r) => r.id)])).toEqual([
      ["2026-01-05", ["late"]],
    ]);
  });

  it("tells a zero day apart from days before records, beyond the read and still to come", () => {
    const data = dataset([], at("2026-01-06", 9));
    expect(
      ["2025-09-30", "2026-01-02", "2026-01-06", "2026-01-08", "2026-01-20"].map((day) =>
        dayStateOf(day, data)
      )
    ).toEqual(["before-records", "not-loaded", "partial", "recorded", "future"]);
  });

  it("keeps each measure to its own action, and a missing quantity apart from zero", () => {
    const data = dataset([
      record({ id: "a", decision: "approved", reviewedAt: at("2025-12-31") }),
      record({ id: "b", quantities: { totalAmountKg: null } }),
      record({
        id: "t",
        actionId: "waste.transfer_receipt",
        quantities: { amountTransferredKg: 300 },
      }),
    ]);
    const sorted = garden.measures.find((measure) => measure.id === "kgSorted");
    if (!sorted) throw new Error("kgSorted measure missing");
    const week = measureSeries(data, data.records, sorted, reportWeeks("2025-12", data)).at(-1);
    expect(week).toMatchObject({ reported: 10, approved: 10, missing: 1 });
    expect(week?.records.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("sorts waiting work into age bands at their lower edges", () => {
    const now = at("2026-01-15", 12);
    const ages = [0, 1.99, 2, 6.99, 7, 13.99, 14, 30];
    expect(
      ages.map((days) => ageBandOf(record({ submittedAt: now - days * 86_400_000 }), now))
    ).toEqual(["under-2d", "under-2d", "2-7d", "2-7d", "1-2w", "1-2w", "over-2w", "over-2w"]);
  });

  it("reads review health with the shipped stall rule in each scenario", () => {
    const health = (id: Parameters<typeof buildScenario>[0]) => {
      const data = buildScenario(id);
      return reviewHealth(data, data.records, data.reference, "2026-01");
    };
    expect(health("compost").label).toBe("On track");
    expect(health("compost-backlog").label).toBe("Needs attention");
    expect(health("learning").label).toBe("Review stalled");

    const partial = buildScenario("partial");
    const partialHealth = reviewHealth(partial, partial.records, partial.reference, "2026-01");
    expect(partial.records).toHaveLength(50);
    expect(partial.totalAvailable).toBeNull();
    expect(partialHealth.unknown).toBeGreaterThan(0);
    expect(partialHealth.pending.every((r) => r.approvalReadable)).toBe(true);
  });

  it("sums each asset alone, moves no balance for a plan and counts an unread entry nowhere", () => {
    const summary = fundingSummary(garden, LAB_REFERENCE_MS, "2025-12");
    expect(summary.assets.map((asset) => asset.asset)).toEqual(["DAI", "WETH"]);
    const dai = summary.assets[0];
    expect(dai.allocated).toBe(100);
    expect(dai.accounts.map((a) => a.label)).toEqual(["Endowment (DAI vault)", "Cookie jar (DAI)"]);
    for (const account of dai.accounts) {
      expect(account.points.every((point) => point.balance >= 0)).toBe(true);
    }

    const partial = buildScenario("partial", 1).garden;
    const withUnread = fundingSummary(partial, LAB_REFERENCE_MS, "2026-01");
    const jar = (s: typeof summary) =>
      s.assets[0].accounts.find((a) => a.account === "jar")?.balance ?? 0;
    expect(withUnread.unreadable).toBe(1);
    expect(jar(withUnread) - jar(fundingSummary(garden, LAB_REFERENCE_MS, "2026-01"))).toBeCloseTo(
      20
    );
  });

  it("orders participation by name with shared devices last, never by volume", () => {
    const data = dataset([
      record({ accountId: "tablet" }),
      record({ accountId: "tablet" }),
      record({ accountId: "kestrel" }),
      record({ accountId: "basalt", submittedAt: at("2025-12-01") }),
    ]);
    const weeks = reportWeeks("2025-12", data, 5);
    const { matrix, perWeek } = participation(data, data.records, weeks);
    expect(matrix.map((row) => row.account.id)).toEqual([
      "basalt",
      "fennel",
      "heron",
      "juniper",
      "kestrel",
      "marigold",
      "tamarind",
      "tablet",
    ]);
    expect(perWeek.at(-1)).toMatchObject({ accounts: 2, sharedDevices: 1, attendance: null });
  });

  it("sends a late upload after its work and before it reaches the chain, in every scenario", () => {
    let checked = 0;
    for (const id of ["compost", "compost-backlog", "learning"] as const) {
      const data = buildScenario(id);
      for (const item of data.records.filter((each) => each.sentFromDeviceAt !== undefined)) {
        const sent = item.sentFromDeviceAt ?? 0;
        expect(sent).toBeLessThan(item.submittedAt);
        if (item.performedOn) {
          expect(dayKeyOf(sent, data.garden.timeZone) >= item.performedOn).toBe(true);
        }
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});
