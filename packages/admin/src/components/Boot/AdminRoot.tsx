import { ErrorBoundary } from "@green-goods/shared/components/ErrorBoundary/ErrorBoundary";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import {
  createQueryPersister,
  createShouldDehydrateQuery,
  PERSIST_MAX_AGE,
} from "@green-goods/shared/config/query-persistence";
import { queryClient } from "@green-goods/shared/config/react-query";
import { AppProvider } from "@green-goods/shared/providers/App";
import { AppKitProvider } from "@green-goods/shared/providers/AppKitProvider";
import { AuthGate } from "@green-goods/shared/providers/AuthGate";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import App from "@/App.tsx";
import { ADMIN_QUERY_PERSISTENCE_DB } from "./bootConstants";

// Never throws: the persister degrades to an in-memory session when the
// browser blocks IndexedDB or web storage.
const persister = createQueryPersister({ dbName: ADMIN_QUERY_PERSISTENCE_DB });
const shouldDehydrateQuery = createShouldDehydrateQuery({
  excludedGroups: ["queue", "role"],
});

const adminAppUrl =
  import.meta.env.VITE_ADMIN_APP_URL ||
  (typeof window !== "undefined" ? window.location.origin : "https://admin.greengoods.app");

/**
 * The admin application tree: query persistence, the app error boundary,
 * wallet connection, authentication, the app provider and the router. Loaded
 * by the boot sequence after the boot shell is already on screen, so a failure
 * anywhere in this graph surfaces as a recovery card rather than a blank root.
 */
export default function AdminRoot() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: PERSIST_MAX_AGE,
        dehydrateOptions: { shouldDehydrateQuery },
      }}
    >
      <ErrorBoundary context="AdminApp">
        <AppKitProvider
          projectId={import.meta.env.VITE_WALLETCONNECT_PROJECT_ID}
          metadata={{
            name: "Green Goods Admin",
            description: "Garden management canvas for the Green Goods protocol",
            url: adminAppUrl,
            icons: ["https://greengoods.app/icon.png"],
          }}
          defaultChainId={DEFAULT_CHAIN_ID}
        >
          {/* AuthGate: uses DevAuthProvider when ?mockAuth= param is present in dev, else real AuthProvider */}
          <AuthGate>
            <AppProvider
              posthogKey={import.meta.env.VITE_POSTHOG_ADMIN_KEY}
              allowPosthogKeyFallback={false}
            >
              <App />
            </AppProvider>
          </AuthGate>
        </AppKitProvider>
      </ErrorBoundary>
    </PersistQueryClientProvider>
  );
}
