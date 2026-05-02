import {
  AppBar,
  MainSheet,
  adminRoutes,
  queryKeys,
  useCurrentChain,
  type AdminAccessState,
} from "@green-goods/shared";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { ConnectButton } from "@/components/ConnectButton";
import { CanvasGardenAccessState } from "./CanvasGardenAccessState";
import { CanvasIndexerErrorState } from "./CanvasIndexerErrorState";
import { WalletRequiredConnectShell } from "./ConnectShell";
import { SeedlingIllustration } from "./SeedlingIllustration";

interface AdminAccessStateRendererProps {
  state: AdminAccessState;
  ready: ReactNode;
}

export function AdminAccessStateRenderer({ state, ready }: AdminAccessStateRendererProps) {
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();

  if (state.status === "ready") {
    return <>{ready}</>;
  }

  if (state.status === "checking") {
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

  if (state.status === "embedded-wallet") {
    return (
      <WalletRequiredConnectShell
        action={
          <button
            type="button"
            onClick={() => {
              void state.signOut();
            }}
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

  if (state.status === "disconnected") {
    return (
      <AdminAccessHomeShell>
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
      </AdminAccessHomeShell>
    );
  }

  if (state.status === "indexer-error") {
    return (
      <AdminAccessHomeShell>
        <main id="main-content" tabIndex={-1} className="main-scroll-area h-full overflow-y-auto">
          <CanvasIndexerErrorState
            onRetry={() => {
              void queryClient.invalidateQueries({ queryKey: queryKeys.gardens.byChain(chainId) });
            }}
          />
        </main>
      </AdminAccessHomeShell>
    );
  }

  return (
    <AdminAccessHomeShell>
      <main id="main-content" tabIndex={-1} className="main-scroll-area h-full overflow-y-auto">
        <CanvasGardenAccessState
          onCreateGarden={() => navigate(adminRoutes.gardenCreate())}
          canCreateGarden={state.canCreateGarden}
        />
      </main>
    </AdminAccessHomeShell>
  );
}

function AdminAccessHomeShell({ children }: { children: ReactNode }) {
  const intl = useIntl();

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
      <MainSheet isReceded={false}>{children}</MainSheet>
      <div className="canvas-area-bottom" />
    </div>
  );
}
