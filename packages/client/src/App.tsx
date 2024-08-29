import { Toaster } from "react-hot-toast";
import { IntlProvider } from "react-intl";
import { usePrivy } from "@privy-io/react-auth";
import { QueryClientProvider } from "@tanstack/react-query";
import { Route, Routes, Navigate, BrowserRouter } from "react-router-dom";

import enMessages from "@/i18n/en.json";
import ptMessages from "@/i18n/pt.json";

import { queryClient } from "@/modules/react-query";

import { WorkProvider } from "@/providers/WorkProvider";
import { GardenProvider } from "@/providers/GardenProvider";

import { usePWA } from "@/providers/PWAProvider";
import { useUser } from "@/providers/UserProvider";

import Views from "@/views";
import Login from "@/views/Login";
import Landing from "@/views/Landing";
import { Appbar } from "@/components/Layout/AppBar";

const messages = {
  en: enMessages,
  pt: ptMessages,
};

function App() {
  const { authenticated } = usePrivy();
  const { isMobile, isInstalled, locale } = usePWA();
  const { isOnboarded, smartAccountReady } = useUser();

  console.log("isMobile", isMobile, isInstalled, locale);

  const isDownloaded = isMobile && isInstalled;
  const isAuthenticated = authenticated && smartAccountReady;

  return (
    <QueryClientProvider client={queryClient}>
      <IntlProvider locale={locale} messages={messages[locale]}>
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
            {/* Onboarding */}
            <Route
              path="/onboarding"
              element={
                isDownloaded ?
                  isAuthenticated && !isOnboarded ?
                    <div>Onboarding</div>
                  : <Navigate to="/" replace />
                : <Navigate to="/landing" replace />
              }
            />
            {/* Main: Show app or navigate to login, onboarding, or landing page based on conditions */}
            <Route
              path="/"
              element={
                isDownloaded ?
                  isAuthenticated ?
                    isOnboarded ?
                      <GardenProvider>
                        <WorkProvider>
                          <Views />
                          <Appbar />
                          <Toaster />
                        </WorkProvider>
                      </GardenProvider>
                    : <Navigate to="/onboarding" replace />
                  : <Navigate to="/login" replace />
                : <Navigate to="/landing" replace />
              }
            />
            {/* Catch-all: Redirect to the appropriate place */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </IntlProvider>
    </QueryClientProvider>
  );
}

export default App;
