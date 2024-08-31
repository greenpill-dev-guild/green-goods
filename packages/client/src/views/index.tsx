import { Navigate, Route, Routes } from "react-router-dom";

import Work from "./Work";
import Profile from "./Profile";
import Gardens from "./Gardens";
import { Garden } from "./Gardens/Garden";

export default function Views() {
  return (
    <main
      className={`flex h-[calc(100dvh-3.5rem)] overflow-hidden max-h-[calc(100dvh-3.5rem)] overflow-y-contain`}
    >
      <Routes>
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
