import { Button } from "@green-goods/shared/components/Button";
import { useActiveOfflineGarden } from "@green-goods/shared/hooks/offline/useOfflineContent";
import { useNavigateToTop } from "@green-goods/shared/hooks/app/useNavigateToTop";
import type { Action, Work } from "@green-goods/shared/types/domain";
import { RiErrorWarningLine, RiInboxLine, RiRefreshLine } from "@remixicon/react";
import React, { forwardRef, memo, type UIEvent, useCallback, useMemo, useState } from "react";
import { type IntlShape, useIntl } from "react-intl";
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

  onRefresh?: () => void;
  handleScroll?: (event: UIEvent<HTMLUListElement>) => void;
}

/** Cards rendered at once; older work appears when asked for. */
const WORK_PAGE_SIZE = 50;

/** A time for today's saves, a short date for older ones. */
function formatSavedAt(intl: IntlShape, timestamp: number): string {
  const saved = new Date(timestamp);
  return saved.toDateString() === new Date().toDateString()
    ? intl.formatTime(saved, { hour: "numeric", minute: "2-digit" })
    : intl.formatDate(saved, { month: "short", day: "numeric" });
}

interface WorkListProps {
  works: Work[];
  actions: Action[];
  visibleCount: number;
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

const WorkList = ({ works, actions, visibleCount }: WorkListProps) => {
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
    return [...works]
      .sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (a.status !== "pending" && b.status === "pending") return 1;
        return b.createdAt - a.createdAt;
      })
      .slice(0, visibleCount);
  }, [works, visibleCount]);

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
      gardenId,
      readState,
      onRefresh,
      handleScroll,
    },
    ref
  ) => {
    const intl = useIntl();
    useActiveOfflineGarden(gardenId);
    const [page, setPage] = useState({ gardenId, count: WORK_PAGE_SIZE });
    const visibleCount = page.gardenId === gardenId ? page.count : WORK_PAGE_SIZE;
    const workFetchStatus =
      statusProp ?? (readState?.isError ? "error" : readState?.isLoading ? "pending" : "success");
    const isOffline = readState?.isPaused ?? offlineProp;
    const availability = readState?.availability ?? availabilityProp;
    const lastSuccessfulRefresh = readState?.lastSuccessfulRefresh ?? updatedProp;
    const hasRows = works.length > 0;
    const isEmpty =
      workFetchStatus === "success" &&
      works.length === 0 &&
      (availability === "empty" || (availability === undefined && !isOffline));
    const hasError = !hasRows && !isOffline && workFetchStatus === "error";
    const isLoading = !hasRows && !isOffline && workFetchStatus === "pending";
    const savedAt = lastSuccessfulRefresh ? formatSavedAt(intl, lastSuccessfulRefresh) : undefined;
    // Offline status belongs to Settings; the list only speaks when a copy is being
    // shown instead of live data, or when nothing was saved for this garden.
    const context = isOffline
      ? hasRows
        ? savedAt &&
          intl.formatMessage(
            { id: "app.offline.savedWork", defaultMessage: "Offline · Saved {when}" },
            { when: savedAt }
          )
        : availability === "empty"
          ? null
          : intl.formatMessage({
              id: "app.offline.workUnavailable",
              defaultMessage: "Not saved yet · Connect to load it",
            })
      : workFetchStatus === "error" && hasRows && savedAt
        ? intl.formatMessage(
            { id: "app.offline.refreshWarning", defaultMessage: "Couldn’t refresh · Saved {when}" },
            { when: savedAt }
          )
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
          <li className="col-span-full w-full min-w-0 text-sm text-text-sub-600" role="status">
            <p className="truncate" title={context}>
              {context}
            </p>
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
                  <Button
                    type="button"
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
                          id: "app.common.tryAgain",
                          defaultMessage: "Try Again",
                        })}
                  </Button>
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
          </li>
        )}

        {hasRows && <WorkList works={works} actions={actions} visibleCount={visibleCount} />}
        {works.length > visibleCount && (
          <li className="col-span-full flex justify-center">
            <Button
              type="button"
              emphasis="secondary"
              onClick={() => setPage({ gardenId, count: visibleCount + WORK_PAGE_SIZE })}
            >
              {intl.formatMessage({
                id: "app.garden.work.showOlder",
                defaultMessage: "Show older work",
              })}
            </Button>
          </li>
        )}
      </ul>
    );
  }
);
