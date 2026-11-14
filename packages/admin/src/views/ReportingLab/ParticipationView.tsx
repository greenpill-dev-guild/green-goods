/**
 * Garden reporting lab, interface 6: participation over time. Three counts never stand in
 * for each other: reporting accounts (who sent records), attendance written on records
 * (one learner at three sessions counts three times) and unique people, which no record
 * holds. Rows follow the directory's order, never the volume, so nothing ranks anyone.
 */
import { StatTile } from "@green-goods/shared/components/Cards/StatTile";
import { useIntl } from "react-intl";
import { AdminCard, AdminCardBody, AdminCardHeader, AdminCardTitle } from "@/components/AdminCard";
import { reportWeeks } from "./aggregate";
import { participation } from "./breakdowns";
import { dayKeyOf, formatMonth, formatShortDay, monthOf } from "./dates";
import { formatNumber, weekTicks } from "./labCopy";
import type { ReportDataset, ViewerRole, WorkRecord } from "./model";
import type { ReportScope } from "./scope";
import { WeeklyBars } from "./WeeklyBars";

interface ParticipationViewProps {
  dataset: ReportDataset;
  scope: ReportScope;
  records: readonly WorkRecord[];
  role: ViewerRole;
}

export function ParticipationView({ dataset, scope, records, role }: ParticipationViewProps) {
  const { locale } = useIntl();
  const { garden } = dataset;
  const weeks = reportWeeks(scope.month, dataset);
  const people = participation(dataset, records, weeks);
  const inMonth = records.filter(
    (r) => monthOf(dayKeyOf(r.submittedAt, garden.timeZone)) === scope.month
  );
  const monthAccounts = new Set(inMonth.map((r) => r.accountId)).size;
  const devices = new Set(
    inMonth
      .map((r) => r.accountId)
      .filter((id) => garden.accounts.find((a) => a.id === id)?.kind === "shared-device")
  );
  const attendance = inMonth.reduce<number | null>((sum, r) => {
    const value = r.quantities.attendees ?? r.quantities.participants;
    return typeof value === "number" ? (sum ?? 0) + value : sum;
  }, null);
  const bands = [
    ...new Set(
      inMonth
        .map((r) => r.quantityNote)
        .filter((n): n is string => Boolean(n?.startsWith("Unique attendee")))
    ),
  ];
  const label = (day: string) => formatShortDay(day, locale);
  const memberDetail = role !== "funder";
  const ticks = weekTicks(
    weeks.map((week) => week.start),
    locale
  );

  return (
    <div className="flex flex-col gap-4 sm:gap-5" data-component="ParticipationView">
      <AdminCard density="none">
        <AdminCardHeader>
          <div className="min-w-0">
            <AdminCardTitle as="h2">{formatMonth(scope.month, locale)}</AdminCardTitle>
            <p className="mt-1 type-body text-text-sub">
              An account or a device is not a person, and attendance is not people.
            </p>
          </div>
        </AdminCardHeader>
        <AdminCardBody className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile
              label="Reporting accounts"
              value={formatNumber(monthAccounts, locale)}
              delta={
                devices.size > 0
                  ? `${devices.size} of them a shared device`
                  : "accounts that sent a record"
              }
            />
            <StatTile
              label="Attendance recorded"
              value={attendance === null ? "Not recorded" : formatNumber(attendance, locale)}
              delta={
                attendance === null ? "no action here counts attendance" : "attendances, not people"
              }
            />
            <StatTile
              label="Unique people"
              value="Not measured"
              delta={
                bands.length > 0
                  ? `Estimates on some records: ${bands.map((b) => b.replace("Unique attendee estimate: ", "")).join(", ")}`
                  : "records hold accounts and counts, not identities"
              }
            />
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <WeeklyBars
              title="Reporting Accounts by Week"
              primaryLabel="Accounts"
              secondaryLabel="Returning"
              points={people.perWeek.map((week) => ({
                key: week.week.start,
                ...ticks[people.perWeek.indexOf(week)],
                fullLabel: `Week of ${label(week.week.start)}`,
                primary: week.accounts,
                secondary: week.returning,
              }))}
              format={(value) => formatNumber(value, locale)}
              note="Returning: also sent a record in the four weeks before."
            />
            <WeeklyBars
              title="Attendance Recorded by Week"
              primaryLabel="Attendances"
              points={people.perWeek.map((week) => ({
                key: week.week.start,
                ...ticks[people.perWeek.indexOf(week)],
                fullLabel: `Week of ${label(week.week.start)}`,
                primary: week.attendance ?? 0,
                gap: week.attendance === null && week.accounts > 0 ? "Not recorded" : undefined,
              }))}
              format={(value) => formatNumber(value, locale)}
              note="Read from attendance and cleanup records; the same person can count in several weeks."
            />
          </div>
        </AdminCardBody>
      </AdminCard>

      <AdminCard density="none">
        <AdminCardHeader>
          <AdminCardTitle as="h2">Accounts by Week</AdminCardTitle>
        </AdminCardHeader>
        <AdminCardBody className="flex flex-col gap-4">
          {memberDetail ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] type-meta">
                  <caption className="sr-only">Records sent by each account, by week</caption>
                  <thead>
                    <tr className="border-b border-stroke-soft text-text-sub">
                      <th scope="col" className="py-2 pr-3 text-left font-medium">
                        Account
                      </th>
                      {weeks.map((week) => (
                        <th
                          key={week.start}
                          scope="col"
                          className="px-1 py-2 text-center font-medium"
                        >
                          {label(week.start)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {people.matrix.map(({ account, cells }) => (
                      <tr key={account.id} className="border-b border-stroke-soft last:border-0">
                        <th
                          scope="row"
                          className="max-w-[14rem] truncate py-1.5 pr-3 text-left font-medium text-text-strong"
                          title={account.name}
                        >
                          {account.name}
                          {account.kind === "shared-device" ? (
                            <span className="ml-1 font-normal text-text-soft">(shared device)</span>
                          ) : null}
                        </th>
                        {cells.map((count, index) => (
                          <td
                            key={weeks[index].start}
                            className="px-1 py-1.5 text-center tabular-nums"
                          >
                            {count === 0 ? (
                              <span className="text-text-disabled">
                                <span aria-hidden>·</span>
                                <span className="sr-only">none</span>
                              </span>
                            ) : (
                              <span className="inline-flex min-w-7 justify-center rounded-(--admin-radius-full) bg-bg-soft px-1.5 py-0.5 font-medium text-text-strong">
                                {count}
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="type-label font-semibold text-text-strong">Quiet for Three Weeks</h3>
                {people.quiet.length === 0 ? (
                  <p className="type-meta text-text-sub">
                    Everyone who reported in these weeks has reported recently.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1 type-body text-text-sub">
                    {people.quiet.map(({ account, lastDay }) => (
                      <li key={account.id}>
                        <span className="font-semibold text-text-strong">{account.name}</span>, last
                        record {lastDay ? label(lastDay) : "none"}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="type-meta text-text-soft">
                  For checking in, not for ranking: the list is by name and shows no totals.
                </p>
              </div>
            </>
          ) : (
            <p className="type-body text-text-sub">
              Account-level participation shows to stewards and evaluators. Funders see the totals
              above.
            </p>
          )}
        </AdminCardBody>
      </AdminCard>
    </div>
  );
}
