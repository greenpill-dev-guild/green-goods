import React from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";

interface CampaignsProps {}

const Campaigns: React.FC<CampaignsProps> = (
  {
    // address,
    // confirmationMap,
    // contributions,
  }
) => {
  const navigate = useNavigate();
  const location = useLocation();

  function handleCardClick(id: string) {
    navigate(`/campaigns/${id}`);
  }

  return (
    <section className={`relative w-full h-full`}>
      <div className="flex justify-between w-full">
        <h4>Campaigns</h4>
        <div></div>
      </div>
      {location.pathname === "/campaigns" ?
        <ul className={`relative w-full h-full`}>
          {Array.from({ length: 5 }).map((_, index) => (
            <li className="p-1" onClick={() => handleCardClick("")}>
              {index}
            </li>
          ))}
        </ul>
      : null}
      <Outlet />
    </section>
  );
};

export default Campaigns;
