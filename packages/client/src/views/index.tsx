import { Navigate, Route, Routes } from "react-router-dom";

import Work from "./Work";
import Profile from "./Profile";
import Gardens from "./Gardens";
import { Garden } from "./Gardens/Garden";

export default function Views() {
  return (
    <main
      className={`overflow-hidden h-[calc(100dvh-3.5rem)] max-h-[calc(100dvh-3.5rem)]`}
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
}
