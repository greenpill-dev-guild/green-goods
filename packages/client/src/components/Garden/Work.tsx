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
          works.map((work) => (
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
          <div>
            <CircleLoader />
          </div>
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
