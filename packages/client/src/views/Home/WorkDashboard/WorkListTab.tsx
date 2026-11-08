import { Button } from "@green-goods/shared/components/Button";
import type { Work } from "@green-goods/shared/types/domain";
import { RiErrorWarningLine, RiLoader4Line, RiRefreshLine } from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";
import { MinimalWorkCard } from "@/components/Cards";
import { SheetListHeader } from "@/components/Sheets/SheetListHeader";
import { formatSavedAt } from "@/components/Communication/Offline/formatSavedAt";
import type { WorkCardPresentation } from "@/components/Cards/Work/MinimalWorkCard";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";

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
  /** Draws each row instead of the work card, as To Review's review rows do. */
  renderRow?: (work: Work) => React.ReactNode;
  /** The list may stop short of all there is, so the status line names no number. */
  uncounted?: boolean;
  headerActions?: React.ReactNode;
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
  renderPresentation,
  renderRow,
  uncounted = false,
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
        : items.length > 0 && !uncounted
          ? intl.formatMessage(messages.itemCount, { count: items.length })
          : null;
  // Offline there is nothing to refresh, so neither the header nor the error state offers it.
  const canRefresh = Boolean(onRefresh) && !isOffline;
  const showRefresh = canRefresh && !isLoading && !hasError;

  return (
    <div className="min-h-full flex flex-col">
      <SheetListHeader
        statusText={statusText}
        onRefresh={showRefresh ? onRefresh : undefined}
        isFetching={isFetching}
        actions={headerActions}
      >
        {headerContent}
      </SheetListHeader>

      <div className="flex flex-1 flex-col px-4 pb-4">
        {isLoading ? (
          <EmptyState
            busy
            className="flex-1"
            placement="sheet"
            icon={<RiLoader4Line className="animate-spin motion-reduce:animate-none" />}
            title={intl.formatMessage(messages.loading)}
          />
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
          <ul className="animate-stagger-in flex flex-col gap-(--gg-list-gap)">
            {items.map((work) => (
              <li key={work.id}>
                {renderRow ? (
                  renderRow(work)
                ) : (
                  <MinimalWorkCard
                    work={work}
                    onClick={() => onWorkClick(work)}
                    presentation={renderPresentation?.(work)}
                    className="cv-work-card"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
