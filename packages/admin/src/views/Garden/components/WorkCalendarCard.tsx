/**
 * Garden › Activity's month calendar: every submission of a month on the day it was sent.
 * The card says which month it shows, steps between months, and tells a month still being
 * read, one that could not be read and one only partly read apart from a quiet month.
 */
import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { IconButton } from "@green-goods/shared/components/IconButton";
import { SkeletonText } from "@green-goods/shared/components/Skeleton";
import type { GardenWorkCalendar } from "@green-goods/shared/hooks/admin-ui/garden/useGardenWorkspaceController";
import { RiArrowLeftSLine, RiArrowRightSLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { AdminCard, AdminCardBody, AdminCardHeader, AdminCardTitle } from "@/components/AdminCard";
import { WorkCalendarGrid } from "./WorkCalendarGrid";
import { describeWorkCounts } from "./WorkCalendarMarks";

export function WorkCalendarCard({ calendar }: { calendar: GardenWorkCalendar }) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const monthLabel = intl.formatDate(calendar.monthDate, { month: "long", year: "numeric" });
  const zone =
    new Intl.DateTimeFormat(intl.locale, { timeZoneName: "short" })
      .formatToParts()
      .find((part) => part.type === "timeZoneName")?.value ?? "";
  const previousLabel = formatMessage({
    id: "hub.garden.calendar.previous",
    defaultMessage: "Previous Month",
  });
  const nextLabel = formatMessage({ id: "hub.garden.calendar.next", defaultMessage: "Next Month" });

  return (
    <AdminCard density="none" data-component="WorkCalendarCard">
      <AdminCardHeader className="flex-wrap gap-3">
        <div className="min-w-0">
          <AdminCardTitle as="h2" aria-live="polite">
            {monthLabel}
          </AdminCardTitle>
          <p className="mt-1 type-body text-text-sub">
            {calendar.state !== "ready"
              ? formatMessage({
                  id: "hub.garden.calendar.description",
                  defaultMessage: "Work submitted to this garden, by day.",
                })
              : calendar.counts.total === 0
                ? formatMessage({
                    id: "hub.garden.calendar.summaryEmpty",
                    defaultMessage: "Nothing submitted this month.",
                  })
                : formatMessage(
                    {
                      id: "hub.garden.calendar.summary",
                      defaultMessage: "{summary}, on {days, plural, one {# day} other {# days}}.",
                    },
                    {
                      // A cut month's totals are only a minimum.
                      summary: describeWorkCounts(calendar.counts, intl, !calendar.complete),
                      days: calendar.daysWithWork,
                    }
                  )}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {calendar.isCurrentMonth ? null : (
            <Button
              type="button"
              size="compact"
              emphasis="tertiary"
              onClick={calendar.showCurrentMonth}
            >
              {formatMessage({ id: "hub.garden.calendar.thisMonth", defaultMessage: "This Month" })}
            </Button>
          )}
          <IconButton
            type="button"
            emphasis="secondary"
            size="sm"
            aria-label={previousLabel}
            title={previousLabel}
            icon={<RiArrowLeftSLine />}
            onClick={calendar.showPreviousMonth}
          />
          <IconButton
            type="button"
            emphasis="secondary"
            size="sm"
            aria-label={nextLabel}
            title={nextLabel}
            icon={<RiArrowRightSLine />}
            disabled={calendar.isCurrentMonth}
            onClick={calendar.showNextMonth}
          />
        </div>
      </AdminCardHeader>
      <AdminCardBody className="flex flex-col gap-3">
        {calendar.state === "loading" ? (
          <div
            role="status"
            aria-label={formatMessage({
              id: "hub.garden.calendar.loading",
              defaultMessage: "Reading this month's work",
            })}
          >
            <SkeletonText lines={6} />
          </div>
        ) : calendar.state === "error" ? (
          <Alert
            variant="error"
            title={formatMessage({
              id: "hub.garden.calendar.error.title",
              defaultMessage: "This month could not be read",
            })}
          >
            <p>
              {formatMessage({
                id: "hub.garden.calendar.error.description",
                defaultMessage: "Nothing is shown, so no day reads as empty by mistake.",
              })}
            </p>
            <Button
              type="button"
              size="sm"
              emphasis="secondary"
              className="mt-2"
              onClick={() => void calendar.retry()}
            >
              {formatMessage({ id: "app.common.tryAgain", defaultMessage: "Try Again" })}
            </Button>
          </Alert>
        ) : calendar.state === "offline" ? (
          <Alert
            variant="info"
            title={formatMessage({
              id: "hub.garden.calendar.offline.title",
              defaultMessage: "You are offline",
            })}
          >
            {formatMessage({
              id: "hub.garden.calendar.offline.description",
              defaultMessage: "The calendar reads this month when you are back online.",
            })}
          </Alert>
        ) : (
          <>
            {/* A month read before going offline keeps its grid and says it is the last read. */}
            {calendar.stale ? (
              <Alert
                variant="info"
                title={formatMessage({
                  id: "hub.garden.calendar.offline.title",
                  defaultMessage: "You are offline",
                })}
              >
                {formatMessage({
                  id: "hub.garden.calendar.offline.description",
                  defaultMessage: "The calendar reads this month when you are back online.",
                })}
              </Alert>
            ) : null}
            {/* Online, a reread that failed keeps the last grid, says so and offers a retry. */}
            {calendar.refreshFailed ? (
              <Alert
                variant="warning"
                title={formatMessage({
                  id: "hub.garden.calendar.refreshFailed.title",
                  defaultMessage: "This month could not be refreshed",
                })}
              >
                <p>
                  {formatMessage({
                    id: "hub.garden.calendar.refreshFailed.description",
                    defaultMessage:
                      "The calendar shows the month as last read, so its statuses may have changed since.",
                  })}
                </p>
                <Button
                  type="button"
                  size="sm"
                  emphasis="secondary"
                  className="mt-2"
                  loading={calendar.isFetching}
                  onClick={() => void calendar.retry()}
                >
                  {formatMessage({ id: "app.common.tryAgain", defaultMessage: "Try Again" })}
                </Button>
              </Alert>
            ) : null}
            {calendar.complete ? null : (
              <Alert
                variant="warning"
                title={formatMessage({
                  id: "hub.garden.calendar.partial.title",
                  defaultMessage: "This month is only partly read",
                })}
              >
                {formatMessage({
                  id: "hub.garden.calendar.partial.description",
                  defaultMessage:
                    "It holds more work than the calendar reads at once, so its latest days and its totals are short.",
                })}
              </Alert>
            )}
            <WorkCalendarGrid calendar={calendar} monthLabel={monthLabel} />
            <p className="type-meta text-text-soft">
              {calendar.refreshFailed
                ? formatMessage(
                    {
                      id: "hub.garden.calendar.basisLastRead",
                      defaultMessage:
                        "Work counts on the day it was sent, by your device's clock ({zone}). Statuses are as last read.",
                    },
                    { zone }
                  )
                : calendar.stale
                  ? formatMessage(
                      {
                        id: "hub.garden.calendar.basisStale",
                        defaultMessage:
                          "Work counts on the day it was sent, by your device's clock ({zone}). Statuses are as last read, before you went offline.",
                      },
                      { zone }
                    )
                  : formatMessage(
                      {
                        id: "hub.garden.calendar.basis",
                        defaultMessage:
                          "Work counts on the day it was sent, by your device's clock ({zone}). Statuses are as they stand today.",
                      },
                      { zone }
                    )}
            </p>
          </>
        )}
      </AdminCardBody>
    </AdminCard>
  );
}
