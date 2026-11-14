/**
 * Garden reporting lab: funding history. Each asset is summed on its own, an allocation
 * is a plan that moves no balance, and an entry that could not be read counts nowhere.
 * Nothing here converts between assets or links a payment to a piece of work.
 */
import { dayKeyOf, type MonthKey, monthOf } from "./dates";
import type { Asset, LedgerEntry, ReportGarden } from "./model";

/** Which way an entry moves money for its account. */
export function directionOf(entry: LedgerEntry): "in" | "out" | "none" {
  if (entry.kind === "claim") return "out";
  return entry.kind === "allocation" ? "none" : "in";
}

export interface BalancePoint {
  on: number;
  balance: number;
}

export interface AccountBalance {
  label: string;
  account: LedgerEntry["account"];
  balance: number;
  points: BalancePoint[];
}

export interface AssetSummary {
  asset: Asset;
  accounts: AccountBalance[];
  /** Money in and out of the asset's accounts during the month. */
  inflow: number;
  outflow: number;
  /** Planned during the month: not money moved. */
  allocated: number;
}

export interface FundingSummary {
  assets: AssetSummary[];
  /** Entries up to the moment, newest first. */
  entries: LedgerEntry[];
  unreadable: number;
}

export function fundingSummary(garden: ReportGarden, at: number, month: MonthKey): FundingSummary {
  const known = garden.ledger.filter((entry) => entry.on <= at).sort((a, b) => a.on - b.on);
  const readable = known.filter((entry) => entry.readable);
  const inMonth = (entry: LedgerEntry) => monthOf(dayKeyOf(entry.on, garden.timeZone)) === month;
  const assets = [...new Set(readable.map((entry) => entry.asset))];

  const summaries = assets.map((asset): AssetSummary => {
    const own = readable.filter((entry) => entry.asset === asset);
    const labels = [
      ...new Set(own.filter((entry) => entry.account !== "plan").map((e) => e.accountLabel)),
    ];
    const accounts = labels.map((label): AccountBalance => {
      let balance = 0;
      const points: BalancePoint[] = [];
      for (const entry of own) {
        if (entry.accountLabel !== label || entry.account === "plan") continue;
        balance += directionOf(entry) === "out" ? -entry.amount : entry.amount;
        points.push({ on: entry.on, balance });
      }
      const account = own.find((entry) => entry.accountLabel === label)?.account ?? "jar";
      return { label, account, balance, points };
    });
    const monthEntries = own.filter(inMonth);
    const total = (direction: "in" | "out") =>
      monthEntries
        .filter((entry) => entry.account !== "plan" && directionOf(entry) === direction)
        .reduce((sum, entry) => sum + entry.amount, 0);
    return {
      asset,
      accounts,
      inflow: total("in"),
      outflow: total("out"),
      allocated: monthEntries
        .filter((entry) => entry.kind === "allocation")
        .reduce((sum, entry) => sum + entry.amount, 0),
    };
  });

  return {
    assets: summaries,
    entries: [...known].reverse(),
    unreadable: known.length - readable.length,
  };
}

/** An amount with its asset, never a converted figure: "4.97 DAI", "0.4 WETH". */
export function formatAmount(amount: number, asset: Asset, locale: string) {
  const digits = asset === "WETH" ? 4 : 2;
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(amount);
  return `${formatted} ${asset}`;
}
