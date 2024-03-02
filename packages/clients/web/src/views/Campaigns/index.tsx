import React from "react";
import { Outlet } from "react-router-dom";

interface CampaignsProps {}

const Campaigns: React.FC<CampaignsProps> = ({}) => {
  return (
    <section className={`relative w-full h-full`}>
      <Outlet />
    </section>
  );
};

export default Campaigns;
