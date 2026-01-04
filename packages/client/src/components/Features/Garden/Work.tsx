import { useNavigateToTop } from "@green-goods/shared/hooks";
import { RiLoader4Line } from "@remixicon/react";
import React, { forwardRef, memo, UIEvent, useCallback, useMemo } from "react";
import { useIntl } from "react-intl";
import { FixedSizeList as List } from "react-window";
import { MinimalWorkCard } from "@/components/Cards";
import { BeatLoader } from "@/components/Communication";

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

const WorkList = ({ works, actions, workFetchStatus }: WorkListProps) => {
  const intl = useIntl();
  const navigate = useNavigateToTop();
  // const chainId = useCurrentChain();

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
              <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 bg-white">
                <div className="h-4 w-40 bg-slate-200 rounded animate-pulse" />
                <div className="h-3 w-64 bg-slate-200 rounded animate-pulse" />
              </div>
            </li>
          ))}
        </div>
      );
    case "success": {
      if (!sorted.length) {
        return (
          <p className="grid p-8 place-items-center text-sm text-center italic text-gray-400">
            {intl.formatMessage({
              id: "app.garden.work.noWork",
              description: "No work yet",
            })}
          </p>
        );
      }

      const WorkListItem = memo(function WorkListItem({
        index,
        style,
      }: {
        index: number;
        style: React.CSSProperties;
      }) {
        const work = sorted[index];
        const action = actionById.get(String(work.actionUID));
        const title = action?.title ?? `Action ${work.actionUID}`;
        const onOpen = useCallback(
          () => navigate(`/home/${work.gardenAddress}/work/${work.id}`),
          [work.gardenAddress, work.id]
        );
        return (
          <li style={style}>
            <MinimalWorkCard
              onClick={onOpen}
              work={work as unknown as Work}
              actionTitle={title}
              variant="detailed"
            />
          </li>
        );
      });

      const shouldVirtualize = sorted.length > 30;
      return shouldVirtualize ? (
        <List
          height={600}
          itemCount={sorted.length}
          itemSize={80}
          width={"100%"}
          className="w-full"
        >
          {({ index, style }: { index: number; style: React.CSSProperties }) => (
            <WorkListItem index={index} style={style} />
          )}
        </List>
      ) : (
        <>
          {sorted.map((_, i) => (
            <WorkListItem key={sorted[i].id} index={i} style={{}} />
          ))}
        </>
      );
    }
    case "error":
      return (
        <p className="grid place-items-center text-sm italic">
          {intl.formatMessage({
            id: "app.garden.work.errorLoadingWorks",
            description: "Error loading works",
          })}
        </p>
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
            <BeatLoader />
          </div>
        )}

        {hasError && (
          <div className="flex flex-col items-center justify-center gap-4 p-8">
            <p className="text-sm text-error-text text-center">
              {intl.formatMessage({
                id: "app.garden.work.errorLoadingWorks",
                defaultMessage: "Failed to load work submissions",
              })}
            </p>
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isFetching}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-base rounded-lg hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                  intl.formatMessage({
                    id: "app.common.tryAgain",
                    defaultMessage: "Try Again",
                  })
                )}
              </button>
            )}
          </div>
        )}

        {isEmpty && (
          <div className="flex flex-col items-center justify-center gap-4 p-8">
            <p className="text-sm text-center italic text-text-sub">
              {intl.formatMessage({
                id: "app.garden.work.noWork",
                defaultMessage: "No work submissions yet",
              })}
            </p>
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isFetching}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-text-sub border border-stroke-soft rounded-lg hover:bg-bg-soft disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                  intl.formatMessage({
                    id: "app.common.refresh",
                    defaultMessage: "Refresh",
                  })
                )}
              </button>
            )}
          </div>
        )}

        {!isLoading && !hasError && !isEmpty && (
          <WorkList works={works} actions={actions} workFetchStatus={workFetchStatus} />
        )}
      </ul>
    );
  }
);
