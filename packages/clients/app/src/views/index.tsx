import { a, useTransition } from "@react-spring/web";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { useHome } from "../hooks/views/useHome";
import { useExplore } from "../hooks/views/useExplore";
import { useProfile } from "../hooks/views/useProfile";

import Home from "./Home";
import Explore from "./Explore";
import Profile from "./Profile";

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
  const explore = useExplore();
  const profile = useProfile();

  return transitions((style, location) => (
    <a.main
      className={`flex h-[calc(100dvh-3.5rem)] overflow-hidden max-h-[calc(100dvh-3.5rem)] overflow-y-contain`}
      style={style}
    >
      <Routes location={location}>
        <Route path="home" element={<Home {...home} />} />
        <Route path="explore" element={<Explore {...explore} />} />
        <Route path="profile" element={<Profile {...profile} />} />
        <Route path="*" element={<Navigate to="profile" />} />
      </Routes>
    </a.main>
  ));
}
