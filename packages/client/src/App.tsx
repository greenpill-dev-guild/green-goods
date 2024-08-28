import { Toaster } from "react-hot-toast";
import { IntlProvider } from "react-intl";
import { usePrivy } from "@privy-io/react-auth";
import { Route, Routes, Navigate, BrowserRouter } from "react-router-dom";

import messages_en from "@/i18n/en.json";
import messages_es from "@/i18n/pt.json";

import { WorkProvider } from "@/providers/WorkProvider";
import { GardenProvider } from "@/providers/GardenProvider";

import { usePWA } from "@/providers/PWAProvider";
import { useUser } from "@/providers/UserProvider";

import Views from "@/views";
import { Appbar } from "@/components/AppBar";

const messages = {
  en: messages_en,
  pt: messages_es,
};

function App() {
  const { authenticated } = usePrivy();
  const { isMobile, isInstalled, locale } = usePWA();
  const { isOnboarded, smartAccountReady } = useUser();

  const isDownloaded = isInstalled && isMobile;
  const isAuthenticated = authenticated && smartAccountReady;

  return (
    <IntlProvider locale={locale} messages={messages[locale]}>
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

          {/* Onboarding Route */}
          <Route
            path="/onboarding"
            element={
              isAuthenticated && !isOnboarded ?
                <div>Onboarding</div>
              : <Navigate to="/" replace />
            }
          />

          {/* Main Route: Either show app or landing page based on conditions */}
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

          {/* Catch-all Route: Redirect to the appropriate place */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </IntlProvider>
  );
}

export default App;
