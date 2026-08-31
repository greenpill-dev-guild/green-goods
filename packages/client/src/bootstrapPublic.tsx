import { AppProvider } from "@green-goods/shared/providers/App";
import { ServiceWorkerUpdateProvider } from "@green-goods/shared/hooks/app/useServiceWorkerUpdate";
import { HelmetProvider } from "react-helmet-async";

import { PublicApp } from "@/PublicApp";
import { AppErrorBoundary } from "@/components/Errors/AppErrorBoundary";
import { registerPublicWebMcpTools } from "@/webmcp";

registerPublicWebMcpTools();

export default function PublicBootstrap() {
  return (
    <HelmetProvider>
      <AppErrorBoundary>
        <AppProvider posthogKey={import.meta.env.VITE_POSTHOG_KEY}>
          <ServiceWorkerUpdateProvider>
            <PublicApp />
          </ServiceWorkerUpdateProvider>
        </AppProvider>
      </AppErrorBoundary>
    </HelmetProvider>
  );
}
