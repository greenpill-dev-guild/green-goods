import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { useGardens } from "@/providers/garden";

import { GardenCard } from "@/components/Garden/Card";
import { CircleLoader } from "@/components/Loader";

const Gardens: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { gardens, gardensStatus } = useGardens();

  function handleCardClick(id: string) {
    navigate(`/gardens/${id}`);
  }

  const GardensList = () => {
    switch (gardensStatus) {
      case "pending":
        return <CircleLoader />;
      case "success":
        return gardens.length ?
            gardens.map((garden, index) => (
              <GardenCard
                key={garden.id}
                index={index}
                {...garden}
                onCardClick={() => handleCardClick(garden.id)}
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
    <div
      className={"flex flex-col w-full h-full pt-4 py-8 fixed overscroll-none top-0 left-0 px-4"}
    >
      {location.pathname === "/gardens" ?
        <>
          <div className="flex justify-between w-full">
            <h3>Gardens</h3>
          </div>
          <ul className={"flex-1 flex flex-col gap-4 overflow-y-scroll"}>
            <GardensList />
          </ul>
        </>
      : null}
      <Outlet />
    </div>
  );
};

export default Gardens;
