import { usePrivy } from "@privy-io/react-auth";
import { QueryClientProvider } from "@tanstack/react-query";
import { Route, Routes, Navigate, BrowserRouter } from "react-router-dom";

import { queryClient } from "@/modules/react-query";

import { WorkProvider } from "@/providers/WorkProvider";
import { GardenProvider } from "@/providers/GardenProvider";

import { usePWA } from "@/providers/PWAProvider";
import { useUser } from "@/providers/UserProvider";

import Views from "@/views";
import Login from "@/views/Login";
import Landing from "@/views/Landing";
import { Appbar } from "@/components/Layout/AppBar";

function App() {
  const { authenticated } = usePrivy();
  const { isMobile, isInstalled, locale } = usePWA();
  const { smartAccountReady } = useUser();

  console.log("PWA", isMobile, isInstalled, locale);

  const isDownloaded = isMobile;
  const isAuthenticated = !authenticated && !smartAccountReady;

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Landing */}
          <Route
            path="/landing"
            element={isDownloaded ? <Navigate to="/" replace /> : <Landing />}
          />
          {/* Login */}
          <Route
            path="/login"
            element={
              isDownloaded ?
                !isAuthenticated ?
                  <Login />
                : <Navigate to="/" replace />
              : <Navigate to="/landing" replace />
            }
          />
          {/* Main: Show app or navigate to login, onboarding, or landing page based on conditions */}
          <Route
            path="*"
            element={
              isDownloaded ?
                isAuthenticated ?
                  <GardenProvider>
                    <WorkProvider>
                      <Views />
                      <Appbar />
                    </WorkProvider>
                  </GardenProvider>
                : <Navigate to="/login" replace />
              : <Navigate to="/landing" replace />
            }
          />
          {/* Catch-all: Redirect to the appropriate place */}
          {/* <Route path="*" element={<Navigate to="/" replace />} /> */}
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
