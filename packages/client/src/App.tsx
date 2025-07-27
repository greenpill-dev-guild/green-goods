import { usePrivy } from "@privy-io/react-auth";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import { queryClient } from "@/modules/react-query";
import { createAppRouter } from "@/routes";
import { useApp } from "@/providers/app";
import { useUser } from "@/providers/user";
import { SocialPreview } from "@/components/SocialPreview";

function App() {
  const { authenticated } = usePrivy();
  const { isMobile, isInstalled } = useApp();
  const { ready, smartAccountAddress } = useUser();

  const isDownloaded = (isMobile && isInstalled) || import.meta.env.VITE_DESKTOP_DEV;
  const isAuthenticated = authenticated && smartAccountAddress;

  // Create router with current auth state
  const router = createAppRouter(queryClient, {
    authenticated,
    isDownloaded,
    isAuthenticated,
    ready
  });

  return (
    <QueryClientProvider client={queryClient}>
      <SocialPreview />
      <RouterProvider router={router} />
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#059669',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </QueryClientProvider>
  );
}

export default App;
