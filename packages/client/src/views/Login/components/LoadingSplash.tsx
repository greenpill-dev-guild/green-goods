import { APP_NAME, cn } from "@green-goods/shared";
import { useIntl } from "react-intl";

import type { LoadingState } from "@/components/Layout";
import { pwaStatusStyles } from "@/styles/pwaStatusStyles";

interface LoadingSplashProps {
  loadingState: LoadingState;
  message?: string;
}

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
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg-white-0 px-4 pb-12 pt-[12vh]">
      <div className="flex w-full max-w-sm flex-col items-center">
        <div className="flex-shrink-0 mb-6">
          <img
            src="/icon.png"
            alt={APP_NAME}
            // Same wide GG logomark + treatment as Splash so the login →
            // loading transition doesn't jump the logo's size or shape.
            width={819}
            height={464}
            className="h-24 w-auto sm:h-28 animate-pulse transition-opacity duration-[var(--spring-effects-slow-duration)] ease-[var(--spring-effects-slow-easing)]"
          />
        </div>

        <div className="h-8 flex items-center justify-center mb-6">
          <h3 className="text-center font-bold text-primary transition-colors duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)]">
            {displayMessage}
          </h3>
        </div>

        <div className="w-full flex flex-col items-center gap-3 h-[100px]">
          <div className="w-full h-10 flex items-center justify-center">
            <div
              className={cn(
                "h-10 w-10 animate-spin rounded-full border-4 border-primary-alpha-24",
                pwaStatusStyles.primary.spinnerBorder
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
