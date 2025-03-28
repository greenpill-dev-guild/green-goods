import { formatAddress } from "@/utils/text";
import { RiAlertFill, RiLeafFill, RiSearchEyeLine } from "@remixicon/react";
import { useNavigate } from "react-router-dom";

import { CircleLoader } from "../Loader";
import { WorkCard } from "../UI/Card/WorkCard";

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
  const navigate = useNavigate();

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
                navigate(`/gardens/${work.gardenAddress}/work/${work.id}`)
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
