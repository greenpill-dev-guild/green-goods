import React, { forwardRef, memo, useMemo, useCallback, UIEvent } from "react";
import { useIntl } from "react-intl";
import { FixedSizeList as List } from "react-window";
import { MinimalWorkCard } from "@/components/UI/Card/WorkCard";
import { BeatLoader } from "@/components/UI/Loader";
import { useNavigateToTop } from "@green-goods/shared/hooks";

// import { cn } from "@green-goods/shared/utils/cn";

interface GardenWorkProps {
  actions: Action[];
  works: Work[];
  workFetchStatus: "pending" | "success" | "error";
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
        const action = actionById.get(String(work.actionUID));
        const title = action?.title ?? `Action ${work.actionUID}`;
        const onOpen = useCallback(
          () => navigate(`/home/${work.gardenAddress}/work/${work.id}`),
          [work.gardenAddress, work.id]
        );
        return (
          <li style={style} className="p-2">
            <MinimalWorkCard onClick={onOpen} work={work as unknown as Work} actionTitle={title} />
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
            ? "grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 w-full"
            : "flex items-center justify-center w-full"
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
