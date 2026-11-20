import { ErrorBoundary } from "@green-goods/shared/components/ErrorBoundary/ErrorBoundary";
import { HUB_URL } from "@green-goods/shared/config/app";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import {
  createQueryPersistence,
  createShouldDehydrateQuery,
} from "@green-goods/shared/config/query-persistence";
import { queryClient } from "@green-goods/shared/config/react-query";
import { AppKitProvider } from "@green-goods/shared/providers/AppKitProvider";
import { AuthGate } from "@green-goods/shared/providers/AuthGate";
import {
  attachQueryPersistence,
  QueryPersistenceProvider,
} from "@green-goods/shared/providers/QueryPersistence";
import { lazy, Suspense } from "react";
import { ADMIN_LEGACY_QUERY_PERSISTENCE, ADMIN_QUERY_PERSISTENCE_DB } from "./bootConstants";
import { AdminStartupConnect } from "./AdminStartupConnect";
import { BootShell } from "./BootSurface";

const AdminWorkspace = lazy(() => import("./AdminWorkspace"));

// Never throws: the reading cache degrades to an in-memory session when the
// browser blocks IndexedDB or web storage.
const persistence = createQueryPersistence({
  dbName: ADMIN_QUERY_PERSISTENCE_DB,
  legacy: ADMIN_LEGACY_QUERY_PERSISTENCE,
  shouldPersistQuery: createShouldDehydrateQuery({ excludedGroups: ["queue", "role"] }),
});
attachQueryPersistence(queryClient, persistence);

// WalletConnect verifies the requesting origin, so the Hub names the host it is served from
// (admin.greengoods.app or hub.greengoods.app); a retired build-time URL breaks that match.
const adminAppUrl = typeof window !== "undefined" ? window.location.origin : HUB_URL;
// A wallet shows this beside the request, cropped to a square, so it is the Hub's own square
// app icon, served by the Hub itself, not the App's wide logo, which wallets clip (PRD-1533).
const adminIconUrl =
  typeof window !== "undefined"
    ? new URL(`${import.meta.env.BASE_URL}hub-icon-512.png`, window.location.href).href
    : `${HUB_URL}/hub-icon-512.png`;

/**
 * The admin application tree: query persistence, the app error boundary,
 * wallet connection, authentication, the app provider and the router. Loaded
 * by the boot sequence after the boot shell is already on screen, so a failure
 * anywhere in this graph surfaces as a recovery card rather than a blank root.
 */
export default function AdminRoot({
  connectWalletOnReady = false,
  onWorkspaceReady,
}: {
  connectWalletOnReady?: boolean;
  onWorkspaceReady?: () => void;
}) {
  return (
    <QueryPersistenceProvider client={queryClient} persistence={persistence}>
      <ErrorBoundary context="AdminApp">
        <AppKitProvider
          projectId={import.meta.env.VITE_WALLETCONNECT_PROJECT_ID}
          metadata={{
            name: "Green Goods Hub",
            description: "Garden management for Green Goods stewards",
            url: adminAppUrl,
            icons: [adminIconUrl],
          }}
          defaultChainId={DEFAULT_CHAIN_ID}
          fontFamily={'"Plus Jakarta Sans", system-ui, sans-serif'}
        >
          {/* AuthGate: uses DevAuthProvider when ?mockAuth= param is present in dev, else real AuthProvider */}
          <AuthGate>
            <AdminStartupConnect requested={connectWalletOnReady}>
              <Suspense fallback={<BootShell />}>
                <AdminWorkspace onReady={onWorkspaceReady} />
              </Suspense>
            </AdminStartupConnect>
          </AuthGate>
        </AppKitProvider>
      </ErrorBoundary>
    </QueryPersistenceProvider>
  );
}
