import { Button } from "@green-goods/shared/components/Button";
import { IconButton } from "@green-goods/shared/components/IconButton";
import type { Work } from "@green-goods/shared/types/domain";
import { RiErrorWarningLine, RiRefreshLine } from "@remixicon/react";
import React from "react";
import { type IntlShape, useIntl } from "react-intl";
import { MinimalWorkCard } from "@/components/Cards";
import { EmptyState, Loader } from "@/components/Communication";

/** A time for today's saves, a short date for older ones (matches the garden Work tab). */
function formatSavedAt(intl: IntlShape, timestamp: number): string {
  const saved = new Date(timestamp);
  return saved.toDateString() === new Date().toDateString()
    ? intl.formatTime(saved, { hour: "numeric", minute: "2-digit" })
    : intl.formatDate(saved, { month: "short", day: "numeric" });
}

interface WorkListMessages {
  itemCount: { id: string; defaultMessage: string };
  loading: { id: string; defaultMessage: string };
  emptyTitle: { id: string; defaultMessage: string };
  emptyDescription: { id: string; defaultMessage: string };
}

interface WorkListTabProps {
  items: Work[];
  isLoading: boolean;
  isFetching?: boolean;
  hasError: boolean;
  errorMessage?: string;
  onWorkClick: (work: Work) => void;
  onRefresh?: () => void;
  renderBadges?: (work: Work) => React.ReactNode[];
  headerContent?: React.ReactNode;
  messages: WorkListMessages;
  emptyIcon: React.ReactNode;
  /** Offline, the status line says when the rows on screen were saved and Refresh is hidden. */
  isOffline?: boolean;
  /** When the rows on screen were last read, in milliseconds. */
  savedAt?: number;
}

export const WorkListTab: React.FC<WorkListTabProps> = ({
  items,
  isLoading,
  isFetching,
  hasError,
  errorMessage,
  onWorkClick,
  onRefresh,
  renderBadges,
  headerContent,
  messages,
  emptyIcon,
  isOffline = false,
  savedAt,
}) => {
  const intl = useIntl();
  // The body already explains a failed load, so the status line stays quiet then.
  const statusText =
    isLoading || hasError
      ? null
      : isOffline && savedAt
        ? intl.formatMessage(
            { id: "app.workDashboard.offlineSaved", defaultMessage: "Offline · {when}" },
            { when: formatSavedAt(intl, savedAt) }
          )
        : items.length > 0
          ? intl.formatMessage(messages.itemCount, { count: items.length })
          : null;
  // Offline there is nothing to refresh, so neither the header nor the error state offers it.
  const canRefresh = Boolean(onRefresh) && !isOffline;
  const showRefresh = canRefresh && !isLoading && !hasError;

  return (
    <div className="min-h-full flex flex-col">
      {/* One row. The status line and Refresh keep their width; the filters condense first. */}
      <div className="mb-4 px-4 pt-4 flex items-center gap-2" data-testid="work-list-header">
        <div className="flex shrink-0 items-center gap-0.5">
          {statusText ? (
            <p
              role="status"
              className="whitespace-nowrap text-sm text-text-sub-600"
              title={statusText}
            >
              {statusText}
            </p>
          ) : null}
          {showRefresh ? (
            <IconButton
              className="shrink-0"
              size="compact"
              aria-label={intl.formatMessage(
                isFetching
                  ? { id: "app.common.refreshing", defaultMessage: "Refreshing..." }
                  : { id: "app.common.refresh", defaultMessage: "Refresh" }
              )}
              icon={<RiRefreshLine className="h-4 w-4" aria-hidden="true" />}
              loading={isFetching}
              onClick={onRefresh}
            />
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 justify-end">{headerContent}</div>
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4">
        {isLoading ? (
          <div className="flex flex-1 flex-col items-center justify-center pb-32">
            <Loader />
            <p className="text-sm text-text-soft-400 mt-4">
              {intl.formatMessage(messages.loading)}
            </p>
          </div>
        ) : hasError ? (
          <EmptyState
            className="flex-1"
            placement="sheet"
            icon={<RiErrorWarningLine />}
            tone="error"
            title={intl.formatMessage({
              id: "app.workDashboard.error.title",
              defaultMessage: "Unable to load work",
            })}
            description={
              errorMessage ||
              intl.formatMessage({
                id: "app.workDashboard.error.description",
                defaultMessage:
                  "There was an error loading your work. Please check your connection and try again.",
              })
            }
            action={
              canRefresh ? (
                <Button
                  type="button"
                  emphasis="secondary"
                  onClick={onRefresh}
                  loading={isFetching}
                  leadingIcon={<RiRefreshLine className="h-4 w-4" aria-hidden="true" />}
                >
                  {isFetching
                    ? intl.formatMessage({
                        id: "app.common.refreshing",
                        defaultMessage: "Refreshing...",
                      })
                    : intl.formatMessage({
                        id: "app.workDashboard.error.retry",
                        defaultMessage: "Retry",
                      })}
                </Button>
              ) : null
            }
          />
        ) : items.length === 0 ? (
          <EmptyState
            className="flex-1"
            placement="sheet"
            icon={emptyIcon}
            title={intl.formatMessage(messages.emptyTitle)}
            description={intl.formatMessage(messages.emptyDescription)}
          />
        ) : (
          <ul className="animate-stagger-in space-y-3">
            {items.map((work) => (
              <li key={work.id}>
                <MinimalWorkCard
                  work={work}
                  onClick={() => onWorkClick(work)}
                  badges={renderBadges?.(work)}
                  className="cv-work-card"
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
