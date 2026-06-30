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
 * Full-screen spinner shown DURING an auth attempt. It renders through the same
 * `SplashScaffold` as `Splash` and leaves the username/callout, error, notice, and
 * tertiary slots empty (but reserved). So the logo sits at the EXACT same Y and the
 * spinner lands in the SAME slot the login button occupied — the Splash↔LoadingSplash
 * swap morphs the button into the spinner in place, with no logo or layout jump.
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
      action={
        <div className="w-full h-10 flex items-center justify-center">
          <div
            className={cn(
              "h-10 w-10 animate-spin rounded-full border-4 border-primary-alpha-24",
              pwaStatusStyles.primary.spinnerBorder
            )}
          />
        </div>
      }
    />
  );
}
