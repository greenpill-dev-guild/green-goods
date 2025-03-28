import { Navigate, Route, Routes } from "react-router-dom";

import Work from "./Garden";
import Profile from "./Profile";
import Gardens from "./Home";
import { Garden } from "./Home/Garden";
import { GardenAssessment } from "./Home/Assessment";
import { GardenWorkApproval } from "./Home/WorkApproval";

export default function Views() {
  return (
    <main className="flex flex-col pb-[4rem]">
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <Routes>
          <Route path="home" element={<Gardens />}>
            <Route path=":id" element={<Garden />}>
              <Route path="work/:workId" element={<GardenWorkApproval />} />
              <Route
                path="assessments/:assessmentId"
                element={<GardenAssessment />}
              />
            </Route>
          </Route>
          <Route path="garden" element={<Work />} />
          <Route path="profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="home" />} />
        </Routes>
      </div>
    </main>
  );
}
