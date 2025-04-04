import { CircleLoader } from "../Loader";
import { WorkCard } from "../UI/Card/WorkCard";
import { useNavigateToTop } from "@/utils/useNavigateToTop";

interface GardenWorkProps {
  actions: Action[];
  works: Work[];
  workFetchStatus: "pending" | "success" | "error";
}

export const GardenWork: React.FC<GardenWorkProps> = ({
  works,
  actions,
  workFetchStatus,
}) => {
  const navigate = useNavigateToTop();

  const WorkList = () => {
    switch (workFetchStatus) {
      case "pending":
        return <CircleLoader />;
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

              return (
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime()
              );
            })
            .map((work) => (
              <WorkCard
                key={work.id}
                work={work}
                selected={false}
                action={actions.find((a) => a.id === work.actionUID)!}
                media="large"
                onClick={() =>
                  navigate(`/home/${work.gardenAddress}/work/${work.id}`)
                }
              />
            ))
        ) : (
          <p className="grid p-8 place-items-center text-sm text-center italic text-gray-400">
            No work yet, get started by submitting new work.
          </p>
        );
      case "error":
        return (
          <p className="grid place-items-center text-sm italic">
            Error loading works
          </p>
        );
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <WorkList />
    </div>
  );
};
