import { getIndexerUrl } from "@green-goods/shared/config";
import { createUrqlClient } from "@green-goods/shared/utils/urql";
import { Toaster } from "react-hot-toast";
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
        <Toaster
          position="top-center"
          containerStyle={{ zIndex: 20000 }}
          toastOptions={{
            duration: 3500,
            style: {
              background: "var(--color-bg-white-0)",
              color: "var(--color-text-strong-950)",
              border: "1px solid var(--color-stroke-soft-200)",
              boxShadow: "var(--shadow-regular-md)",
              borderRadius: "10px",
              padding: "10px 12px",
              fontSize: "14px",
              lineHeight: "20px",
            },
            success: {
              style: {
                borderLeft: "4px solid var(--color-success-base)",
              },
              iconTheme: {
                primary: "var(--color-success-base)",
                secondary: "var(--color-white)",
              },
              duration: 3000,
            },
            error: {
              style: {
                borderLeft: "4px solid var(--color-error-base)",
              },
              iconTheme: {
                primary: "var(--color-error-base)",
                secondary: "var(--color-white)",
              },
              duration: 4500,
            },
            loading: {
              style: {
                borderLeft: "4px solid var(--color-information-base)",
              },
              duration: 60000,
            },
          }}
        />
      </BrowserRouter>
    </UrqlProvider>
  );
}

export default App;
