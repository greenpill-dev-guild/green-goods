import { Button } from "@green-goods/shared/components/Button";
import { WorkCardSkeleton } from "@green-goods/shared/components/Cards/WorkCard/WorkCard";
import { NativeSelect } from "@green-goods/shared/components/Form/ControlPrimitives";
import { useNavigateToTop } from "@green-goods/shared/hooks/app/useNavigateToTop";
import { useActiveOfflineGarden } from "@green-goods/shared/hooks/offline/useOfflineContent";
import {
  type GardenWorkSort,
  useGardenWorkListView,
} from "@green-goods/shared/hooks/work/useGardenWorkListView";
import type { Action, Work } from "@green-goods/shared/types/domain";
import { RiErrorWarningLine, RiInboxLine, RiRefreshLine } from "@remixicon/react";
import React, { forwardRef, memo, type UIEvent, useCallback, useEffect } from "react";
import { useIntl } from "react-intl";
import { MinimalWorkCard } from "@/components/Cards";
import { EmptyState } from "@/components/Communication";
import { formatSavedAt } from "@/components/Communication/Offline/formatSavedAt";
import { PWA_SHEET_FOCAL_STATE_CLASSNAME } from "@/components/Pwa/sheetScrollStyles";
import { GardenListHeader, GardenListHeaderLoading } from "./GardenListHeader";

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
    hasOlderWork?: boolean;
    loadOlderWork?: () => void;
    isLoadingOlder?: boolean;
  };
  workFetchStatus?: "pending" | "success" | "error";
  isFetching?: boolean;
  isOffline?: boolean;
  availability?: "available" | "partial" | "unavailable" | "empty";
  lastSuccessfulRefresh?: number;

  onRefresh?: () => void;
  handleScroll?: (event: UIEvent<HTMLUListElement>) => void;
}

/** A phone shows about five cards; loading shows as many placeholders. */
const SKELETON_CARDS = 5;
const GRID = "grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 w-full";
const SORT_LABEL_IDS: Record<GardenWorkSort, string> = {
  pending: "app.garden.work.sort.pending",
  newest: "app.garden.work.sort.newest",
  oldest: "app.garden.work.sort.oldest",
};
const SORT_ORDER: GardenWorkSort[] = ["pending", "newest", "oldest"];

interface WorkListProps {
  sorted: Work[];
  actionById: Map<string, Action>;
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
        actionTitle={action?.title}
        variant="detailed"
      />
    </li>
  );
});

const WorkList = ({ sorted, actionById }: WorkListProps) => {
  const navigate = useNavigateToTop();
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
      : null;

    // Type and Sort narrow and order the list (D31); Pending is today's order.
    const view = useGardenWorkListView(works, actions);
    const typeAllLabel = intl.formatMessage({ id: "app.garden.work.type.all" });
    const sortLabel = (sort: GardenWorkSort) => intl.formatMessage({ id: SORT_LABEL_IDS[sort] });
    // Oldest first needs the garden's whole history, since its oldest work is on
    // the last page: the rest is read before the list is shown in that order.
    const loadOlderWork = readState?.loadOlderWork;
    const readsHistory =
      view.sort === "oldest" &&
      hasRows &&
      !isOffline &&
      Boolean(readState?.hasOlderWork && loadOlderWork);
    const isLoadingOlder = Boolean(readState?.isLoadingOlder);
    useEffect(() => {
      if (readsHistory && !isLoadingOlder) loadOlderWork?.();
    }, [readsHistory, isLoadingOlder, loadOlderWork]);
    // While a saved copy stands in for live data, its line takes the count's place.
    // The count is the bare number, so the filters beside it have room; screen
    // readers still hear what it counts.
    const countLine = intl.formatMessage(
      { id: "app.garden.work.count" },
      { count: view.works.length }
    );
    const status = readsHistory
      ? intl.formatMessage({ id: "app.garden.work.loading" })
      : (context ?? intl.formatNumber(view.works.length));
    const srStatus = readsHistory || context ? undefined : countLine;

    // Loading keeps the loaded layout (D28): the header row with the loading line
    // where the count lands and a placeholder where each filter goes, then cards
    // in the work card's own frame, so nothing moves when the list arrives.
    if (isLoading) {
      return (
        <div>
          <GardenListHeaderLoading
            label={intl.formatMessage({ id: "app.garden.work.loading" })}
            srLabel={intl.formatMessage({ id: "app.garden.work.loadingDetail" })}
            placeholders={[typeAllLabel, sortLabel("pending")]}
          />
          <ul
            ref={ref}
            onScroll={handleScroll}
            className={`${GRID} animate-pulse`}
            aria-hidden="true"
          >
            {Array.from({ length: SKELETON_CARDS }, (_, index) => (
              <li key={index}>
                <WorkCardSkeleton />
              </li>
            ))}
          </ul>
        </div>
      );
    }

    // Type appears only when the work here spans two or more actions.
    const filters = hasRows ? (
      <>
        {view.typeOptions.length > 0 ? (
          <NativeSelect
            aria-label={intl.formatMessage({ id: "app.garden.work.type.label" })}
            controlSize="compact"
            density="condensed"
            className="w-auto min-w-16 max-w-48 field-sizing-content"
            value={view.type}
            onChange={(event) => view.setType(event.target.value)}
          >
            <option value="all">{typeAllLabel}</option>
            {view.typeOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.title}
              </option>
            ))}
          </NativeSelect>
        ) : null}
        <NativeSelect
          aria-label={intl.formatMessage({ id: "app.garden.work.sort.label" })}
          controlSize="compact"
          density="condensed"
          className="w-auto min-w-16 max-w-48 field-sizing-content"
          value={view.sort}
          onChange={(event) => view.setSort(event.target.value as GardenWorkSort)}
        >
          {SORT_ORDER.map((sort) => (
            <option key={sort} value={sort}>
              {sortLabel(sort)}
            </option>
          ))}
        </NativeSelect>
      </>
    ) : null;

    // Full-tab states share the Pool tab's anchor (the focal region plus the
    // sheet placement), so switching tabs never moves the icon and title.
    return (
      <div>
        {hasRows || context ? (
          <GardenListHeader status={status} srStatus={srStatus} filters={filters} />
        ) : null}
        <ul
          ref={ref}
          onScroll={handleScroll}
          className={
            !isEmpty && !hasError ? GRID : "flex flex-col items-center justify-center w-full"
          }
        >
          {hasError && (
            <li className={PWA_SHEET_FOCAL_STATE_CLASSNAME}>
              <EmptyState
                placement="sheet"
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
            <li className={PWA_SHEET_FOCAL_STATE_CLASSNAME}>
              <EmptyState
                placement="sheet"
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

          {readsHistory ? (
            Array.from({ length: SKELETON_CARDS }, (_, index) => (
              <li key={index} className="animate-pulse" aria-hidden="true">
                <WorkCardSkeleton />
              </li>
            ))
          ) : hasRows ? (
            <WorkList sorted={view.works} actionById={view.actionById} />
          ) : null}
          {hasRows && !readsHistory && readState?.hasOlderWork && !isOffline && loadOlderWork && (
            <li className="col-span-full flex justify-center">
              <Button
                type="button"
                emphasis="secondary"
                loading={readState.isLoadingOlder}
                onClick={loadOlderWork}
              >
                {intl.formatMessage({
                  id: "app.garden.work.showOlder",
                  defaultMessage: "Show older work",
                })}
              </Button>
            </li>
          )}
        </ul>
      </div>
    );
  }
);
