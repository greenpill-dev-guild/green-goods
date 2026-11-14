/**
 * Garden reporting lab: Riverbend Compost Collective, a synthetic waste garden with
 * frequent submissions. Every name, place and amount here is invented sample data.
 */
import { compostLedger } from "./fixtureLedgers";
import type { PromiseItem, ReportGarden } from "./model";

export const COMPOST_ZONE = { timeZone: "Etc/GMT-3", utcOffsetMinutes: 180 } as const;

export const WASTE_ACTIONS = {
  sort: "waste.sorting_breakdown",
  transfer: "waste.transfer_receipt",
  batch: "waste.upcycle_batch",
  cleanup: "waste.cleanup_event",
  check: "waste.maintenance_check",
} as const;

const { sort, transfer, batch, cleanup, check } = WASTE_ACTIONS;
const SEASON = "short-rains";
const CAMPAIGN = "holiday-market";

function promise(
  id: string,
  title: string,
  leadId: string,
  due: string,
  rest: Partial<PromiseItem> = {}
): PromiseItem {
  return { id, title, direction: "offer", windowId: SEASON, leadId, due, ...rest };
}

const PROMISES: PromiseItem[] = [
  promise("p-sort", "Sort market waste each weekday", "kestrel", "2026-01-31", { actionId: sort }),
  promise("p-oct", "October transfer to recycler", "tamarind", "2025-10-31", {
    doneOn: "2025-10-30",
    actionId: transfer,
  }),
  promise("p-nov", "November transfer to recycler", "tamarind", "2025-11-30", {
    doneOn: "2025-12-02",
    actionId: transfer,
  }),
  promise("p-dec", "December transfer to recycler", "kestrel", "2025-12-31", {
    doneOn: "2025-12-30",
    actionId: transfer,
  }),
  promise("p-jan", "January transfer to recycler", "kestrel", "2026-01-31", { actionId: transfer }),
  promise("p-school", "Compost batch for Hillside School beds", "juniper", "2025-12-20", {
    windowId: CAMPAIGN,
    doneOn: "2025-12-18",
    actionId: batch,
  }),
  promise("p-ward", "Ward 4 cleanup day", "heron", "2025-12-13", {
    windowId: CAMPAIGN,
    doneOn: "2025-12-13",
    actionId: cleanup,
  }),
  promise("p-sign", "Signage at the River Road drop-off", "steward.oak", "2026-01-10", {
    direction: "ask",
  }),
];

export function compostGarden(): ReportGarden {
  const people = ["basalt", "fennel", "heron", "juniper", "kestrel", "marigold", "tamarind"];
  return {
    id: "garden-riverbend",
    name: "Riverbend Compost Collective",
    domainLabel: "Waste management",
    ...COMPOST_ZONE,
    zoneLabel: "UTC+3",
    recordsBegin: "2025-10-01",
    media: "waste",
    accounts: [
      { id: "tablet", name: "Sorting station tablet", kind: "shared-device" },
      ...people.map((id) => ({ id, name: id, kind: "person" as const })),
    ],
    team: ["steward.ivy", "steward.oak", "evaluator.rowan"].map((id) => ({
      id,
      name: id,
      kind: "person" as const,
    })),
    sites: [
      { id: "market-gate", name: "Market Gate sorting point", east: 0, north: 0 },
      { id: "river-road", name: "River Road drop-off", east: 600, north: -300 },
      { id: "school-bays", name: "Hillside School compost bays", east: -500, north: 400 },
      { id: "recycler", name: "Recycler weigh station", east: 1800, north: -900 },
      { id: "ward-4", name: "Ward 4 cleanup route", east: 300, north: 900 },
    ],
    actions: [
      { id: sort, title: "Sorting Breakdown", shortTitle: "Sorting" },
      { id: transfer, title: "Transfer Receipt", shortTitle: "Transfer" },
      { id: batch, title: "Compost Batch", shortTitle: "Compost batch" },
      { id: cleanup, title: "Cleanup Event", shortTitle: "Cleanup" },
      { id: check, title: "Maintenance Check", shortTitle: "Maintenance" },
    ],
    measures: [
      {
        id: "kgSorted",
        label: "Waste sorted",
        unit: "kg",
        kind: "sum",
        actionId: sort,
        quantityKey: "totalAmountKg",
      },
      {
        id: "kgTransferred",
        label: "Sent to recycler",
        unit: "kg",
        kind: "sum",
        actionId: transfer,
        quantityKey: "amountTransferredKg",
        note: "Kept apart from sorted: a transfer usually carries material already counted when it was sorted.",
      },
      {
        id: "kgBatch",
        label: "Compost batch input",
        unit: "kg",
        kind: "sum",
        actionId: batch,
        quantityKey: "inputKg",
        note: "Kept apart: batch input is mostly sorted organics already counted above.",
      },
      { id: "hours", label: "Reported work time", unit: "hours", kind: "hours" },
    ],
    windows: [
      {
        id: SEASON,
        kind: "season",
        name: "Short Rains Season",
        start: "2025-10-01",
        end: "2026-01-31",
      },
      {
        id: CAMPAIGN,
        kind: "campaign",
        name: "Holiday Market Campaign",
        start: "2025-12-01",
        end: "2025-12-31",
      },
    ],
    promises: PROMISES,
    milestones: [
      {
        id: "m-baseline",
        title: "Market Waste Baseline",
        on: "2025-09-24",
        kind: "assessment",
        proposed: false,
      },
      {
        id: "m-check",
        title: "Mid-season check-in",
        on: "2025-11-28",
        kind: "check-in",
        proposed: true,
      },
      { id: "m-report", title: "Season report", on: "2026-02-07", kind: "report", proposed: true },
    ],
    baseline: {
      title: "Market Waste Baseline",
      createdOn: "2025-09-24",
      authorId: "evaluator.rowan",
      diagnosis:
        "Traders have no collection point, so about 4 of every 10 sacks of market organic waste end up at the River Road dump.",
      outcome: "Market organic waste reaches sorting and composting instead of the river dump.",
      metric: "Share of market waste sacks found at the River Road dump on a site walk",
      target: "2 of every 10 sacks or fewer by Jan 31, 2026",
      observation: "4 of every 10 sacks",
      observedOn: "2025-09-22",
      method: "Site walk count on three days",
      outputMeasureId: "kgSorted",
      evidenceActionId: check,
      evidenceSiteId: "river-road",
    },
    followUp: {
      observedOn: "2026-01-14",
      observation: "2 of every 10 sacks",
      method: "The same site walk count on three days",
    },
    ledger: compostLedger(COMPOST_ZONE.utcOffsetMinutes),
  };
}
