import { AppProvider } from "@green-goods/shared/providers/App";
import { ServiceWorkerUpdateProvider } from "@green-goods/shared/hooks/app/useServiceWorkerUpdate";
import { HelmetProvider } from "react-helmet-async";

import { PublicApp } from "@/PublicApp";
import { AppErrorBoundary } from "@/components/Errors/AppErrorBoundary";
import { PublicRecoveryViews } from "@/components/Errors/PublicRecoveryViews";
import { registerPublicWebMcpTools } from "@/webmcp";
import { afterPublicContentPaint } from "@/config/publicStartup";
import { importPublicLocaleCatalogue } from "@/views/Public/publicLocaleCatalogue";

registerPublicWebMcpTools();

export default function PublicBootstrap() {
  return (
    // The recovery screens sit outside every boundary, so the outermost one can read them.
    <PublicRecoveryViews>
      <HelmetProvider>
        <AppErrorBoundary view="frame">
          <AppProvider
            posthogKey={import.meta.env.VITE_POSTHOG_KEY}
            scheduleTelemetry={afterPublicContentPaint}
            importCatalogue={importPublicLocaleCatalogue}
          >
            <ServiceWorkerUpdateProvider>
              <PublicApp />
            </ServiceWorkerUpdateProvider>
          </AppProvider>
        </AppErrorBoundary>
      </HelmetProvider>
    </PublicRecoveryViews>
  );
}
