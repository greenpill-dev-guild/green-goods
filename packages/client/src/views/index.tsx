// import { a, useTransition } from "@react-spring/web";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import Work from "./Work";
import Profile from "./Profile";
import Gardens from "./Gardens";
import { Garden } from "./Gardens/Garden";

export default function Views() {
  const location = useLocation();
  // const transitions = useTransition(location, {
  //   from: { opacity: 0 },
  //   enter: { opacity: 1 },
  //   leave: { opacity: 0 },
  //   exitBeforeEnter: true,
  //   config: {
  //     tension: 300,
  //     friction: 20,
  //     clamp: true,
  //   },
  // });

  // transitions((style, location) => (
  return (
    <main
      className={`flex h-[calc(100dvh-3.5rem)] overflow-hidden max-h-[calc(100dvh-3.5rem)] overflow-y-contain`}
      // style={style}
    >
      <Routes location={location}>
        <Route path="gardens" element={<Gardens />}>
          <Route path=":id" element={<Garden />} />
        </Route>
        <Route path="garden" element={<Work />} />
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="gardens" />} />
      </Routes>
    </main>
  );
  // ));
}
