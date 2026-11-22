/**
 * Garden › Health's Review Health: whether review is keeping pace with what gardeners send.
 * How much waits now and how long the oldest has waited, then the last eight weeks of
 * submitted against reviewed, as a chart and as a table. Every number opens the records behind
 * it. Age is information, never an alarm (DL-044): nothing here takes a warning colour.
 */
import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { StatTile } from "@green-goods/shared/components/Cards/StatTile";
import { SkeletonText } from "@green-goods/shared/components/Skeleton";
import type {
  GardenReviewHealth,
  ReviewHealthWeek,
} from "@green-goods/shared/hooks/admin-ui/garden/useGardenWorkspaceController";
import { adminRoutes } from "@green-goods/shared/utils/navigation/admin-routes";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { AdminCard, AdminCardBody, AdminCardHeader, AdminCardTitle } from "@/components/AdminCard";
import { ReviewWeekDialog } from "./ReviewWeekDialog";

const DAY_MS = 24 * 60 * 60 * 1000;
/** A link around a number: the row's ink layer on hover and the focus ring, never a lift. */
const NUMBER_LINK_CLASS =
  "block rounded-(--gg-row-radius) p-2 -m-2 hover:bg-bg-weak focus-visible:outline-2 focus-visible:outline-(--tone-focus-ring)";

export interface ReviewHealthWaiting {
  pendingCount: number;
  /** When the oldest pending work was sent (ms); null when nothing waits. */
  oldestPendingAt: number | null;
  /** False past the garden queue read's limit: the count is a minimum. */
  complete: boolean;
}

function WeekCount({ count, complete }: { count: number; complete: boolean }) {
  return (
    <>
      {count}
      {complete ? "" : "+"}
    </>
  );
}

export function ReviewHealthCard({
  health,
  waiting,
  gardenId,
}: {
  health: GardenReviewHealth;
  waiting: ReviewHealthWaiting;
  gardenId: string;
}) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const weekLabel = (week: ReviewHealthWeek) =>
    intl.formatDate(week.start, { month: "short", day: "numeric" });
  // A phone's column is about 35px wide, so the chart's own labels are numeric.
  const shortWeekLabel = (week: ReviewHealthWeek) =>
    intl.formatDate(week.start, { month: "numeric", day: "numeric" });
  // The week under way says so, so its low count does not read as review slowing down.
  const namedWeek = (week: ReviewHealthWeek) =>
    week.isCurrent
      ? formatMessage({ id: "hub.garden.reviewHealth.soFar" }, { week: weekLabel(week) })
      : weekLabel(week);
  const countArgs = (week: ReviewHealthWeek) => ({
    week: namedWeek(week),
    submitted: week.submitted.length,
    submittedPlus: week.submittedComplete ? "no" : "yes",
    reviewed: week.reviewed.length,
    reviewedPlus: week.reviewedComplete ? "no" : "yes",
  });
  const countLabel = (week: ReviewHealthWeek, list: "submitted" | "reviewed") =>
    list === "submitted"
      ? formatMessage(
          {
            id: "hub.garden.reviewHealth.submittedCount",
          },
          countArgs(week)
        )
      : formatMessage(
          {
            id: "hub.garden.reviewHealth.reviewedCount",
          },
          countArgs(week)
        );
  const columnLabel = (week: ReviewHealthWeek) =>
    formatMessage(
      {
        id: "hub.garden.reviewHealth.weekColumn",
      },
      countArgs(week)
    );
  const oldestDays =
    waiting.oldestPendingAt === null
      ? null
      : Math.floor((Date.now() - waiting.oldestPendingAt) / DAY_MS);
  const max = Math.max(
    1,
    ...health.weeks.flatMap((week) => [week.submitted.length, week.reviewed.length])
  );
  const anyPartial = health.weeks.some((week) => !week.submittedComplete || !week.reviewedComplete);

  return (
    <AdminCard density="none" data-component="ReviewHealthCard">
      <AdminCardHeader>
        <div className="min-w-0">
          <AdminCardTitle>{formatMessage({ id: "hub.garden.reviewHealth.title" })}</AdminCardTitle>
          <p className="mt-1 type-body text-text-sub">
            {formatMessage({ id: "hub.garden.reviewHealth.description" })}
          </p>
        </div>
      </AdminCardHeader>
      <AdminCardBody className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link to={adminRoutes.reviewWork({ gardenId })} className={NUMBER_LINK_CLASS}>
            <StatTile
              label={formatMessage({ id: "hub.garden.reviewHealth.waitingNow" })}
              value={`${intl.formatNumber(waiting.pendingCount)}${waiting.complete ? "" : "+"}`}
            />
          </Link>
          <Link
            to={adminRoutes.reviewWork({ gardenId, sort: "oldest" })}
            className={NUMBER_LINK_CLASS}
          >
            <StatTile
              label={formatMessage({ id: "hub.garden.reviewHealth.oldestWaiting" })}
              value={
                oldestDays === null
                  ? formatMessage({
                      // Past the queue read's limit, none loaded is not none waiting.
                      id: waiting.complete
                        ? "hub.garden.reviewHealth.nothingWaiting"
                        : "hub.garden.reviewHealth.oldestUnknown",
                    })
                  : oldestDays < 1
                    ? formatMessage({ id: "app.garden.detail.metric.underADay" })
                    : formatMessage(
                        {
                          id: "hub.garden.reviewHealth.days",
                        },
                        // Past the queue read's limit the oldest known work is a minimum.
                        { count: oldestDays, plus: waiting.complete ? "no" : "yes" }
                      )
              }
            />
          </Link>
        </div>

        {health.state === "loading" ? (
          <div role="status" aria-label={formatMessage({ id: "hub.garden.reviewHealth.loading" })}>
            <SkeletonText lines={5} />
          </div>
        ) : health.state === "error" ? (
          <Alert variant="error" title={formatMessage({ id: "hub.garden.reviewHealth.error" })}>
            <Button
              type="button"
              size="sm"
              emphasis="secondary"
              className="mt-2"
              onClick={() => void health.retry()}
            >
              {formatMessage({ id: "app.common.tryAgain" })}
            </Button>
          </Alert>
        ) : health.state === "offline" ? (
          <Alert variant="info" title={formatMessage({ id: "hub.garden.calendar.offline.title" })}>
            {formatMessage({ id: "hub.garden.reviewHealth.offline" })}
          </Alert>
        ) : (
          <>
            {health.stale ? (
              <Alert variant="info" title={formatMessage({ id: "hub.garden.reviewHealth.stale" })}>
                {formatMessage({ id: "hub.garden.reviewHealth.offline" })}
              </Alert>
            ) : null}
            <figure className="flex min-w-0 flex-col gap-2">
              <figcaption className="flex flex-wrap items-center justify-between gap-2">
                <span className="type-label text-text-strong">
                  {formatMessage({ id: "hub.garden.reviewHealth.chartTitle" })}
                </span>
                <span className="flex flex-wrap items-center gap-3 type-meta text-text-sub">
                  <span className="inline-flex items-center gap-1">
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 rounded-(--admin-radius-xs) bg-text-soft"
                    />
                    {formatMessage({ id: "hub.garden.reviewHealth.submitted" })}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 rounded-(--admin-radius-xs) bg-information-base"
                    />
                    {formatMessage({ id: "hub.garden.reviewHealth.reviewed" })}
                  </span>
                </span>
              </figcaption>
              {/* One tall link per week, the week's two bars drawn inside it, so a phone's
                  narrow column is still one easy target. The dialog switches between lists. */}
              <div className="grid h-36 grid-cols-8 gap-1">
                {health.weeks.map((week) => {
                  const partial = !week.submittedComplete || !week.reviewedComplete;
                  return (
                    <Link
                      key={week.start.getTime()}
                      to={health.weekHref(week, "submitted")}
                      aria-label={columnLabel(week)}
                      title={columnLabel(week)}
                      className={cn(
                        "flex h-full items-end justify-center gap-0.5 rounded-(--admin-radius-xs) hover:bg-bg-weak focus-visible:outline-2 focus-visible:outline-(--tone-focus-ring)",
                        partial && "border border-dashed border-stroke-strong",
                        week.isCurrent && "bg-bg-weak"
                      )}
                    >
                      {(["submitted", "reviewed"] as const).map((list) => {
                        const count = (list === "submitted" ? week.submitted : week.reviewed)
                          .length;
                        return (
                          <span
                            key={list}
                            aria-hidden
                            className={cn(
                              "w-2/5 rounded-t-(--admin-radius-xs)",
                              list === "submitted" ? "bg-text-soft" : "bg-information-base"
                            )}
                            style={{
                              height: `${count > 0 ? Math.max(4, (count / max) * 100) : 0}%`,
                            }}
                          />
                        );
                      })}
                    </Link>
                  );
                })}
              </div>
              <div className="grid grid-cols-8 gap-1" aria-hidden>
                {health.weeks.map((week) => (
                  <span
                    key={week.start.getTime()}
                    className={cn(
                      "truncate text-center type-meta-sm tabular-nums",
                      week.isCurrent ? "font-medium text-text-strong" : "text-text-sub"
                    )}
                  >
                    {shortWeekLabel(week)}
                  </span>
                ))}
              </div>
            </figure>
            <details className="type-meta">
              <summary className="cursor-pointer type-label text-text-strong">
                {formatMessage({ id: "hub.garden.reviewHealth.showTable" })}
              </summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[16rem]">
                  <caption className="sr-only">
                    {formatMessage({ id: "hub.garden.reviewHealth.chartTitle" })}
                  </caption>
                  <thead>
                    <tr className="border-b border-stroke-soft text-left text-text-sub">
                      <th scope="col" className="py-1 pr-3 font-medium">
                        {formatMessage({ id: "hub.garden.reviewHealth.week" })}
                      </th>
                      <th scope="col" className="py-1 pr-3 text-right font-medium">
                        {formatMessage({ id: "hub.garden.reviewHealth.submitted" })}
                      </th>
                      <th scope="col" className="py-1 text-right font-medium">
                        {formatMessage({ id: "hub.garden.reviewHealth.reviewed" })}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {health.weeks.map((week) => (
                      <tr
                        key={week.start.getTime()}
                        className="border-b border-stroke-soft last:border-0"
                      >
                        <th scope="row" className="py-1 pr-3 text-left font-normal text-text-sub">
                          {namedWeek(week)}
                        </th>
                        {(["submitted", "reviewed"] as const).map((list) => (
                          <td key={list} className="py-1 pr-3 text-right tabular-nums last:pr-0">
                            <Link
                              to={health.weekHref(week, list)}
                              aria-label={countLabel(week, list)}
                              className="text-text-strong underline underline-offset-4"
                            >
                              <WeekCount
                                count={
                                  (list === "submitted" ? week.submitted : week.reviewed).length
                                }
                                complete={
                                  list === "submitted"
                                    ? week.submittedComplete
                                    : week.reviewedComplete
                                }
                              />
                            </Link>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            <p className="type-meta text-text-soft">
              {formatMessage({ id: "hub.garden.reviewHealth.basis" })}
              {anyPartial ? ` ${formatMessage({ id: "hub.garden.reviewHealth.partial" })}` : null}
            </p>
          </>
        )}
      </AdminCardBody>
      <ReviewWeekDialog health={health} gardenId={gardenId} weekLabel={weekLabel} />
    </AdminCard>
  );
}
