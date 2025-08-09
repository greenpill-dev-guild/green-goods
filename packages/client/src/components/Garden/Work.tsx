import React, { forwardRef, memo, type UIEvent, useMemo, useCallback } from "react";
import { FixedSizeList as List } from "react-window";
import { useIntl } from "react-intl";
import { useCurrentChain, useNavigateToTop } from "@/hooks";
// import { WorkCard } from "../UI/Card/WorkCard";
import { BeatLoader } from "../UI/Loader";

// import { cn } from "@/utils/cn";

interface GardenWorkProps {
  actions: Action[];
  works: Work[];
  workFetchStatus: "pending" | "success" | "error";
  handleScroll: (event: UIEvent<HTMLUListElement>) => void;
}

interface WorkListProps {
  works: Work[];
  actions: Action[];
  workFetchStatus: "pending" | "success" | "error";
}

const WorkList = ({ works, actions, workFetchStatus }: WorkListProps) => {
  const intl = useIntl();
  const navigate = useNavigateToTop();
  const chainId = useCurrentChain();

  const actionById = useMemo(
    () => new Map(actions.map((a) => [String(a.id), a] as const)),
    [actions]
  );
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
            <li key={i} className="p-2">
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
        const action = actionById.get(`${chainId}-${work.actionUID}`);
        if (!action) return null;
        const onOpen = useCallback(
          () => navigate(`/home/${work.gardenAddress}/work/${work.id}`),
          [navigate, work.gardenAddress, work.id]
        );
        return (
          <li style={style} className="p-2">
            <button
              onClick={onOpen}
              className="flex flex-col gap-1 text-left w-full rounded-lg border border-slate-200 p-3 bg-white hover:shadow-sm transition-transform transform-gpu hover:scale-[1.01]"
              aria-label={`View work ${action.title}`}
            >
              <span className="text-sm font-medium">{action.title}</span>
              <span className="text-xs text-slate-600 line-clamp-2">{work.feedback}</span>
            </button>
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
  ({ works, actions, workFetchStatus, handleScroll }, ref) => {
    const isEmpty = workFetchStatus === "success" && works.length === 0;
    const hasError = workFetchStatus === "error";
    const isLoading = workFetchStatus === "pending";

    return (
      <ul
        ref={ref}
        onScroll={handleScroll}
        className={
          !isEmpty && !hasError && !isLoading
            ? "grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 w-full overflow-y-scroll h-full"
            : "flex items-center justify-center w-full h-full overflow-y-scroll"
        }
      >
        {isLoading && (
          <div className="flex items-center justify-center p-8">
            <BeatLoader />
          </div>
        )}

        {hasError && (
          <div className="flex items-center justify-center p-8">
            <p className="text-sm text-red-600 text-center">
              Error loading works. Please try again.
            </p>
          </div>
        )}

        {isEmpty && (
          <div className="flex items-center justify-center p-8">
            <p className="text-sm text-center italic text-gray-400">
              No work items found for this garden yet.
            </p>
          </div>
        )}

        {!isLoading && !hasError && !isEmpty && (
          <WorkList works={works} actions={actions} workFetchStatus={workFetchStatus} />
        )}
      </ul>
    );
  }
);
