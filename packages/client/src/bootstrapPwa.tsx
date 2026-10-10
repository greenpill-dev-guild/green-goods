import {
  useWorkUpdateGuard,
  isWorkUpdateBlocked,
} from "@green-goods/shared/hooks/app/useWorkUpdateGuard";
import { AppProvider } from "@green-goods/shared/providers/App";
import { ServiceWorkerUpdateProvider } from "@green-goods/shared/hooks/app/useServiceWorkerUpdate";
import { HelmetProvider } from "react-helmet-async";

import { PwaApp } from "@/PwaApp";
import { AppErrorBoundary } from "@/components/Errors/AppErrorBoundary";
import { AppRecoveryViews } from "@/components/Errors/AppRecoveryViews";

export default function PwaBootstrap() {
  const activationBlocked = useWorkUpdateGuard();
  return (
    // The recovery screens sit outside every boundary, so the outermost one can read them.
    <AppRecoveryViews>
      <HelmetProvider>
        <AppErrorBoundary view="frame">
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
    </AppRecoveryViews>
  );
}
