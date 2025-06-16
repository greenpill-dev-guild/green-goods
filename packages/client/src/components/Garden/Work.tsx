import { forwardRef, type UIEvent } from "react";
import { useIntl } from "react-intl";
import { useNavigateToTop } from "@/utils/useNavigateToTop";
import { WorkCard } from "../UI/Card/WorkCard";
import { BeatLoader } from "../UI/Loader";

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

  switch (workFetchStatus) {
    case "pending":
      return <BeatLoader />;
    case "success":
      return works.length ? (
        works
          .sort((a: Work, b: Work) => {
            if (a.status === "pending" && b.status !== "pending") {
              return -1;
            }
            if (a.status !== "pending" && b.status === "pending") {
              return 1;
            }

            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          })
          .map((work) => {
            const action = actions.find((a) => a.id === work.actionUID);
            if (!action) return null;

            return (
              <WorkCard
                key={work.id}
                work={work}
                selected={false}
                action={action}
                media="large"
                onClick={() => navigate(`/home/${work.gardenAddress}/work/${work.id}`)}
              />
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
    return (
      <ul
        ref={ref}
        onScroll={handleScroll}
        className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 w-full no-scrollbar overflow-y-scroll"
      >
        <WorkList works={works} actions={actions} workFetchStatus={workFetchStatus} />
      </ul>
    );
  }
);
