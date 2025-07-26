import { usePrivy } from "@privy-io/react-auth";
import { QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { Toaster } from "react-hot-toast";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppBar } from "@/components/Layout/AppBar";
import { AppErrorBoundary } from "@/components/UI/ErrorBoundary/AppErrorBoundary";
import { CircleLoader } from "@/components/UI/Loader";
import { OfflineIndicator } from "@/components/UI/OfflineIndicator/OfflineIndicator";

import { useOfflineSync } from "@/hooks/useOfflineSync";
import { queryClient } from "@/modules/react-query";
import { useApp } from "@/providers/app";

import { GardensProvider } from "@/providers/garden";
import { JobQueueProvider } from "@/providers/jobQueue";
import { useUser } from "@/providers/user";
import { WorkProvider } from "@/providers/work";

import AppViews from "@/views";

// Dynamic imports for better code splitting
const Landing = lazy(() => import("@/views/Landing"));
const Login = lazy(() => import("@/views/Login"));

// Main app content with proper providers
function AppContent() {
  const { authenticated } = usePrivy();
  const { isMobile, isInstalled } = useApp();
  const { ready, smartAccountAddress } = useUser();

  const isDownloaded = (isMobile && isInstalled) || import.meta.env.VITE_DESKTOP_DEV;
  const isAuthenticated = authenticated && smartAccountAddress;

  // Always call the sync hook, but it will handle authentication internally
  useOfflineSync();

  return (
    <Routes>
      {/* Landing */}
      <Route
        path="/landing"
        element={
          isDownloaded ? (
            <Navigate to="/" replace />
          ) : (
            <Suspense fallback={<CircleLoader />}>
              <Landing />
              <Toaster />
            </Suspense>
          )
        }
      />
      {/* Login */}
      <Route
        path="/login"
        element={
          isDownloaded ? (
            !isAuthenticated && !ready ? (
              <main className="w-full h-full grid place-items-center">
                <CircleLoader />
              </main>
            ) : !isAuthenticated ? (
              <Suspense fallback={<CircleLoader />}>
                <Login />
              </Suspense>
            ) : (
              <Navigate to="/" replace />
            )
          ) : (
            <Navigate to="/landing" replace />
          )
        }
      />
      {/* Main: Show app or navigate to login, onboarding, or landing page based on conditions */}
      <Route
        path="/*"
        element={
          isDownloaded ? (
            isAuthenticated ? (
              <GardensProvider>
                <JobQueueProvider>
                  <WorkProvider>
                    <AppViews />
                    <AppBar />
                    <OfflineIndicator />
                  </WorkProvider>
                </JobQueueProvider>
              </GardensProvider>
            ) : (
              <Navigate to="/login" replace />
            )
          ) : (
            <Navigate to="/landing" replace />
          )
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppErrorBoundary>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </AppErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;
