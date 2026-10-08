import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import type { AdminAccessState } from "@green-goods/shared/hooks/admin-ui/useAdminAccessState";
import { useCurrentChain } from "@green-goods/shared/hooks/blockchain/useChainConfig";
import { adminRoutes } from "@green-goods/shared/utils/navigation/admin-routes";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { AdminButton } from "@/components/AdminButton";
import { AdminLoadingScreen } from "@/components/AdminLoadingScreen";
import { AdminSignInContainer } from "@/components/AdminSignIn";
import { CanvasGardenAccessState } from "./CanvasGardenAccessState";
import { CanvasIndexerErrorState } from "./CanvasIndexerErrorState";
import { AdminAccessHomeShell } from "./CanvasLayout";
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
      <AdminLoadingScreen
        label={intl.formatMessage({
          id: "app.admin.loading.opening",
          defaultMessage: "Opening your workspace…",
        })}
        locale={intl.locale}
      />
    );
  }

  if (state.status === "embedded-wallet") {
    return (
      <WalletRequiredConnectShell
        action={
          <AdminButton
            type="button"
            onClick={() => {
              void state.signOut();
            }}
          >
            {intl.formatMessage({
              id: "app.admin.auth.signOutAndReconnect",
              defaultMessage: "Sign Out & Connect Wallet",
            })}
          </AdminButton>
        }
      />
    );
  }

  if (state.status === "disconnected") {
    return (
      <AdminAccessHomeShell key="signed-out">
        <main
          id="main-content"
          tabIndex={-1}
          className="flex min-h-full flex-col items-center justify-center px-6 py-16 text-center"
        >
          <SeedlingIllustration className="h-28 w-28" />
          <h1 className="mt-5 text-title-lg font-semibold leading-[var(--type-title-lg-lh)] text-text-strong">
            {intl.formatMessage({
              id: "app.admin.auth.connectRequired",
              defaultMessage: "Connect to continue",
            })}
          </h1>
          <p className="mt-2 max-w-md body-sm text-text-sub">
            {intl.formatMessage({
              id: "app.admin.auth.connectPrompt",
              defaultMessage:
                "Connect your wallet or sign in with a passkey to access this feature.",
            })}
          </p>
          <div className="mt-6 w-full max-w-sm">
            <AdminSignInContainer />
          </div>
        </main>
      </AdminAccessHomeShell>
    );
  }

  if (state.status === "indexer-error") {
    return (
      <AdminAccessHomeShell key="signed-in" showProfile>
        <main id="main-content" tabIndex={-1} className="main-scroll-area h-full overflow-y-auto">
          <CanvasIndexerErrorState
            onRetry={() => {
              void Promise.all([
                queryClient.invalidateQueries({ queryKey: queryKeys.gardens.byChain(chainId) }),
                queryClient.invalidateQueries({ queryKey: queryKeys.role.all }),
              ]);
            }}
          />
        </main>
      </AdminAccessHomeShell>
    );
  }

  return (
    <AdminAccessHomeShell key="signed-in" showProfile>
      <main id="main-content" tabIndex={-1} className="main-scroll-area h-full overflow-y-auto">
        <CanvasGardenAccessState
          onCreateGarden={() => navigate(adminRoutes.gardenCreate())}
          canCreateGarden={state.canCreateGarden}
        />
      </main>
    </AdminAccessHomeShell>
  );
}
