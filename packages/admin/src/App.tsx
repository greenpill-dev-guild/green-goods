import { getIndexerUrl } from "@green-goods/shared/config";
import { createUrqlClient } from "@green-goods/shared/utils/urql";
import { ToastViewport } from "@green-goods/shared";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Provider as UrqlProvider } from "urql";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireRole } from "@/components/RequireRole";
import Contracts from "@/views/Contracts";
import Dashboard from "@/views/Dashboard";
import Deployment from "@/views/Deployment";
import Gardens from "@/views/Gardens";
import GardenAssessment from "@/views/Gardens/Assessment";
import GardenDetail from "@/views/Gardens/Detail";
import Login from "@/views/Login";

function App() {
  const urqlClient = createUrqlClient(getIndexerUrl(import.meta.env, import.meta.env.DEV));

  return (
    <UrqlProvider value={urqlClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<RequireAuth />}>
            <Route element={<RequireRole allowedRoles={["deployer", "operator", "user"]} />}>
              <Route element={<DashboardLayout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/gardens" element={<Gardens />} />
                <Route path="/gardens/:id" element={<GardenDetail />} />
                <Route path="/gardens/:id/assessments" element={<GardenAssessment />} />
                <Route element={<RequireRole allowedRoles={["deployer"]} />}>
                  <Route path="/contracts" element={<Contracts />} />
                  <Route path="/deployment" element={<Deployment />} />
                </Route>
              </Route>
            </Route>
          </Route>
        </Routes>
        <ToastViewport />
      </BrowserRouter>
    </UrqlProvider>
  );
}

export default App;
