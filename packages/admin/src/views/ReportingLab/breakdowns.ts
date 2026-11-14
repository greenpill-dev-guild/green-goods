/**
 * Garden reporting lab: breakdowns by action, by place and by person.
 *
 * People are counted the way the records allow: reporting accounts, attendance written
 * on a record, and nothing more. A shared device is never one person, and no list here
 * ranks anyone.
 */
import {
  countStatuses,
  measureValue,
  recordsInWeek,
  type StatusCounts,
  statusAt,
  type WeekRange,
} from "./aggregate";
import { addDays, dayKeyOf } from "./dates";
import type {
  MeasureDef,
  ReportAccount,
  ReportAction,
  ReportDataset,
  ReportSite,
  WorkRecord,
} from "./model";

export interface ActionRow {
  action: ReportAction;
  counts: StatusCounts;
  measure?: MeasureDef;
  reported: number;
  approved: number;
  missing: number;
  /** Why the action's quantity is not summed, when it is not. */
  unitNote?: string;
}

export function actionBreakdown(
  dataset: ReportDataset,
  records: readonly WorkRecord[]
): ActionRow[] {
  const { actions, measures } = dataset.garden;
  return actions.map((action) => {
    const own = records.filter((record) => record.actionId === action.id);
    const measure = measures.find((item) => item.actionId === action.id);
    let reported = 0;
    let approved = 0;
    let missing = 0;
    for (const record of measure ? own : []) {
      const value = measureValue(record, measure as MeasureDef);
      if (value === null) missing += 1;
      else {
        reported += value;
        if (statusAt(record, dataset.reference) === "approved") approved += value;
      }
    }
    return {
      action,
      counts: countStatuses(own, dataset.reference),
      measure,
      reported,
      approved,
      missing,
      unitNote: measure ? undefined : own.find((record) => record.quantityNote)?.quantityNote,
    };
  });
}

export interface SiteRow {
  site: ReportSite;
  records: WorkRecord[];
  counts: StatusCounts;
}

export function placeSummary(dataset: ReportDataset, records: readonly WorkRecord[], at: number) {
  const sites: SiteRow[] = dataset.garden.sites.map((site) => {
    const own = records.filter((record) => record.siteId === site.id);
    return { site, records: own, counts: countStatuses(own, at) };
  });
  const unlocated = records.filter((record) => record.siteId === undefined);
  return {
    sites,
    unlocated: { records: unlocated, counts: countStatuses(unlocated, at) },
    located: records.length - unlocated.length,
    total: records.length,
  };
}

export interface WeekPeople {
  week: WeekRange;
  /** Accounts that sent at least one record this week. */
  accounts: number;
  /** Of those, accounts that also sent one in the four weeks before. */
  returning: number;
  sharedDevices: number;
  /** Attendance written on records (one learner at three sessions counts three times). */
  attendance: number | null;
}

const ATTENDANCE_KEYS = ["attendees", "participants"] as const;

function attendanceOf(records: readonly WorkRecord[]): number | null {
  let total: number | null = null;
  for (const record of records) {
    for (const key of ATTENDANCE_KEYS) {
      const value = record.quantities[key];
      if (typeof value === "number") total = (total ?? 0) + value;
    }
  }
  return total;
}

export function participation(
  dataset: ReportDataset,
  records: readonly WorkRecord[],
  weeks: readonly WeekRange[]
) {
  const { accounts } = dataset.garden;
  const deviceIds = new Set(accounts.filter((a) => a.kind === "shared-device").map((a) => a.id));
  const accountsIn = (from: string, to: string) =>
    new Set(
      recordsInWeek(dataset.records, { start: from, end: to }, dataset).map((r) => r.accountId)
    );

  const perWeek: WeekPeople[] = weeks.map((week) => {
    const inWeek = recordsInWeek(records, week, dataset);
    const ids = new Set(inWeek.map((record) => record.accountId));
    const before = accountsIn(addDays(week.start, -28), addDays(week.start, -1));
    return {
      week,
      accounts: ids.size,
      returning: [...ids].filter((id) => before.has(id)).length,
      sharedDevices: [...ids].filter((id) => deviceIds.has(id)).length,
      attendance: attendanceOf(inWeek),
    };
  });

  // Rows keep the directory's order (people by name, shared devices last): never by volume.
  const ordered: ReportAccount[] = [
    ...accounts.filter((a) => a.kind === "person").sort((a, b) => a.name.localeCompare(b.name)),
    ...accounts.filter((a) => a.kind === "shared-device"),
  ];
  const matrix = ordered.map((account) => ({
    account,
    cells: weeks.map(
      (week) =>
        recordsInWeek(records, week, dataset).filter((r) => r.accountId === account.id).length
    ),
  }));

  const recentStart = weeks[Math.max(0, weeks.length - 3)]?.start ?? "";
  const quiet = matrix
    .filter((row) => row.account.kind === "person")
    .map((row) => {
      const own = records.filter((record) => record.accountId === row.account.id);
      const last = own.length > 0 ? own[own.length - 1] : undefined;
      return {
        account: row.account,
        lastDay: last ? dayKeyOf(last.submittedAt, dataset.garden.timeZone) : null,
      };
    })
    .filter((row) => row.lastDay !== null && row.lastDay < recentStart);

  return { perWeek, matrix, quiet, sampledAccounts: new Set(records.map((r) => r.accountId)).size };
}
