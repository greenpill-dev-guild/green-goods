import {
  useWorkUpdateGuard,
  isWorkUpdateBlocked,
} from "@green-goods/shared/hooks/app/useWorkUpdateGuard";
import { AppProvider } from "@green-goods/shared/providers/App";
import { ServiceWorkerUpdateProvider } from "@green-goods/shared/hooks/app/useServiceWorkerUpdate";
import { HelmetProvider } from "react-helmet-async";

import { PwaApp } from "@/PwaApp";
import { AppErrorBoundary } from "@/components/Errors/AppErrorBoundary";

export default function PwaBootstrap() {
  const activationBlocked = useWorkUpdateGuard();
  return (
    <HelmetProvider>
      <AppErrorBoundary>
        <AppProvider posthogKey={import.meta.env.VITE_POSTHOG_KEY}>
          <ServiceWorkerUpdateProvider
            activationBlocked={activationBlocked}
            isActivationBlocked={isWorkUpdateBlocked}
          >
            <PwaApp />
          </ServiceWorkerUpdateProvider>
        </AppProvider>
      </AppErrorBoundary>
    </HelmetProvider>
  );
}
