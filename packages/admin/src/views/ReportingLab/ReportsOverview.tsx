/**
 * Garden reporting lab: the integrated overview. The calendar leads, review health sits
 * beside it on a wide screen and right after it on a phone, output trends follow, and the
 * other five reports are one list of rows rather than five more cards.
 */
import {
  RiArrowRightSLine,
  RiCalendarScheduleLine,
  RiFileSearchLine,
  RiGroupLine,
  RiMapPinLine,
  RiWallet3Line,
  type RemixiconComponentType,
} from "@remixicon/react";
import { useIntl } from "react-intl";
import { AdminCard, AdminCardBody, AdminCardHeader, AdminCardTitle } from "@/components/AdminCard";
import { AdminListRow } from "@/components/AdminListRow";
import { ActivityCalendar } from "./ActivityCalendar";
import { participation, placeSummary } from "./breakdowns";
import { dayKeyOf, monthOf } from "./dates";
import { fundingSummary, formatAmount } from "./funding";
import { VIEW_COPY } from "./labCopy";
import type { MediaSet, ReportDataset, WorkRecord } from "./model";
import { OutputTrends } from "./OutputTrends";
import type { RecordsRequest } from "./RecordsDialog";
import { ReviewHealthPanel } from "./ReviewHealthPanel";
import { referenceDay, periodEnd, type ReportScope, type ReportView } from "./scope";
import { reportWeeks } from "./aggregate";

interface ReportsOverviewProps {
  dataset: ReportDataset;
  scope: ReportScope;
  records: readonly WorkRecord[];
  media: MediaSet;
  onScopeChange: (patch: Partial<ReportScope>) => void;
  onOpenRecords: (request: RecordsRequest) => void;
  onLoadOlder?: () => void;
}

interface MoreReport {
  view: ReportView;
  icon: RemixiconComponentType;
  fact: string;
}

function moreReports(
  dataset: ReportDataset,
  scope: ReportScope,
  records: readonly WorkRecord[],
  locale: string
): MoreReport[] {
  const { garden } = dataset;
  const today = referenceDay(dataset);
  const inMonth = records.filter(
    (r) => monthOf(dayKeyOf(r.submittedAt, garden.timeZone)) === scope.month
  );
  const pastDue = garden.promises.filter((p) => !p.doneOn && p.due < today).length;
  const done = garden.promises.filter((p) => p.doneOn).length;
  const places = placeSummary(dataset, inMonth, dataset.reference);
  const people = participation(dataset, inMonth, reportWeeks(scope.month, dataset, 5));
  const funding = fundingSummary(garden, periodEnd(scope.month, dataset), scope.month);
  const jar = funding.assets.flatMap((a) =>
    a.accounts
      .filter((x) => x.account === "jar")
      .map((x) => formatAmount(x.balance, a.asset, locale))
  );
  return [
    {
      view: "season",
      icon: RiCalendarScheduleLine,
      fact:
        garden.promises.length === 0
          ? "No season or promises yet"
          : `${done} done, ${pastDue} past due, ${garden.promises.length - done - pastDue} open`,
    },
    {
      view: "places",
      icon: RiMapPinLine,
      fact:
        places.total === 0
          ? "No records this month"
          : `${Math.round((places.located / places.total) * 100)}% of this month's records have a location`,
    },
    {
      view: "people",
      icon: RiGroupLine,
      fact: `${people.sampledAccounts} reporting accounts this month`,
    },
    {
      view: "funding",
      icon: RiWallet3Line,
      fact:
        funding.assets.length === 0
          ? "No funding recorded"
          : `${funding.assets.length} ${funding.assets.length === 1 ? "asset" : "assets"}; cookie jar ${jar.join(", ") || "none"}`,
    },
    {
      view: "evidence",
      icon: RiFileSearchLine,
      fact: garden.baseline
        ? `Baseline: ${garden.baseline.observation}. Later observation: ${garden.followUp ? "illustrated, proposed" : "none"}`
        : "No baseline yet",
    },
  ];
}

export function ReportsOverview({
  dataset,
  scope,
  records,
  media,
  onScopeChange,
  onOpenRecords,
  onLoadOlder,
}: ReportsOverviewProps) {
  const { locale } = useIntl();
  const open = (view: ReportView) => onScopeChange({ view });
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(18rem,3fr)] xl:items-start"
      data-component="ReportsOverview"
    >
      <ActivityCalendar
        variant="overview"
        dataset={dataset}
        scope={scope}
        records={records}
        onScopeChange={onScopeChange}
        onOpenRecords={onOpenRecords}
        onLoadOlder={onLoadOlder}
      />
      <ReviewHealthPanel
        variant="summary"
        dataset={dataset}
        scope={scope}
        records={records}
        media={media}
        onOpenRecords={onOpenRecords}
        onOpenReport={() => open("review")}
      />
      <div className="xl:col-span-2">
        <OutputTrends
          variant="summary"
          dataset={dataset}
          scope={scope}
          records={records}
          onOpenRecords={onOpenRecords}
          onOpenReport={() => open("outputs")}
        />
      </div>
      <AdminCard density="none" className="xl:col-span-2">
        <AdminCardHeader>
          <AdminCardTitle as="h2">More Reports</AdminCardTitle>
        </AdminCardHeader>
        <AdminCardBody>
          <ul className="grid grid-cols-1 gap-(--gg-list-gap) sm:grid-cols-2 xl:grid-cols-3">
            {moreReports(dataset, scope, records, locale).map(({ view, icon: Icon, fact }) => (
              <li key={view} className="flex">
                <AdminListRow
                  onClick={() => open(view)}
                  className="flex h-full items-start gap-3 py-3"
                >
                  <span
                    aria-hidden
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-(--admin-radius-md) bg-bg-soft text-text-sub"
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="type-label font-semibold text-text-strong">
                      {VIEW_COPY[view].title}
                    </span>
                    <span className="type-meta text-text-sub">{VIEW_COPY[view].question}</span>
                    <span className="type-meta font-medium text-text-strong">{fact}</span>
                  </span>
                  <RiArrowRightSLine
                    aria-hidden
                    className="h-5 w-5 shrink-0 self-center text-text-soft"
                  />
                </AdminListRow>
              </li>
            ))}
          </ul>
        </AdminCardBody>
      </AdminCard>
    </div>
  );
}
