import { a, useTransition } from "@react-spring/web";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { useHome } from "../hooks/views/useHome";
import { useCampaigns } from "../hooks/views/useCampaigns";
import { useProfile } from "../hooks/views/useProfile";

import Home from "./Home";
import Profile from "./Profile";
import Campaigns from "./Campaigns";
import Campaign from "./Campaigns/Campaign";
import CampaignCreate from "./Campaigns/Create";

export default function Views() {
  const location = useLocation();
  const transitions = useTransition(location, {
    from: { opacity: 0 },
    enter: { opacity: 1 },
    leave: { opacity: 0 },
    exitBeforeEnter: true,
    config: {
      tension: 300,
      friction: 20,
      clamp: true,
    },
  });

  const home = useHome();
  const campaigns = useCampaigns();
  const profile = useProfile();

  return transitions((style, location) => (
    <a.main
      className={`flex h-[calc(100dvh-3.5rem)] overflow-hidden max-h-[calc(100dvh-3.5rem)] overflow-y-contain`}
      style={style}
    >
      <Routes location={location}>
        <Route path="home" element={<Home {...home} />} />
        <Route path="campaigns" element={<Campaigns {...campaigns} />}>
          <Route path="create" element={<CampaignCreate {...campaigns} />} />
          <Route path=":address" element={<Campaign />} />
        </Route>
        <Route path="profile" element={<Profile {...profile} />} />
        <Route path="*" element={<Navigate to="home" />} />
      </Routes>
    </a.main>
  ));
}
