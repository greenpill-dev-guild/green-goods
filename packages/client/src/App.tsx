import { Toaster } from "react-hot-toast";
import { usePrivy } from "@privy-io/react-auth";
import { Route, Routes, Navigate, BrowserRouter } from "react-router-dom";

import { WorkProvider } from "./providers/WorkProvider";
import { GardenProvider } from "./providers/GardenProvider";

import { usePWA } from "./providers/PWAProvider";
import { useUser } from "./providers/UserProvider";

import Views from "./views";
import { Appbar } from "./components/AppBar";

function App() {
  const { authenticated } = usePrivy();
  const { isMobile, isInstalled } = usePWA();
  const { smartAccountReady } = useUser();

  const isAuthenticated = authenticated && smartAccountReady;

  // const isOnboarded = user.

  // Check if the user is on mobile and the PWA is installed
  const shouldShowApp = isInstalled && isMobile;

  return (
    <BrowserRouter>
      <Routes>
        {/* Landing Page Route */}
        <Route path="/landing" element={<div>Landing Page</div>} />

        {/* Login Route */}
        <Route
          path="/login"
          element={
            isAuthenticated ? <Navigate to="/" replace /> : <div>Login</div>
          }
        />

        {/* Main Route: Either show app or landing page based on conditions */}
        <Route
          path="/"
          element={
            shouldShowApp ?
              isAuthenticated ?
                <GardenProvider>
                  <WorkProvider>
                    <Views />
                    <Appbar />
                    <Toaster />
                  </WorkProvider>
                </GardenProvider>
              : <Navigate to="/login" replace />
            : <Navigate to="/landing" replace />
          }
        />

        {/* Catch-all Route: Redirect to the appropriate place */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
