/**
 * IndexRoute — home ("/") entrypoint for the admin app.
 *
 * Previously the `/` route rendered CanvasLayout with no child element, causing
 * a blank MainSheet (the Outlet returned null). This route replaces that empty
 * child with one of four explicit terminal states:
 *
 * 1. Spinner — auth or eligible-gardens still loading
 * 2. Redirect to /hub — authenticated AND at least one eligible garden
 * 3. No-garden-access shell — authenticated but zero eligible gardens
 * 4. Wallet-required shell — authMode is "embedded" (admin requires a real wallet)
 * 5. Connect prompt — unauthenticated
 *
 * Mirrors the visual shell (AppBar + MainSheet) used elsewhere in the admin
 * so visual continuity is preserved between home and the rest of the canvas.
 */

import {
  AppBar,
  MainSheet,
  adminRoutes,
  queryKeys,
  useAuth,
  useCurrentChain,
  useEligibleAdminGardens,
} from "@green-goods/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useIntl } from "react-intl";
import { Navigate, useNavigate } from "react-router-dom";
import { ConnectButton } from "@/components/ConnectButton";
import { CanvasGardenAccessState } from "@/components/Layout/CanvasGardenAccessState";
import { CanvasIndexerErrorState } from "@/components/Layout/CanvasIndexerErrorState";
import { WalletRequiredConnectShell } from "@/components/Layout/ConnectShell";
import { SeedlingIllustration } from "@/components/Layout/SeedlingIllustration";

export default function IndexRoute() {
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const { isAuthenticated, eoaAddress, isReady, authMode, signOut } = useAuth();
  const {
    eligibleGardens,
    isLoaded: eligibleGardensLoaded,
    canCreateGarden,
    isError: eligibleGardensError,
  } = useEligibleAdminGardens();

  // Loading — mirrors the spinner inside CanvasLayout so there's no layout flash.
  if (!isReady || (isAuthenticated && !eligibleGardensLoaded)) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-bg-weak px-6"
        role="status"
        aria-label={intl.formatMessage({
          id: "app.admin.auth.checking",
          defaultMessage: "Checking authentication...",
        })}
      >
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-stroke-sub border-t-primary-base" />
      </div>
    );
  }

  // Embedded auth — admin requires a real wallet.
  if (authMode === "embedded") {
    return (
      <WalletRequiredConnectShell
        action={
          <button
            type="button"
            onClick={() => signOut()}
            className="inline-flex items-center justify-center rounded-md bg-[rgb(var(--ws-action,var(--primary-action)))] px-6 py-3 text-sm font-medium text-[rgb(var(--ws-on-action,var(--primary-action-foreground)))] transition hover:bg-[rgb(var(--ws-action-hover,var(--primary-action-hover)))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ws-action,var(--primary-action)))] focus-visible:ring-offset-2"
          >
            {intl.formatMessage({
              id: "app.admin.auth.signOutAndReconnect",
              defaultMessage: "Sign out & connect wallet",
            })}
          </button>
        }
      />
    );
  }

  // Unauthenticated — home canvas with AppBar + inline connect prompt.
  if (!isAuthenticated || !eoaAddress) {
    return (
      <div
        data-workspace="home"
        className="admin-m3 h-full min-h-0 workspace-canvas workspace-canvas-grid"
      >
        <div className="canvas-area-top">
          <AppBar
            gardenChip={
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-strong">
                <SeedlingIllustration className="h-5 w-5" />
                {intl.formatMessage({ id: "app.admin.brand", defaultMessage: "Green Goods" })}
              </span>
            }
          />
        </div>
        <MainSheet isReceded={false}>
          <main
            id="main-content"
            tabIndex={-1}
            className="flex min-h-full flex-col items-center justify-center px-6 py-16 text-center"
          >
            <SeedlingIllustration className="h-28 w-28" />
            <h1 className="mt-5 text-xl font-semibold text-text-strong">
              {intl.formatMessage({
                id: "app.admin.auth.connectRequired",
                defaultMessage: "Connect to continue",
              })}
            </h1>
            <p className="mt-2 max-w-md text-sm text-text-sub">
              {intl.formatMessage({
                id: "app.admin.auth.connectPrompt",
                defaultMessage: "Connect your wallet to access this feature.",
              })}
            </p>
            <div className="mt-6">
              <ConnectButton size="lg" />
            </div>
          </main>
        </MainSheet>
        <div className="canvas-area-bottom" />
      </div>
    );
  }

  // Authenticated with at least one eligible garden — redirect into the hub.
  // Note: `eligibleGardens` includes role-confirmed stubs from `useRole`, so an
  // operator with a stale or errored base list still lands on the hub instead
  // of the no-access shell.
  if (eligibleGardens.length > 0) {
    return <Navigate to={adminRoutes.hub()} replace />;
  }

  const homeShell = (children: React.ReactNode) => (
    <div
      data-workspace="home"
      className="admin-m3 h-full min-h-0 workspace-canvas workspace-canvas-grid"
    >
      <div className="canvas-area-top">
        <AppBar
          gardenChip={
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-strong">
              <SeedlingIllustration className="h-5 w-5" />
              {intl.formatMessage({ id: "app.admin.brand", defaultMessage: "Green Goods" })}
            </span>
          }
        />
      </div>
      <MainSheet isReceded={false}>
        <main id="main-content" tabIndex={-1} className="main-scroll-area h-full overflow-y-auto">
          {children}
        </main>
      </MainSheet>
      <div className="canvas-area-bottom" />
    </div>
  );

  // Indexer outage: distinguish "we can't load gardens" from "you have no
  // garden access". The previous ladder rendered the no-access copy in both
  // cases, which gaslit operators during incidents.
  if (eligibleGardensError) {
    return homeShell(
      <CanvasIndexerErrorState
        onRetry={() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.gardens.byChain(chainId) });
        }}
      />
    );
  }

  // Authenticated with zero eligible gardens — render the no-access CTA inside
  // the home shell so the surrounding canvas (AppBar + MainSheet) stays consistent.
  return homeShell(
    <CanvasGardenAccessState
      onCreateGarden={() => navigate(adminRoutes.gardenCreate())}
      canCreateGarden={canCreateGarden}
    />
  );
}
