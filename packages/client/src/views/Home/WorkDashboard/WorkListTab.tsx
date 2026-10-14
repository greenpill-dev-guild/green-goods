import { Button } from "@green-goods/shared/components/Button";
import { IconButton } from "@green-goods/shared/components/IconButton";
import type { Work } from "@green-goods/shared/types/domain";
import { RiErrorWarningLine, RiRefreshLine } from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";
import { MinimalWorkCard } from "@/components/Cards";
import { formatSavedAt } from "@/components/Communication/Offline/formatSavedAt";
import type { WorkCardPresentation } from "@/components/Cards/Work/WorkCard";
import { EmptyState, Loader } from "@/components/Communication";

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
  renderPresentation?: (work: Work) => WorkCardPresentation;
  headerActions?: React.ReactNode;
  headerContent?: React.ReactNode;
  messages: WorkListMessages;
  emptyIcon: React.ReactNode;
  /** Offline, the status line says when the rows on screen were saved and Refresh is hidden. */
  isOffline?: boolean;
  /** When the rows on screen were last read, in milliseconds. */
  savedAt?: number;
}

interface WorkListHeaderProps {
  /** The count or offline line; it never truncates (DL-032). */
  statusText?: string | null;
  /** Shows the compact Refresh beside the status line when set. */
  onRefresh?: () => void;
  isFetching?: boolean;
  refreshLabel?: string;
  /** Actions that sit with the status line, such as Upload all. */
  actions?: React.ReactNode;
  /** Filters, right-aligned; they give way before the status line does. */
  children?: React.ReactNode;
}

/**
 * The one header row every Work Dashboard tab shares: status line and compact
 * Refresh on the left, filters on the right (DL-032). The row keeps the height
 * of a tab that has a filter, so a tab without one (Drafts) starts its list at
 * the same place, and it never shrinks when the list below it scrolls.
 *
 * An action (Upload all) sits beside Refresh at normal phone sizes.
 * When the row is short of room the filters give way first, down to their 4rem
 * minimum; only then does the action's label truncate. The status line never
 * truncates. At narrow widths or enlarged text, controls wrap into additional
 * rows so actions remain readable and reachable.
 */
export const WorkListHeader: React.FC<WorkListHeaderProps> = ({
  statusText,
  onRefresh,
  isFetching,
  refreshLabel,
  actions,
  children,
}) => {
  const intl = useIntl();
  return (
    <div className="@container shrink-0">
      <div
        className="mb-4 flex min-h-14 shrink-0 items-center gap-2 px-4 pt-4 @max-[20rem]:flex-wrap"
        data-testid="work-list-header"
      >
        <div
          className={
            actions
              ? // Leaves the filter its 4rem minimum and the 0.5rem gap.
                "flex min-w-0 max-w-[calc(100%-4.5rem)] shrink-0 items-center gap-0.5 @max-[20rem]:w-full @max-[20rem]:max-w-full @max-[20rem]:flex-wrap @max-[20rem]:[&>button]:shrink-0"
              : "flex shrink-0 items-center gap-0.5 @max-[20rem]:w-full @max-[20rem]:flex-wrap"
          }
          data-testid="work-list-actions"
        >
          {statusText ? (
            <p
              role="status"
              className="shrink-0 whitespace-nowrap text-sm text-text-sub-600 @max-[20rem]:shrink @max-[20rem]:whitespace-normal"
              title={statusText}
            >
              {statusText}
            </p>
          ) : null}
          {onRefresh ? (
            <IconButton
              className="shrink-0"
              size="compact"
              aria-label={
                isFetching
                  ? intl.formatMessage({
                      id: "app.common.refreshing",
                      defaultMessage: "Refreshing...",
                    })
                  : (refreshLabel ??
                    intl.formatMessage({ id: "app.common.refresh", defaultMessage: "Refresh" }))
              }
              icon={<RiRefreshLine className="h-4 w-4" aria-hidden="true" />}
              loading={isFetching}
              onClick={onRefresh}
            />
          ) : null}
          {actions}
        </div>
        <div className="flex min-w-0 flex-1 justify-end">{children}</div>
      </div>
    </div>
  );
};

export const WorkListTab: React.FC<WorkListTabProps> = ({
  items,
  isLoading,
  isFetching,
  hasError,
  errorMessage,
  onWorkClick,
  onRefresh,
  renderPresentation,
  headerActions,
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
            { id: "app.offline.savedAt", defaultMessage: "Offline · {when}" },
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
      <WorkListHeader
        statusText={statusText}
        onRefresh={showRefresh ? onRefresh : undefined}
        isFetching={isFetching}
        actions={headerActions}
      >
        {headerContent}
      </WorkListHeader>

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
                  presentation={renderPresentation?.(work)}
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
