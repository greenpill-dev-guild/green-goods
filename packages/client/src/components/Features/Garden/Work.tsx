import { useGardenOfflineContent } from "@green-goods/shared/hooks/offline/useOfflineContent";
import { useNavigateToTop } from "@green-goods/shared/hooks/app/useNavigateToTop";
import type { Action, Work } from "@green-goods/shared/types/domain";
import { RiErrorWarningLine, RiInboxLine, RiLoader4Line, RiRefreshLine } from "@remixicon/react";
import React, { forwardRef, memo, type UIEvent, useCallback, useMemo } from "react";
import { useIntl } from "react-intl";
import { MinimalWorkCard } from "@/components/Cards";
import { EmptyState, Loader } from "@/components/Communication";

interface GardenWorkProps {
  actions: Action[];
  works: Work[];
  gardenId?: string;
  chainId?: number;
  readState?: {
    isError: boolean;
    isLoading: boolean;
    isPaused: boolean;
    availability: "available" | "partial" | "unavailable" | "empty";
    lastSuccessfulRefresh?: number;
  };
  workFetchStatus?: "pending" | "success" | "error";
  isFetching?: boolean;
  isOffline?: boolean;
  availability?: "available" | "partial" | "unavailable" | "empty";
  lastSuccessfulRefresh?: number;
  preparation?: {
    state: "unavailable" | "partial" | "ready" | "preparing";
    updatedAt?: number;
    workCount: number;
  };

  onRefresh?: () => void;
  handleScroll?: (event: UIEvent<HTMLUListElement>) => void;
}

interface WorkListProps {
  works: Work[];
  actions: Action[];
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

const WorkList = ({ works, actions }: WorkListProps) => {
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

  return sorted.map((_, index) => (
    <WorkListItem
      key={sorted[index].id}
      index={index}
      sorted={sorted}
      actionById={actionById}
      navigate={navigate}
    />
  ));
};

export const GardenWork = forwardRef<HTMLUListElement, GardenWorkProps>(
  (
    {
      works,
      actions,
      workFetchStatus: statusProp,
      isFetching,
      isOffline: offlineProp = false,
      availability: availabilityProp,
      lastSuccessfulRefresh: updatedProp,
      preparation: preparationProp,
      gardenId,
      chainId,
      readState,
      onRefresh,
      handleScroll,
    },
    ref
  ) => {
    const intl = useIntl();
    const workFetchStatus =
      statusProp ?? (readState?.isError ? "error" : readState?.isLoading ? "pending" : "success");
    const downloaded = useGardenOfflineContent(gardenId ?? "", chainId);
    const preparation = preparationProp ?? (gardenId ? downloaded : undefined);
    const isOffline = readState?.isPaused ?? offlineProp;
    const availability = readState?.availability ?? availabilityProp;
    const lastSuccessfulRefresh = readState?.lastSuccessfulRefresh ?? updatedProp;
    const hasRows = works.length > 0;
    const unavailable =
      isOffline && (availability === "unavailable" || (!availability && !hasRows));
    const isEmpty =
      workFetchStatus === "success" &&
      works.length === 0 &&
      (availability === "empty" || (availability === undefined && !isOffline));
    const hasError = !hasRows && !isOffline && workFetchStatus === "error";
    const isLoading = !hasRows && !isOffline && workFetchStatus === "pending";
    const updatedAt = preparation?.updatedAt ?? lastSuccessfulRefresh;
    const context = unavailable
      ? intl.formatMessage({
          id: "app.offline.workUnavailable",
          defaultMessage: "This garden’s work hasn’t been downloaded. Connect to load it.",
        })
      : preparation?.state === "partial" ||
          availability === "partial" ||
          (isOffline && hasRows && preparation?.state === "unavailable")
        ? intl.formatMessage({
            id: "app.offline.workPartial",
            defaultMessage: "Partially available offline. Some photos or details may be missing.",
          })
        : workFetchStatus === "error" && hasRows
          ? intl.formatMessage({
              id: "app.offline.refreshWarning",
              defaultMessage: "Couldn’t refresh. Showing saved work.",
            })
          : isOffline
            ? intl.formatMessage({
                id: "app.offline.savedWork",
                defaultMessage: "Offline · Showing saved work",
              })
            : preparation?.state === "ready"
              ? intl.formatMessage({
                  id: "app.offline.workReady",
                  defaultMessage: "Recent work is available offline",
                })
              : preparation?.state === "preparing"
                ? intl.formatMessage({
                    id: "app.offline.workPreparing",
                    defaultMessage: "Preparing recent work for offline use…",
                  })
                : null;

    return (
      <ul
        ref={ref}
        onScroll={handleScroll}
        className={
          !isEmpty && !hasError && !isLoading
            ? "grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 w-full"
            : "flex flex-col items-center justify-center w-full"
        }
      >
        {context && (
          <li className="col-span-full w-full text-sm text-text-sub-600" role="status">
            <p>{context}</p>
            {updatedAt && (
              <p>
                {intl.formatMessage(
                  { id: "app.offline.lastUpdated", defaultMessage: "Last updated {date}" },
                  { date: intl.formatDate(updatedAt, { dateStyle: "medium", timeStyle: "short" }) }
                )}
              </p>
            )}
          </li>
        )}
        {isLoading && (
          <li className="flex items-center justify-center p-8">
            <Loader />
          </li>
        )}

        {hasError && (
          <li>
            <EmptyState
              tone="error"
              icon={<RiErrorWarningLine />}
              title={intl.formatMessage({
                id: "app.garden.work.errorLoadingWorks",
                defaultMessage: "Error loading works",
              })}
              action={
                onRefresh && !isOffline ? (
                  <button
                    onClick={onRefresh}
                    disabled={isFetching}
                    className="flex items-center gap-2 rounded-[var(--radius-md)] bg-primary-action px-4 py-2 text-sm font-medium text-primary-action-foreground transition-colors duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)] hover:bg-primary-action-hover disabled:cursor-not-allowed disabled:opacity-50"
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
          </li>
        )}

        {isEmpty && (
          <li>
            <EmptyState
              icon={<RiInboxLine />}
              title={intl.formatMessage({
                id: "app.garden.work.noWork",
                defaultMessage: "No work yet, get started by submitting new work.",
              })}
              action={
                onRefresh && !isOffline ? (
                  <button
                    onClick={onRefresh}
                    disabled={isFetching}
                    className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-stroke-soft-200 px-3 py-1.5 text-xs font-medium text-text-sub-600 transition-colors duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)] hover:bg-bg-weak-50 disabled:cursor-not-allowed disabled:opacity-50"
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
          </li>
        )}

        {hasRows && <WorkList works={works} actions={actions} />}
      </ul>
    );
  }
);
