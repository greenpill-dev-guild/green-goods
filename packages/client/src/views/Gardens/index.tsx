import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { useGarden } from "@/providers/GardenProvider";

import { GardenCard } from "./Card";

export interface GardensProps {}

const Gardens: React.FC<GardensProps> = () => {
  const { gardens } = useGarden();
  const navigate = useNavigate();
  const location = useLocation();

  function handleCardClick(id: string) {
    navigate(`/gardens/${id}`);
  }

  return (
    <section className={`relative w-full h-full`}>
      <div className="flex justify-between w-full">
        <h3>Gardens</h3>
      </div>
      {/* <ul className="h-full flex-1 flex flex-col gap-4 overflow-y-scroll cursor-pointer"> */}
      {location.pathname === "/gardens" ?
        <ul className={`relative w-full h-full`}>
          {gardens.length ?
            gardens.map((garden) => (
              <li key={garden.id}>
                <GardenCard
                  {...garden}
                  onCardClick={() => handleCardClick(garden.id)}
                />
              </li>
            ))
          : <p className="h-full w-full grid place-items-center text-sm italic">
              No gardens found,
              <span role="img" aria-label="Sad face">
                😔
              </span>
            </p>
          }
        </ul>
      : null}
      <Outlet />
    </section>
  );
};

export default Gardens;