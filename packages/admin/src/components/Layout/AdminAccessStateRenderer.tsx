import { Button } from "@green-goods/shared/components/Button";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import type { AdminAccessState } from "@green-goods/shared/hooks/admin-ui/useAdminAccessState";
import { useCurrentChain } from "@green-goods/shared/hooks/blockchain/useChainConfig";
import { adminRoutes } from "@green-goods/shared/utils/navigation/admin-routes";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { AdminLoadingScreen } from "@/components/AdminLoadingScreen";
import { AdminSignInContainer } from "@/components/AdminSignIn";
import {
  clearPasskeyRequestAtBoot,
  isEmailSignInOfferedAtBoot,
} from "@/components/Boot/bootPasskeyRequest";
import { CanvasGardenAccessState } from "./CanvasGardenAccessState";
import { CanvasIndexerErrorState } from "./CanvasIndexerErrorState";
import { AdminAccessHomeShell } from "./CanvasLayout";
import { ConnectPrompt } from "./ConnectPrompt";
import { WalletRequiredConnectShell } from "./ConnectShell";
import { StewardAccessRequestContainer } from "./StewardAccessRequest";

interface AdminAccessStateRendererProps {
  state: AdminAccessState;
  ready: ReactNode;
}

export function AdminAccessStateRenderer({ state, ready }: AdminAccessStateRendererProps) {
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  // Every state but these two has a session: ready, no access, an embedded wallet, or an
  // indexer that failed after sign-in.
  const signedIn = state.status !== "checking" && state.status !== "disconnected";
  // A passkey chosen at boot is for the sign-in that follows. A session that opens without
  // that sign-in (another tab signed in meanwhile) lets it go, so a later sign-out starts at
  // the entry.
  useEffect(() => {
    if (signedIn) clearPasskeyRequestAtBoot();
  }, [signedIn]);

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
          <Button
            size="sm"
            type="button"
            onClick={() => {
              void state.signOut();
            }}
          >
            {intl.formatMessage({
              id: "app.admin.auth.signOutAndReconnect",
              defaultMessage: "Sign Out & Sign In Again",
            })}
          </Button>
        }
      />
    );
  }

  if (state.status === "disconnected") {
    // The same connect surface as the boot screen, so a steward sees one sign-in
    // whichever route, reload or sign-out brought them here.
    return (
      <main id="main-content" tabIndex={-1} key="signed-out">
        <ConnectPrompt
          title={intl.formatMessage({
            id: "app.admin.auth.connectRequired",
            defaultMessage: "Connect to continue",
          })}
          description={intl.formatMessage(
            isEmailSignInOfferedAtBoot()
              ? {
                  id: "app.admin.auth.connectPromptWithEmail",
                  defaultMessage:
                    "Sign in with a passkey, your email or a wallet to open the Green Goods Hub.",
                }
              : {
                  id: "app.admin.auth.connectPrompt",
                  defaultMessage:
                    "Connect your wallet or sign in with a passkey to open the Green Goods Hub.",
                }
          )}
          action={<AdminSignInContainer />}
          testId="admin-sign-in-shell"
        />
      </main>
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
          stewardAccess={<StewardAccessRequestContainer showStatus />}
        />
      </main>
    </AdminAccessHomeShell>
  );
}
