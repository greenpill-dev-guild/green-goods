import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { useGardens } from "@/providers/garden";

import { GardenCard } from "@/components/UI/Card/GardenCard";
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
        return gardens.length ? (
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
        ) : (
          <p className="grid place-items-center text-sm italic">
            No gardens found
          </p>
        );
      case "error":
        return (
          <p className="grid place-items-center text-sm italic">
            Error loading gardens
          </p>
        );
    }
  };

  return (
    <div className={""}>
      {location.pathname === "/gardens" ? (
        <>
          <div className="padded flex justify-between w-full py-4">
            <h3>Home</h3>
          </div>
          <ul className={"padded flex-1 flex flex-col gap-4 overflow-y-scroll"}>
            <GardensList />
          </ul>
        </>
      ) : null}
      <Outlet />
    </div>
  );
};

export default Gardens;
