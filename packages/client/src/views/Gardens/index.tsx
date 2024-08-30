import { Outlet, useLocation } from "react-router-dom";

import { useGarden } from "@/providers/GardenProvider";

// import { GardenCard } from "./Card";

export interface GardensProps {}

const Gardens: React.FC<GardensProps> = () => {
  const { gardens } = useGarden();
  // const navigate = useNavigate();
  const location = useLocation();

  // function handleCardClick(id: string) {
  //   navigate(`/campaigns/${id}`);
  // }

  return (
    <section className={`relative w-full h-full`}>
      <div className="flex justify-between w-full">
        <h4>Home</h4>
        <div></div>
      </div>
      {/* <ul className="h-full flex-1 flex flex-col gap-4 overflow-y-scroll cursor-pointer"> */}
      {location.pathname === "/campaigns" ?
        <ul className={`relative w-full h-full`}>
          {gardens.length ?
            gardens.map((garden) => (
              <li key={garden.id}>
                {/* <GardenCard
                  {...garden}
                  // userVote={
                  //   garden.votes?.find((v) => v.user_id === user?.id)
                  //     ?.vote_type ?? null
                  // }
                  // onCardClick={() => onGardenClick(garden.id)}
                  // onUpVote={() => onGardenVote(garden.id, true)}
                /> */}
              </li>
            ))
          : <p className="h-full w-full grid place-items-center text-sm italic">
              No gardens found. Try creating one!
            </p>
          }
        </ul>
      : null}
      <Outlet />
    </section>
  );
};

export default Gardens;
