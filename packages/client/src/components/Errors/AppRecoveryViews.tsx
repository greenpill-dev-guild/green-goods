import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { APP_ROUTES, isImmersiveAppRoute } from "@/config/pwaRouting";
import { AppLaunchError } from "./AppLaunchError";
import { AppScreenError } from "./AppScreenError";
import {
  type RecoveryScreenProps,
  type RecoveryViews,
  RecoveryViewsContext,
} from "./ErrorRecovery";

/** A screen that hides the bottom bar has no other way out, so it gets its own way back. */
function AppScreenRecovery(props: RecoveryScreenProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return (
    <AppScreenError
      {...props}
      onBack={isImmersiveAppRoute(pathname) ? () => navigate(APP_ROUTES.home) : undefined}
    />
  );
}

const APP_RECOVERY_VIEWS: RecoveryViews = {
  frame: AppLaunchError,
  screen: AppScreenRecovery,
};

/**
 * The installed app's recovery screens. It sits outside every boundary in the app's entry, so the
 * outermost one can still read it, and it holds nothing that can fail.
 */
export function AppRecoveryViews({ children }: { children: ReactNode }) {
  return (
    <RecoveryViewsContext.Provider value={APP_RECOVERY_VIEWS}>
      {children}
    </RecoveryViewsContext.Provider>
  );
}
