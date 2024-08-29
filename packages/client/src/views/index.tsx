// import { a, useTransition } from "@react-spring/web";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

// import Home from "./Home";
// import Wprk from "./Work";
// import Profile from "./Profile";
// import Garden from "./Gardens/Garden";

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
        <Route path="gardens" element={<div>Home</div>}>
          <Route path=":id" element={<div>Garden</div>} />
        </Route>
        <Route path="work" element={<div>Work</div>} />
        <Route path="profile" element={<div>Profile</div>} />
        <Route path="*" element={<Navigate to="gardens" />} />
      </Routes>
    </main>
  );
  // ));
}
