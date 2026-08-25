import type { IntlShape } from "react-intl";
import type { InstallGuidance } from "../../app/useInstallGuidance";
import type { Platform } from "../../../utils/app/pwa";

export function getBrowserGuidanceLabel(
  guidance: InstallGuidance,
  platform: Platform,
  intl: IntlShape
): string {
  if (guidance.scenario === "in-app-browser") {
    return platform === "android" && guidance.openInBrowserUrl
      ? intl.formatMessage({
          id: "app.login.guidance.openInChrome",
          defaultMessage: "Open in Chrome for best experience",
        })
      : intl.formatMessage({
          id: "app.login.guidance.copyLinkSafari",
          defaultMessage: "Copy link & open in Safari",
        });
  }
  return platform === "ios"
    ? intl.formatMessage({
        id: "app.login.guidance.openInSafari",
        defaultMessage: "For best experience, open in Safari",
      })
    : intl.formatMessage({
        id: "app.login.guidance.openInChrome",
        defaultMessage: "Open in Chrome for best experience",
      });
}

export function getFriendlyLoginErrorMessage(error: unknown, intl: IntlShape): string {
  if (!(error instanceof Error)) {
    return intl.formatMessage({
      id: "app.login.error.generic",
      defaultMessage: "Something went wrong. Please try again.",
    });
  }
  const message = error.message.toLowerCase();
  if (
    message.includes("cancel") ||
    message.includes("abort") ||
    message.includes("user deny") ||
    message.includes("not allowed")
  ) {
    return intl.formatMessage({
      id: "app.login.error.cancelled",
      defaultMessage: "Sign in was cancelled.",
    });
  }
  if (
    message.includes("expected account address") ||
    message.includes("address mismatch") ||
    message.includes("did not match the expected account")
  ) {
    return intl.formatMessage({
      id: "app.login.error.addressMismatch",
      defaultMessage: "That passkey is for a different account.",
    });
  }
  if (message.includes("already registered") || message.includes("recovery name")) {
    return intl.formatMessage({
      id: "app.login.error.recoveryNameTaken",
      defaultMessage: "That name is already registered.",
    });
  }
  if (message.includes("network") || message.includes("timeout") || message.includes("fetch")) {
    return intl.formatMessage({
      id: "app.login.error.network",
      defaultMessage: "Passkey recovery is temporarily unavailable.",
    });
  }
  if (
    message.includes("not support") ||
    message.includes("unsupported browser") ||
    message.includes("passkey unavailable") ||
    message.includes("passkeys aren't available") ||
    message.includes("passkeys are not available") ||
    message.includes("webauthn unavailable")
  ) {
    return intl.formatMessage({
      id: "app.login.error.passkeyUnavailable",
      defaultMessage: "Passkeys aren't available in this browser.",
    });
  }
  if (
    message.includes("no passkey found") ||
    message.includes("no passkey credential") ||
    message.includes("no credential")
  ) {
    return intl.formatMessage({
      id: "app.login.error.noPasskey",
      defaultMessage: "No passkey found for that username.",
    });
  }
  if (message.includes("credential") || message.includes("passkey")) {
    return intl.formatMessage({
      id: "app.login.error.passkeyVerification",
      defaultMessage: "We couldn't verify your passkey.",
    });
  }
  if (message.includes("at least 3 characters")) {
    return intl.formatMessage({
      id: "app.login.error.usernameTooShort",
      defaultMessage: "Display name must be at least 3 characters.",
    });
  }
  return intl.formatMessage({
    id: "app.login.error.generic",
    defaultMessage: "Something went wrong. Please try again.",
  });
}
