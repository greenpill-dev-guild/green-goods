import { usePrivy } from "@privy-io/react-auth";
import { QueryClientProvider } from "@tanstack/react-query";
import { Route, Routes, Navigate, BrowserRouter } from "react-router-dom";

import { queryClient } from "@/modules/react-query";

import { WorkProvider } from "@/providers/work";
import { GardensProvider } from "@/providers/garden";

import { useApp } from "@/providers/app";
import { useUser } from "@/providers/user";

import { CircleLoader } from "@/components/Loader";
import { AppBar } from "@/components/Layout/AppBar";

import AppViews from "@/views";
import Login from "@/views/Login";
import Landing from "@/views/Landing";

function App() {
  const { authenticated } = usePrivy();
  const { isMobile, isInstalled } = useApp();
  const { ready, smartAccountAddress } = useUser();

  const isDownloaded = isMobile && isInstalled;
  const isAuthenticated = authenticated && smartAccountAddress;

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
                !isAuthenticated && !ready ?
                  <main className="w-full h-full grid place-items-center">
                    <CircleLoader />
                  </main>
                : !isAuthenticated ?
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
                  <GardensProvider>
                    <WorkProvider>
                      <AppViews />
                      <AppBar />
                    </WorkProvider>
                  </GardensProvider>
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
