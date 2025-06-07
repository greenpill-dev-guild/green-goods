import { forwardRef } from "react";
import { BeatLoader } from "../UI/Loader";
import { WorkCard } from "../UI/Card/WorkCard";
import { useNavigateToTop } from "@/utils/useNavigateToTop";
import { useIntl } from "react-intl";

interface GardenWorkProps {
  actions: Action[];
  works: Work[];
  workFetchStatus: "pending" | "success" | "error";
  handleScroll: (event: React.UIEvent<HTMLUListElement, UIEvent>) => void;
}

export const GardenWork = forwardRef<HTMLUListElement, GardenWorkProps>(
  ({ works, actions, workFetchStatus, handleScroll }, ref) => {
    const intl = useIntl();
    const navigate = useNavigateToTop();

    const WorkList = () => {
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
              .map((work) => (
                <WorkCard
                  key={work.id}
                  work={work}
                  selected={false}
                  action={actions.find((a) => a.id === work.actionUID)!}
                  media="large"
                  onClick={() => navigate(`/home/${work.gardenAddress}/work/${work.id}`)}
                />
              ))
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

    return (
      <ul ref={ref} className="flex flex-col gap-4" onScroll={handleScroll}>
        <WorkList />
      </ul>
    );
  }
);
