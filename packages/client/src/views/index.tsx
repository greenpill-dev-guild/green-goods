import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

// Dynamically import default exports
const Home = lazy(() => import("./Home"));
const Garden = lazy(() => import("./Garden"));
const Profile = lazy(() => import("./Profile"));

// Dynamically import nested route components
const GardenAssessment = lazy(() =>
  import("./Home/Assessment").then((module) => ({ default: module.GardenAssessment }))
);
const HomeGarden = lazy(() =>
  import("./Home/Garden").then((module) => ({ default: module.Garden }))
);
const GardenWorkApproval = lazy(() =>
  import("./Home/WorkApproval").then((module) => ({ default: module.GardenWorkApproval }))
);

import { CircleLoader } from "@/components/UI/Loader";

export default function Views() {
  return (
    <main className="flex flex-col h-[calc(100lvh-69px)]">
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
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
