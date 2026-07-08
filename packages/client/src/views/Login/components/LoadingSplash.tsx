import { APP_NAME, cn } from "@green-goods/shared";
import { useIntl } from "react-intl";

import type { LoadingState } from "@/components/Layout";
import { SplashScaffold } from "@/components/Layout/SplashScaffold";
import { pwaStatusStyles } from "@/styles/pwaStatusStyles";

interface LoadingSplashProps {
  loadingState: LoadingState;
  message?: string;
}

/**
 * Full-screen spinner for the pre-auth BOOT state (`!isReady`), before any
 * login screen exists to host an in-button spinner. It renders through the
 * same `SplashScaffold` as `Splash` with only the title and slot 1 filled, so
 * the logo sits at the EXACT same Y as every login state and the spinner
 * morphs into the entry screen's primary (which lives in slot 1). (In-flight
 * auth attempts no longer swap to this component — the primary button shows
 * its own spinner in place.)
 */
export function LoadingSplash({ loadingState, message }: LoadingSplashProps) {
  const { formatMessage } = useIntl();
  const stateMessages: Record<LoadingState, string> = {
    welcome: formatMessage({
      id: "app.login.loading.welcome",
      defaultMessage: "Welcome",
    }),
    "joining-garden": formatMessage({
      id: "app.login.loading.joiningGarden",
      defaultMessage: "Joining garden...",
    }),
    default: formatMessage({
      id: "app.login.loading.default",
      defaultMessage: "Loading...",
    }),
  };
  const displayMessage = message || stateMessages[loadingState] || APP_NAME;

  return (
    <SplashScaffold
      pulse
      title={displayMessage}
      slotOne={
        <div
          className={cn(
            "h-10 w-10 animate-spin rounded-full border-4 border-primary-alpha-24",
            pwaStatusStyles.primary.spinnerBorder
          )}
        />
      }
    />
  );
}
