import { a, useTransition } from "@react-spring/web";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { useHome } from "../hooks/views/useHome";
import { useContribute } from "../hooks/views/useContribute";
import { useProfile } from "../hooks/views/useProfile";

import Home from "./Home";
import Profile from "./Profile";
import Contribute from "./Contribute";
import Contribution from "./Home/Contribution";

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
  const contribute = useContribute();
  const profile = useProfile();

  return transitions((style, location) => (
    <a.main
      className={`flex h-[calc(100dvh-3.5rem)] overflow-hidden max-h-[calc(100dvh-3.5rem)] overflow-y-contain`}
      style={style}
    >
      <Routes location={location}>
        <Route path="home" element={<Home {...home} />}>
          <Route path=":contribution" element={<Contribution />} />
        </Route>
        <Route path="contribute" element={<Contribute {...contribute} />} />
        <Route path="profile" element={<Profile {...profile} />} />
        <Route path="*" element={<Navigate to="home" />} />
      </Routes>
    </a.main>
  ));
}
