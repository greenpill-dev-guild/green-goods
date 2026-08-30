import { AppProvider } from "@green-goods/shared/providers/App";
import { ServiceWorkerUpdateProvider } from "@green-goods/shared/hooks/app/useServiceWorkerUpdate";
import { HelmetProvider } from "react-helmet-async";

import { PwaApp } from "@/PwaApp";
import { AppErrorBoundary } from "@/components/Errors/AppErrorBoundary";

export default function PwaBootstrap() {
  return (
    <HelmetProvider>
      <AppErrorBoundary>
        <AppProvider posthogKey={import.meta.env.VITE_POSTHOG_KEY}>
          <ServiceWorkerUpdateProvider>
            <PwaApp />
          </ServiceWorkerUpdateProvider>
        </AppProvider>
      </AppErrorBoundary>
    </HelmetProvider>
  );
}
