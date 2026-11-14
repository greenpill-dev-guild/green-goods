/**
 * Garden reporting lab: the prototype's own record shapes.
 *
 * Storybook-only. Nothing here is wired into a route, and every value the lab draws is
 * synthetic sample data with a fixed reference date. The shapes mirror what the indexer
 * and work metadata hold today, plus the fields the lab proposes (marked below), so a
 * reviewer can see which views need new data.
 */
import type { DayKey } from "./dates";

/** A decision as of the reference date. Work with no decision yet is pending. */
export type ReviewDecision = "pending" | "approved" | "rejected";
/** What a status reads at a moment; unknown when the approval read failed. */
export type StatusView = ReviewDecision | "unknown";
export type ViewerRole = "steward" | "evaluator" | "funder";
/** Which fixture photo a record shows: the stories pass the images in. */
export type MediaKey = "waste" | "edu" | "banner" | "agro";
export type MediaSet = Record<MediaKey, string>;

export interface ReportAccount {
  id: string;
  name: string;
  /** One device used by several people: it is never one person. */
  kind: "person" | "shared-device";
}

/** Proposed: a named place a steward draws. Work today carries only coarse coordinates. */
export interface ReportSite {
  id: string;
  name: string;
  /** Meters east and north of the garden's reference point, rounded to 100 m. */
  east: number;
  north: number;
}

export interface ReportAction {
  id: string;
  title: string;
  shortTitle: string;
  /** Planning, not delivery: a published session says what should happen. */
  planned?: boolean;
}

export interface MeasureDef {
  id: string;
  label: string;
  unit: string;
  kind: "sum" | "count" | "hours";
  actionId?: string;
  quantityKey?: string;
  note?: string;
}

export interface WorkRecord {
  id: string;
  actionId: string;
  title: string;
  accountId: string;
  /** When the work record was created on chain: the lab's "submitted". */
  submittedAt: number;
  /** When the gardener sent it from the device, when that came earlier (a late upload). */
  sentFromDeviceAt?: number;
  /** Only where the work's details record a date; no shipped action asks for one. */
  performedOn?: DayKey;
  reviewedAt?: number;
  reviewerId?: string;
  decision: ReviewDecision;
  /** False when the approvals read failed for this work: its status is unknown. */
  approvalReadable: boolean;
  /** Quantities from the action's details; null when the gardener left one empty. */
  quantities: Record<string, number | null>;
  quantityNote?: string;
  minutes: number | null;
  /** The named site its coarse location falls in; unset when no location was shared. */
  siteId?: string;
  feedback?: string;
  confidence?: "Low" | "Medium" | "High";
  method?: string;
  media: MediaKey;
  photoCount: number;
}

export interface ReportingWindow {
  id: string;
  kind: "season" | "campaign";
  name: string;
  start: DayKey;
  end: DayKey;
}

export interface PromiseItem {
  id: string;
  title: string;
  direction: "offer" | "ask";
  windowId: string;
  leadId: string;
  due: DayKey;
  doneOn?: DayKey;
  /** The action whose approved work the promise links, when it links any. */
  actionId?: string;
}

export interface SeasonMilestone {
  id: string;
  title: string;
  on: DayKey;
  kind: "assessment" | "check-in" | "report";
  /** Seasons hold no milestones today; these are the lab's proposal. */
  proposed: boolean;
}

export interface Baseline {
  title: string;
  createdOn: DayKey;
  authorId: string;
  diagnosis: string;
  outcome: string;
  metric: string;
  target: string;
  observation: string;
  observedOn: DayKey;
  method: string;
  outputMeasureId: string;
  evidenceActionId: string;
  evidenceSiteId?: string;
}

/** Proposed: a later observation measured against the baseline. */
export interface FollowUp {
  observedOn: DayKey;
  observation: string;
  method: string;
}

export type Asset = "DAI" | "WETH" | "USDC";

export interface LedgerEntry {
  id: string;
  on: number;
  account: "endowment" | "jar" | "plan";
  accountLabel: string;
  kind: "deposit" | "yield" | "top-up" | "claim" | "allocation";
  amount: number;
  asset: Asset;
  counterparty: string;
  note?: string;
  /** False when this entry could not be read; its amount then counts nowhere. */
  readable: boolean;
}

export interface ReportGarden {
  id: string;
  name: string;
  domainLabel: string;
  timeZone: string;
  utcOffsetMinutes: number;
  zoneLabel: string;
  /** The first day this garden could have records: earlier days are not zero, they are before it. */
  recordsBegin: DayKey;
  media: MediaKey;
  /** Accounts that report work. */
  accounts: ReportAccount[];
  /** Stewards, evaluators and funders the records name. */
  team: ReportAccount[];
  sites: ReportSite[];
  actions: ReportAction[];
  measures: MeasureDef[];
  windows: ReportingWindow[];
  promises: PromiseItem[];
  milestones: SeasonMilestone[];
  baseline: Baseline | null;
  followUp: FollowUp | null;
  ledger: LedgerEntry[];
}

export interface ReportDataset {
  garden: ReportGarden;
  /** Oldest first. */
  records: WorkRecord[];
  reference: number;
  /** Work older than this was not read: the shipped list holds the newest page only. */
  loadedFrom: number | null;
  /** How many records the garden holds, when the read could say; null when it cannot. */
  totalAvailable: number | null;
  state: "ready" | "loading" | "error";
}
