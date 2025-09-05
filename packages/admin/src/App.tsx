import { Provider as UrqlProvider } from "urql";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import { urqlClient } from "@/utils/urql";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireRole } from "@/components/RequireRole";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import Login from "@/views/Login";
import Dashboard from "@/views/Dashboard";
import Gardens from "@/views/Gardens";
import GardenDetail from "@/views/Gardens/Detail";
import Contracts from "@/views/Contracts";

function App() {
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
                <Route element={<RequireRole allowedRoles={["deployer"]} />}>
                  <Route path="/contracts" element={<Contracts />} />
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
