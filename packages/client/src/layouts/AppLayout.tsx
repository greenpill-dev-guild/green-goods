import { QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Navigate } from "react-router-dom";
import { usePrivy } from "@privy-io/react-auth";
import { useUser } from "@/providers/user";
import { useApp } from "@/providers/app";
import { GardensProvider } from "@/providers/garden";
import { WorkProvider } from "@/providers/work";
import { queryClient } from "@/modules/react-query";
import { AppBar } from "@/components/Layout/AppBar";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "react-hot-toast";

export const AppLayout = () => {
  const { authenticated } = usePrivy();
  const { ready, smartAccountAddress } = useUser();
  const { isMobile, isInstalled } = useApp();

  const isDownloaded = (isMobile && isInstalled) || import.meta.env.VITE_DESKTOP_DEV;
  const isAuthenticated = authenticated && smartAccountAddress;

  // Desktop browsers are redirected to landing
  if (!isMobile) {
    return <Navigate to="/landing" replace />;
  }

  // If the app is installed, force authentication before showing content
  if (isDownloaded && !isAuthenticated && !ready) {
    return <Navigate to="/login" replace />;
  }

  const showAppBar = isDownloaded; // Only show AppBar for installed PWA / native wrapper

  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <GardensProvider>
          <WorkProvider>
            <Outlet />
            {showAppBar && <AppBar />}
            <Toaster />
          </WorkProvider>
        </GardensProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
};