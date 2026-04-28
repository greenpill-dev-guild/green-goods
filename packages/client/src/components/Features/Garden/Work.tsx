import { type Action, useNavigateToTop, type Work } from "@green-goods/shared";
import { RiErrorWarningLine, RiInboxLine, RiLoader4Line, RiRefreshLine } from "@remixicon/react";
import React, { forwardRef, memo, type UIEvent, useCallback, useMemo } from "react";
import { useIntl } from "react-intl";
import { MinimalWorkCard } from "@/components/Cards";
import { EmptyState, Loader } from "@/components/Communication";

interface GardenWorkProps {
  actions: Action[];
  works: Work[];
  workFetchStatus: "pending" | "success" | "error";
  isFetching?: boolean;
  onRefresh?: () => void;
  handleScroll?: (event: UIEvent<HTMLUListElement>) => void;
}

interface WorkListProps {
  works: Work[];
  actions: Action[];
  workFetchStatus: "pending" | "success" | "error";
}

interface WorkListItemProps {
  index: number;
  style?: React.CSSProperties;
  sorted: Work[];
  actionById: Map<string, Action>;
  navigate: (path: string, options?: { state?: unknown }) => void;
}

const WorkListItem = memo(function WorkListItem({
  index,
  style,
  sorted,
  actionById,
  navigate,
}: WorkListItemProps) {
  const work = sorted[index];
  const action = actionById.get(String(work.actionUID));
  const title = action?.title ?? `Action ${work.actionUID}`;
  const onOpen = useCallback(
    () =>
      navigate(`/home/${work.gardenAddress}/work/${work.id}`, {
        state: {
          from: "garden",
          returnTo: `/home/${work.gardenAddress}`,
        },
      }),
    [navigate, work.gardenAddress, work.id]
  );
  return (
    <li style={style} className="cv-work-card">
      <MinimalWorkCard
        onClick={onOpen}
        work={work as unknown as Work}
        actionTitle={title}
        variant="detailed"
      />
    </li>
  );
});

const WorkList = ({ works, actions, workFetchStatus }: WorkListProps) => {
  const intl = useIntl();
  const navigate = useNavigateToTop();

  const actionById = useMemo(() => {
    const map = new Map<string, Action>();
    for (const a of actions) {
      const idPart = String(a.id).split("-").pop();
      if (idPart) map.set(idPart, a);
    }
    return map;
  }, [actions]);
  const sorted = useMemo(() => {
    return [...works].sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      return b.createdAt - a.createdAt;
    });
  }, [works]);

  switch (workFetchStatus) {
    case "pending":
      return (
        <div className="grid gap-3">
          {[...Array(8)].map((_, i) => (
            <li key={i}>
              <div className="flex flex-col gap-2 rounded-lg border border-stroke-soft-200 p-3 bg-bg-white-0">
                <div className="h-4 w-40 bg-bg-soft-200 rounded animate-pulse" />
                <div className="h-3 w-64 bg-bg-soft-200 rounded animate-pulse" />
              </div>
            </li>
          ))}
        </div>
      );
    case "success": {
      if (!sorted.length) {
        return (
          <EmptyState
            icon={<RiInboxLine />}
            title={intl.formatMessage({
              id: "app.garden.work.noWork",
              description: "No work yet",
            })}
          />
        );
      }

      return (
        <>
          {sorted.map((_, i) => (
            <WorkListItem
              key={sorted[i].id}
              index={i}
              sorted={sorted}
              actionById={actionById}
              navigate={navigate}
            />
          ))}
        </>
      );
    }
    case "error":
      return (
        <EmptyState
          tone="error"
          icon={<RiErrorWarningLine />}
          title={intl.formatMessage({
            id: "app.garden.work.errorLoadingWorks",
            description: "Error loading works",
          })}
        />
      );
  }

  return null;
};

export const GardenWork = forwardRef<HTMLUListElement, GardenWorkProps>(
  ({ works, actions, workFetchStatus, isFetching, onRefresh, handleScroll }, ref) => {
    const intl = useIntl();
    const isEmpty = workFetchStatus === "success" && works.length === 0;
    const hasError = workFetchStatus === "error";
    const isLoading = workFetchStatus === "pending";

    return (
      <ul
        ref={ref}
        onScroll={handleScroll}
        className={
          !isEmpty && !hasError && !isLoading
            ? "grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 w-full"
            : "flex items-center justify-center w-full"
        }
      >
        {isLoading && (
          <div className="flex items-center justify-center p-8">
            <Loader />
          </div>
        )}

        {hasError && (
          <EmptyState
            tone="error"
            icon={<RiErrorWarningLine />}
            title={intl.formatMessage({
              id: "app.garden.work.errorLoadingWorks",
              defaultMessage: "Failed to load work submissions",
            })}
            action={
              onRefresh ? (
                <button
                  onClick={onRefresh}
                  disabled={isFetching}
                  className="flex items-center gap-2 rounded-[var(--radius-md)] bg-primary-action px-4 py-2 text-sm font-medium text-primary-action-foreground transition-colors hover:bg-primary-action-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isFetching ? (
                    <>
                      <RiLoader4Line className="w-4 h-4 animate-spin" />
                      {intl.formatMessage({
                        id: "app.common.refreshing",
                        defaultMessage: "Refreshing...",
                      })}
                    </>
                  ) : (
                    <>
                      <RiRefreshLine className="h-4 w-4" />
                      {intl.formatMessage({
                        id: "app.common.tryAgain",
                        defaultMessage: "Try Again",
                      })}
                    </>
                  )}
                </button>
              ) : null
            }
          />
        )}

        {isEmpty && (
          <EmptyState
            icon={<RiInboxLine />}
            title={intl.formatMessage({
              id: "app.garden.work.noWork",
              defaultMessage: "No work submissions yet",
            })}
            action={
              onRefresh ? (
                <button
                  onClick={onRefresh}
                  disabled={isFetching}
                  className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-stroke-soft-200 px-3 py-1.5 text-xs font-medium text-text-sub-600 transition-colors hover:bg-bg-weak-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isFetching ? (
                    <>
                      <RiLoader4Line className="w-3 h-3 animate-spin" />
                      {intl.formatMessage({
                        id: "app.common.refreshing",
                        defaultMessage: "Refreshing...",
                      })}
                    </>
                  ) : (
                    <>
                      <RiRefreshLine className="h-3.5 w-3.5" />
                      {intl.formatMessage({
                        id: "app.common.refresh",
                        defaultMessage: "Refresh",
                      })}
                    </>
                  )}
                </button>
              ) : null
            }
          />
        )}

        {!isLoading && !hasError && !isEmpty && (
          <WorkList works={works} actions={actions} workFetchStatus={workFetchStatus} />
        )}
      </ul>
    );
  }
);
