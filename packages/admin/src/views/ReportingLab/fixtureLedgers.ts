/**
 * Garden reporting lab: the two synthetic gardens' funding records.
 *
 * Every amount keeps its asset. Nothing converts one asset into another, no record links
 * a payment to a piece of work, and an allocation is a plan that moves nothing.
 */
import { type DayKey, instantAt } from "./dates";
import type { Asset, LedgerEntry } from "./model";

type LedgerRow = readonly [
  id: string,
  day: DayKey,
  account: LedgerEntry["account"],
  kind: LedgerEntry["kind"],
  amount: number,
  asset: Asset,
  counterparty: string,
  note?: string,
];

const PRINCIPAL = "Principal stays in the vault; the funder holds its shares.";
const SPLIT =
  "The jar's share of the vault's harvest. The rest went to impact certificate purchases and the protocol treasury.";
const PLAN = "A plan, not a payment: the jar's balance does not change.";
const DIRECT = "Deposited straight into the cookie jar.";

function toEntries(rows: readonly LedgerRow[], utcOffsetMinutes: number): LedgerEntry[] {
  return rows.map(([id, day, account, kind, amount, asset, counterparty, note]) => ({
    id,
    on: instantAt(day, 11, 20, utcOffsetMinutes),
    account,
    accountLabel: account === "endowment" ? `Endowment (${asset} vault)` : `Cookie jar (${asset})`,
    kind,
    amount,
    asset,
    counterparty,
    note,
    readable: true,
  }));
}

const COMPOST_ROWS: readonly LedgerRow[] = [
  ["c-e1", "2025-10-03", "endowment", "deposit", 2000, "DAI", "funder.alder", PRINCIPAL],
  ["c-j1", "2025-10-06", "jar", "top-up", 150, "DAI", "funder.alder", DIRECT],
  ["c-j2", "2025-10-20", "jar", "claim", 25, "DAI", "kestrel"],
  ["c-j3", "2025-10-31", "jar", "yield", 4.97, "DAI", "DAI vault yield", SPLIT],
  ["c-e2", "2025-11-02", "endowment", "deposit", 0.4, "WETH", "funder.cedar", "No harvest yet."],
  ["c-j4", "2025-11-03", "jar", "claim", 20, "DAI", "juniper"],
  ["c-e3", "2025-11-18", "endowment", "deposit", 500, "DAI", "funder.birch", PRINCIPAL],
  ["c-j5", "2025-11-24", "jar", "claim", 25, "DAI", "marigold"],
  ["c-j6", "2025-11-30", "jar", "yield", 5.4, "DAI", "DAI vault yield", SPLIT],
  ["c-p1", "2025-12-01", "plan", "allocation", 100, "DAI", "Holiday Market Campaign", PLAN],
  ["c-j7", "2025-12-02", "jar", "top-up", 100, "DAI", "funder.birch", DIRECT],
  ["c-j8", "2025-12-15", "jar", "claim", 25, "DAI", "kestrel"],
  ["c-j9", "2025-12-22", "jar", "claim", 20, "DAI", "heron"],
  ["c-j10", "2025-12-31", "jar", "yield", 6.12, "DAI", "DAI vault yield", SPLIT],
  ["c-j11", "2026-01-05", "jar", "claim", 25, "DAI", "tamarind"],
  ["c-j12", "2026-01-09", "jar", "claim", 20, "DAI", "fennel"],
];

const LEARNING_ROWS: readonly LedgerRow[] = [
  ["l-j1", "2025-09-20", "jar", "top-up", 300, "USDC", "funder.elder", DIRECT],
  ["l-j2", "2025-10-10", "jar", "claim", 15, "USDC", "facilitator.wren"],
  ["l-j3", "2025-11-07", "jar", "claim", 15, "USDC", "facilitator.sage"],
  ["l-j4", "2025-12-12", "jar", "claim", 20, "USDC", "facilitator.moss"],
  ["l-p1", "2026-01-12", "plan", "allocation", 120, "USDC", "Term 2 materials", PLAN],
  ["l-j5", "2026-01-14", "jar", "claim", 12.5, "USDC", "facilitator.wren"],
];

export function compostLedger(utcOffsetMinutes: number) {
  return toEntries(COMPOST_ROWS, utcOffsetMinutes);
}

export function learningLedger(utcOffsetMinutes: number) {
  return toEntries(LEARNING_ROWS, utcOffsetMinutes);
}
