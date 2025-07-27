import { RouterProvider } from "react-router-dom";
import { CircleLoader } from "@/components/UI/Loader";
import { router } from "@/router";

function App() {
  return <RouterProvider router={router} fallbackElement={<CircleLoader />} />;
}

export default App;
