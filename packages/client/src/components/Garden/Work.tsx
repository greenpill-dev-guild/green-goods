import { forwardRef, type UIEvent, useMemo } from "react";
import { useIntl } from "react-intl";
import { useNavigateToTop } from "@/hooks";
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
      return <BeatLoader />;
    case "success":
      return sorted.length ? (
        sorted.map((work) => {
          const action = actionById.get(String(work.actionUID));
          if (!action) return null;
          return (
            <li key={work.id} className="p-2">
              <div
                onClick={() => navigate(`/home/${work.gardenAddress}/work/${work.id}`)}
                className="flex flex-col gap-1 cursor-pointer"
              >
                <span className="text-sm font-medium">{action.title}</span>
                <span className="text-xs text-slate-600">{work.feedback}</span>
              </div>
            </li>
          );
        })
      ) : (
        <p className="grid p-8 place-items-center text-sm text-center italic text-gray-400">
          {intl.formatMessage({
            id: "app.garden.work.noWork",
            description: "No work yet",
          })}
        </p>
      );
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
            ? "grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 w-full no-scrollbar overflow-y-scroll h-full"
            : "flex items-center justify-center w-full h-full overflow-y-scroll no-scrollbar"
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
