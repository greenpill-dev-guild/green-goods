import { Button } from "@green-goods/shared/components/Button";
import type { Work } from "@green-goods/shared/types/domain";
import { RiErrorWarningLine, RiRefreshLine } from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";
import { MinimalWorkCard } from "@/components/Cards";
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
  renderBadges?: (work: Work) => React.ReactNode[];
  headerContent?: React.ReactNode;
  messages: WorkListMessages;
  emptyIcon: React.ReactNode;
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
}) => {
  const intl = useIntl();

  return (
    <div className="min-h-full flex flex-col">
      <div className="mb-4 px-4 pt-4 flex items-center justify-between gap-3">
        <div>
          {isLoading ? null : hasError ? (
            <p className="text-sm text-error-base">
              {intl.formatMessage({
                id: "app.workDashboard.error.fetchingData",
                defaultMessage: "Error loading data. Please try again.",
              })}
            </p>
          ) : items.length > 0 ? (
            <p className="text-sm text-text-sub-600">
              {intl.formatMessage(messages.itemCount, { count: items.length })}
            </p>
          ) : null}
        </div>
        {headerContent}
      </div>

      <div className="flex-1 px-4 pb-4">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center pb-12">
            <Loader />
            <p className="text-sm text-text-soft-400 mt-4">
              {intl.formatMessage(messages.loading)}
            </p>
          </div>
        ) : hasError ? (
          <EmptyState
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
              onRefresh ? (
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
            icon={emptyIcon}
            title={intl.formatMessage(messages.emptyTitle)}
            description={intl.formatMessage(messages.emptyDescription)}
            action={
              onRefresh ? (
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
                        id: "app.common.refresh",
                        defaultMessage: "Refresh",
                      })}
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="animate-stagger-in space-y-3">
            {items.map((work) => (
              <MinimalWorkCard
                key={work.id}
                work={work}
                onClick={() => onWorkClick(work)}
                badges={renderBadges?.(work)}
                className="cv-work-card"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
