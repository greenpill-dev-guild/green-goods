import { Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { lazyWithRetry, preloadComponent } from "@/utils/lazy-with-retry";

// Dynamically import default exports with retry logic
const Home = lazyWithRetry(() => import("./Home"));
const Garden = lazyWithRetry(() => import("./Garden"));
const Profile = lazyWithRetry(() => import("./Profile"));

// Dynamically import nested route components
const GardenAssessment = lazyWithRetry(() =>
  import("./Home/Assessment").then((module) => ({ default: module.GardenAssessment }))
);
const HomeGarden = lazyWithRetry(() =>
  import("./Home/Garden").then((module) => ({ default: module.Garden }))
);
const GardenWorkApproval = lazyWithRetry(() =>
  import("./Home/WorkApproval").then((module) => ({ default: module.GardenWorkApproval }))
);

// Preloader functions for critical routes
const preloadHome = preloadComponent(() => import("./Home"));
const preloadGarden = preloadComponent(() => import("./Garden"));
const preloadProfile = preloadComponent(() => import("./Profile"));

import { CircleLoader } from "@/components/UI/Loader";

export default function Views() {
  const location = useLocation();

  // Preload routes based on current location
  useEffect(() => {
    const currentPath = location.pathname;

    // Preload likely next routes based on current location
    if (currentPath.startsWith("/home")) {
      // User on home, likely to go to garden or profile
      preloadGarden();
      preloadProfile();
    } else if (currentPath.startsWith("/garden")) {
      // User on garden, likely to go to home or profile
      preloadHome();
      preloadProfile();
    } else if (currentPath.startsWith("/profile")) {
      // User on profile, likely to go to home or garden
      preloadHome();
      preloadGarden();
    } else {
      // Default: preload all main routes
      preloadHome();
      preloadGarden();
      preloadProfile();
    }
  }, [location.pathname]);

  return (
    <main className="flex flex-col h-[calc(100lvh-69px)]">
      <div className="flex-1 overflow-y-auto overflow-x-hidden momentum-scroll no-pull-refresh">
        <Suspense
          fallback={
            <div className="w-full h-full grid place-items-center">
              <CircleLoader />
            </div>
          }
        >
          <Routes>
            <Route path="home" element={<Home />}>
              <Route path=":id" element={<HomeGarden />}>
                <Route path="work/:workId" element={<GardenWorkApproval />} />
                <Route path="assessments/:assessmentId" element={<GardenAssessment />} />
              </Route>
            </Route>
            <Route path="garden" element={<Garden />} />
            <Route path="profile" element={<Profile />} />
            <Route path="*" element={<Navigate to="home" />} />
          </Routes>
        </Suspense>
      </div>
    </main>
  );
}
