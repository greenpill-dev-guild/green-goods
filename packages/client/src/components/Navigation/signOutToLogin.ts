import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { debugError } from "@green-goods/shared/utils/debug";
import type { IntlShape } from "react-intl";
import type { NavigateFunction } from "react-router-dom";
import { APP_ROUTES } from "@/config/pwaRouting";

/**
 * Signs the account out and lands on sign-in, saying which happened. Profile and the top bar's
 * account sheet share it, so the two ways out end in the same place with the same words.
 */
export async function signOutToLogin({
  signOut,
  navigate,
  intl,
}: {
  signOut: () => Promise<void>;
  navigate: NavigateFunction;
  intl: IntlShape;
}): Promise<boolean> {
  try {
    await signOut();
    navigate(APP_ROUTES.login, {
      replace: true,
      state: { fromLogout: true },
      viewTransition: true,
    });
    toastService.success({
      title: intl.formatMessage({ id: "app.account.sessionClosed", defaultMessage: "Signed out" }),
      context: "logout",
      suppressLogging: true,
    });
    return true;
  } catch (err) {
    debugError("Logout failed", err);
    toastService.error({
      title: intl.formatMessage({
        id: "app.account.logoutFailed",
        defaultMessage: "Failed to log out",
      }),
      message: intl.formatMessage({
        id: "app.account.logoutRetry",
        defaultMessage: "Please try again.",
      }),
      context: "logout",
      error: err,
    });
    return false;
  }
}
