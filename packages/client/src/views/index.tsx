import { Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";

// Dynamically import default exports
const Home = lazy(() => import("./Home"));
const Garden = lazy(() => import("./Garden"));
const Profile = lazy(() => import("./Profile"));
import { Garden as HomeGarden } from "./Home/Garden";
import { GardenAssessment } from "./Home/Assessment";
import { GardenWorkApproval } from "./Home/WorkApproval";

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
