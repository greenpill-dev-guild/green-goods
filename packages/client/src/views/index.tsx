import { Navigate, Route, Routes } from "react-router-dom";

import Home from "./Home";
import Garden from "./Garden";
import Profile from "./Profile";
import { Garden as HomeGarden } from "./Home/Garden";
import { GardenAssessment } from "./Home/Assessment";
import { GardenWorkApproval } from "./Home/WorkApproval";

export default function Views() {
  return (
    <main className="flex flex-col pb-[4rem]">
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <Routes>
          <Route path="home" element={<Home />}>
            <Route path=":id" element={<HomeGarden />}>
              <Route path="work/:workId" element={<GardenWorkApproval />} />
              <Route
                path="assessments/:assessmentId"
                element={<GardenAssessment />}
              />
            </Route>
          </Route>
          <Route path="garden" element={<Garden />} />
          <Route path="profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="home" />} />
        </Routes>
      </div>
    </main>
  );
}
