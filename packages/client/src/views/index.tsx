import { Navigate, Route, Routes } from "react-router-dom";

import Work from "./Work";
import Profile from "./Profile";
import Gardens from "./Gardens";
import { Garden } from "./Gardens/Garden";
import { GardenAssessment } from "./Gardens/Assessment";
import { GardenWorkApproval } from "./Gardens/WorkApproval";

export default function Views() {
  return (
    <main
      className={"overflow-hidden overscroll-contain h-[calc(100lvh-3.5rem)]"}
    >
      <Routes>
        <Route path="gardens" element={<Gardens />}>
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
        <Route path="*" element={<Navigate to="gardens" />} />
      </Routes>
    </main>
  );
}
