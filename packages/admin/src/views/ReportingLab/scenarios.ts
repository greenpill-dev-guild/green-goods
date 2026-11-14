/**
 * Garden reporting lab: the review scenarios. Each one is a whole dataset, so every view
 * in a scenario draws from the same records and their totals agree.
 */
import { compostRecords } from "./fixtureCompost";
import { COMPOST_ZONE, compostGarden } from "./fixtureCompostGarden";
import { learningRecords } from "./fixtureLearning";
import { learningGarden } from "./fixtureLearningGarden";
import { LAB_REFERENCE_MS } from "./fixtureTools";
import type { ReportDataset, ReportGarden, WorkRecord } from "./model";

export type ScenarioId =
  | "compost"
  | "compost-backlog"
  | "learning"
  | "learning-long"
  | "partial"
  | "new-garden"
  | "loading"
  | "error";

export interface ScenarioOption {
  id: ScenarioId;
  label: string;
  gardenId: string;
}

export const SCENARIOS: readonly ScenarioOption[] = [
  { id: "compost", label: "Compost: frequent work", gardenId: "garden-riverbend" },
  {
    id: "compost-backlog",
    label: "Compost: growing backlog",
    gardenId: "garden-riverbend",
  },
  { id: "learning", label: "Learning: sparse, stalled", gardenId: "garden-hilltop" },
  { id: "learning-long", label: "Learning: long labels", gardenId: "garden-hilltop" },
  { id: "partial", label: "Partial read: newest 50", gardenId: "garden-riverbend" },
  { id: "new-garden", label: "New garden: no work", gardenId: "garden-northfield" },
  { id: "loading", label: "Loading", gardenId: "garden-riverbend" },
  { id: "error", label: "Read failed", gardenId: "garden-riverbend" },
];

/** The shipped work list reads a garden's newest 50 records first. */
const WORK_PAGE_SIZE = 50;

function dataset(garden: ReportGarden, records: WorkRecord[]): ReportDataset {
  return {
    garden,
    records,
    reference: LAB_REFERENCE_MS,
    loadedFrom: null,
    totalAvailable: records.length,
    state: "ready",
  };
}

function newGarden(): ReportGarden {
  return {
    ...compostGarden(),
    id: "garden-northfield",
    name: "Northfield Garden",
    recordsBegin: "2026-01-05",
    ...COMPOST_ZONE,
    accounts: [
      { id: "gardener.pine", name: "gardener.pine", kind: "person" },
      { id: "gardener.reed", name: "gardener.reed", kind: "person" },
    ],
    team: [{ id: "steward.yew", name: "steward.yew", kind: "person" }],
    sites: [],
    windows: [],
    promises: [],
    milestones: [],
    baseline: null,
    followUp: null,
    ledger: [],
  };
}

const LONG = {
  garden: "Hilltop Community Learning Garden and Seed Library Cooperative of the Upper Valley",
  action: ": soil science, composting and seed saving practical for mixed-age learners",
  account: ".upper-valley-learning-cooperative",
  site: " beside the rainwater harvesting tank and the north boundary hedge",
} as const;

/** The learning garden with every label far longer than usual, to test truncation. */
function withLongLabels(base: ReportDataset): ReportDataset {
  const garden = base.garden;
  const longName = (name: string) => (name.includes(".") ? `${name}${LONG.account}` : name);
  return {
    ...base,
    garden: {
      ...garden,
      name: LONG.garden,
      accounts: garden.accounts.map((account) => ({ ...account, name: longName(account.name) })),
      actions: garden.actions.map((action) => ({
        ...action,
        title: `${action.title}${LONG.action}`,
        shortTitle: `${action.shortTitle}${LONG.action}`,
      })),
      sites: garden.sites.map((site) => ({ ...site, name: `${site.name}${LONG.site}` })),
      windows: garden.windows.map((window) => ({
        ...window,
        name: `${window.name} (Upper Valley Schools Partnership)`,
      })),
      promises: garden.promises.map((item) => ({
        ...item,
        title: `${item.title} for every class in the Upper Valley schools`,
      })),
    },
    records: base.records.map((record) => ({ ...record, title: `${record.title}${LONG.action}` })),
  };
}

/**
 * Today's read: the newest `pages` × 50 records, with some approvals unread and one
 * funding record unreadable. Nothing older is known, not even how much older work exists.
 */
function withLoadedPages(base: ReportDataset, pages: number): ReportDataset {
  const loaded = base.records.slice(-WORK_PAGE_SIZE * pages);
  const unreadEvery = 7;
  const newestFirst = [...loaded].reverse();
  const unread = new Set(
    newestFirst
      .slice(0, WORK_PAGE_SIZE)
      .filter((_, index) => index % unreadEvery === 3)
      .map((record) => record.id)
  );
  return {
    ...base,
    records: loaded.map((record) =>
      unread.has(record.id) ? { ...record, approvalReadable: false } : record
    ),
    loadedFrom: loaded.length < base.records.length ? (loaded[0]?.submittedAt ?? null) : null,
    totalAvailable: loaded.length < base.records.length ? null : base.records.length,
    garden: {
      ...base.garden,
      ledger: base.garden.ledger.map((entry) =>
        entry.id === "c-j12" ? { ...entry, readable: false } : entry
      ),
    },
  };
}

export function buildScenario(id: ScenarioId, pages = 1): ReportDataset {
  switch (id) {
    case "compost":
      return dataset(compostGarden(), compostRecords("typical"));
    case "compost-backlog":
      return dataset(compostGarden(), compostRecords("backlog"));
    case "learning":
      return dataset(learningGarden(), learningRecords());
    case "learning-long":
      return withLongLabels(dataset(learningGarden(), learningRecords()));
    case "partial":
      return withLoadedPages(dataset(compostGarden(), compostRecords("typical")), pages);
    case "new-garden":
      return dataset(newGarden(), []);
    case "loading":
    case "error":
      return { ...dataset(compostGarden(), []), totalAvailable: null, state: id };
  }
}
