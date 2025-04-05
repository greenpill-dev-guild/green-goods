import { Outlet, useLocation } from "react-router-dom";

import { useGardens } from "@/providers/garden";

import { GardenCard } from "@/components/UI/Card/GardenCard";
import { CircleLoader } from "@/components/Loader";
import { useNavigateToTop } from "@/utils/useNavigateToTop";

const Gardens: React.FC = () => {
  const navigate = useNavigateToTop();
  const location = useLocation();
  const { gardens, gardensStatus } = useGardens();

  function handleCardClick(id: string) {
    navigate(`/home/${id}`);
    document.getElementsByTagName("article")[0].scrollIntoView();
  }

  const GardensList = () => {
    switch (gardensStatus) {
      case "pending":
        return (
          <div className="flex w-full h-full items-center justify-center ">
            <CircleLoader />
          </div>
        );
      case "success":
        return gardens.length ?
            gardens.map((garden) => (
              <GardenCard
                key={garden.id}
                garden={garden}
                media="large"
                showOperators={true}
                selected={garden.id === location.pathname.split("/")[2]}
                {...garden}
                onClick={() => handleCardClick(garden.id)}
              />
            ))
          : <p className="grid place-items-center text-sm italic">
              No gardens found
            </p>;
      case "error":
        return (
          <p className="grid place-items-center text-sm italic">
            Error loading gardens
          </p>
        );
    }
  };

  return (
    <article className={"mb-6"}>
      {location.pathname === "/home" ?
        <>
          <div className="padded flex justify-between w-full py-4">
            <h4 className="font-semibold">Home</h4>
          </div>
          <div
            className={"padded flex-1 flex flex-col gap-4 overflow-y-scroll"}
          >
            <GardensList />
          </div>
        </>
      : null}
      <Outlet />
    </article>
  );
};

export default Gardens;
