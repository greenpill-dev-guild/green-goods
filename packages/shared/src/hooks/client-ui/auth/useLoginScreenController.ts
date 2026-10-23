import { useCallback, useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useLocation } from "react-router-dom";
import { toastService } from "../../../components/Toast/toast.service";
import {
  classifyPasskeyCeremonyContext,
  isPasskeyServerEnabled,
  normalizePasskeyAccountIdentifier,
} from "../../../config/passkeyServer";
import { trackAuthError } from "../../../modules/app/error-categories";
import { getStoredOriginalAccountAddress, getStoredUsername } from "../../../modules/auth/session";
import { PILOT_PASSKEY_PROFILE } from "../../../modules/auth/account-profile";
import {
  PilotAccountProofError,
  type PilotAccountPreview,
  type PilotAccountQuote,
} from "../../../modules/auth/pilot-account-enrollment";
import { logger } from "../../../modules/app/logger";
import { useApp } from "../../../providers/App";
import { copyToClipboard } from "../../../utils/app/clipboard";
import { debugError } from "../../../utils/debug";
import { useInstallGuidance } from "../../app/useInstallGuidance";
import { useAuth } from "../../auth/useAuth";
import { getBrowserGuidanceLabel, getFriendlyLoginErrorMessage } from "./login-screen-messages";

export type LoginScreen = "entry" | "create" | "recover";

export function useLoginScreenController(routes: { login: string; home: string }) {
  const intl = useIntl();
  const location = useLocation();
  const auth = useAuth();
  const { platform, isMobile, isInstalling, wasInstalled, installedAppEvidence, deferredPrompt } =
    useApp();
  const guidance = useInstallGuidance({
    platform,
    installedAppEvidence,
    wasInstalled,
    deferredPrompt,
    isMobile,
    isInstalling,
  });
  const [loadingState, setLoadingState] = useState<"welcome" | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [recoveryUsername, setRecoveryUsername] = useState("");
  const [screen, setScreen] = useState<LoginScreen>("entry");
  const pilotInvitation = new URLSearchParams(location.search).get("pilot") === "1";
  let originalAccountAddress: string | null = null;
  try {
    if (!auth.isAuthenticated && auth.loginWithOriginalPasskey)
      originalAccountAddress = getStoredOriginalAccountAddress();
  } catch {
    /* Malformed profile metadata never selects a different account. */
  }
  const [pilotPreview, setPilotPreview] = useState<PilotAccountPreview | null>(null);
  const [pilotQuote, setPilotQuote] = useState<PilotAccountQuote | null>(null);
  const [pilotBusy, setPilotBusy] = useState(false);
  const [pilotError, setPilotError] = useState<string | null>(null);
  const [pilotSkipped, setPilotSkipped] = useState(false);
  const pilotMounted = useRef(true);
  const cancelPilotEnrollment = auth.cancelPilotAccountEnrollment;
  useEffect(() => {
    pilotMounted.current = true;
    return () => {
      pilotMounted.current = false;
      cancelPilotEnrollment?.();
    };
  }, [cancelPilotEnrollment]);
  const canDiscoverPilot =
    pilotInvitation &&
    auth.isAuthenticated &&
    auth.authMode === "passkey" &&
    auth.passkeyAccountProfile !== PILOT_PASSKEY_PROFILE &&
    Boolean(auth.preparePilotAccount);

  const runPilotAction = async (operation: () => Promise<void>) => {
    setPilotBusy(true);
    setPilotError(null);
    try {
      await operation();
    } catch (error) {
      if (!pilotMounted.current) return;
      logger.warn("[Auth] Pilot account review failed", { error });
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      const errorKey =
        error instanceof PilotAccountProofError && error.pending
          ? "pending"
          : message.includes("sponsor") || message.includes("fee ceiling")
            ? "sponsorshipUnavailable"
            : message.includes("quote")
              ? "quoteChanged"
              : "operationFailed";
      setPilotError(intl.formatMessage({ id: `app.login.pilot.${errorKey}` }));
      setPilotQuote(null);
      if (error instanceof PilotAccountProofError)
        setPilotPreview((previous) =>
          previous ? { ...previous, pending: error.pending } : previous
        );
    } finally {
      if (pilotMounted.current) setPilotBusy(false);
    }
  };
  const reviewPilotAccount = () =>
    runPilotAction(async () => {
      if (!auth.preparePilotAccount) throw new Error("Pilot account preparation is unavailable");
      setPilotPreview(await auth.preparePilotAccount());
      setPilotQuote(null);
    });
  const quotePilotProof = () =>
    runPilotAction(async () => {
      if (!auth.quotePilotAccount) throw new Error("Pilot proof quotation is unavailable");
      setPilotQuote(await auth.quotePilotAccount());
    });
  const confirmPilotAccount = () =>
    runPilotAction(async () => {
      if (!auth.confirmPilotAccount) throw new Error("Pilot account selection is unavailable");
      await auth.confirmPilotAccount(pilotQuote?.operationHash);
    });
  const reconcilePilotProof = () =>
    runPilotAction(async () => {
      if (!auth.reconcilePilotAccount) throw new Error("Pilot proof reconciliation is unavailable");
      await auth.reconcilePilotAccount();
    });
  const keepOriginalAccount = () => {
    auth.cancelPilotAccountEnrollment?.();
    setPilotSkipped(true);
    setPilotPreview(null);
    setPilotQuote(null);
  };
  const recoveryAttemptNameRef = useRef<string | null>(null);
  // Whether the attempt in flight creates an account: a prompt that closes then made none.
  const creatingRef = useRef(false);
  const passkeyServerEnabled = isPasskeyServerEnabled();

  useEffect(() => {
    if (!auth.isAuthenticated) return;
    const attempted = recoveryAttemptNameRef.current;
    recoveryAttemptNameRef.current = null;
    if (
      !attempted ||
      !auth.userName ||
      normalizePasskeyAccountIdentifier(auth.userName) ===
        normalizePasskeyAccountIdentifier(attempted)
    ) {
      return;
    }
    toastService.show({
      status: "info",
      title: intl.formatMessage({
        id: "app.login.toast.fallbackAccountTitle",
        defaultMessage: "Signed in with this device's passkey",
      }),
      description: intl.formatMessage(
        {
          id: "app.login.toast.fallbackAccountDescription",
          defaultMessage:
            "No passkey matched “{requested}”, so you're signed in as {actual}, the account saved on this device.",
        },
        { requested: attempted, actual: auth.userName }
      ),
    });
  }, [auth.isAuthenticated, auth.userName, intl]);

  useEffect(() => {
    if (auth.error && !auth.isAuthenticating) {
      setLoadingState(null);
      setLoadingMessage(undefined);
      setLoginError(
        getFriendlyLoginErrorMessage(auth.error, intl, { creating: creatingRef.current })
      );
    }
  }, [auth.error, auth.isAuthenticating, intl]);

  const unsupportedPasskeyContext =
    isMobile && (guidance.scenario === "wrong-browser" || guidance.scenario === "in-app-browser");
  const blockUnsupportedPasskeyCeremony = useCallback(() => {
    const ceremonyContext = classifyPasskeyCeremonyContext();
    if (!unsupportedPasskeyContext && ceremonyContext.supported) return false;
    setLoadingState(null);
    setLoadingMessage(undefined);
    setLoginError(
      intl.formatMessage({
        id: "app.login.error.unsupportedBrowser",
        defaultMessage: "Open Green Goods in the recommended browser.",
      })
    );
    return true;
  }, [intl, unsupportedPasskeyContext]);

  const handleAuthError = (error: unknown, operation: "login" | "recover" | "create") => {
    setLoadingState(null);
    setLoadingMessage(undefined);
    debugError("Authentication failed", error);
    setLoginError(getFriendlyLoginErrorMessage(error, intl, { creating: operation === "create" }));
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (
      !message.includes("cancel") &&
      !message.includes("abort") &&
      !message.includes("user deny") &&
      !message.includes("not allowed")
    ) {
      trackAuthError(error, {
        source: "Login.handleAuthError",
        userAction: `${operation} with passkey`,
        authMode: "passkey",
        recoverable: true,
        metadata: {
          operation,
          has_stored_credential: auth.hasStoredCredential,
          guidance_scenario: guidance.scenario || "none",
        },
      });
    }
  };

  const begin = (message: string, { creating = false } = {}) => {
    creatingRef.current = creating;
    setLoginError(null);
    setLoadingMessage(message);
    setLoadingState("welcome");
  };
  const loginWithPasskey = async () => {
    if (blockUnsupportedPasskeyCeremony()) return;
    recoveryAttemptNameRef.current = null;
    begin(
      intl.formatMessage({
        id: "app.login.loading.authenticating",
        defaultMessage: "Signing you in...",
      })
    );
    try {
      await auth.loginWithPasskey?.();
    } catch (error) {
      handleAuthError(error, "login");
    }
  };
  const recoverWithPasskey = async () => {
    if (blockUnsupportedPasskeyCeremony()) return;
    const name = recoveryUsername.trim();
    if (name.length < 3) {
      setLoginError(
        intl.formatMessage({
          id: "app.login.error.usernameTooShort",
          defaultMessage: "Display name must be at least 3 characters.",
        })
      );
      return;
    }
    recoveryAttemptNameRef.current = name;
    begin(
      intl.formatMessage({
        id: "app.login.loading.recovering",
        defaultMessage: "Looking up your passkey...",
      })
    );
    try {
      await auth.loginWithPasskey?.(name);
    } catch (error) {
      handleAuthError(error, "recover");
    }
  };
  const loginWithOriginalAccount = async () => {
    if (!originalAccountAddress || blockUnsupportedPasskeyCeremony()) return;
    recoveryAttemptNameRef.current = null;
    begin(
      intl.formatMessage({
        id: "app.login.loading.authenticating",
        defaultMessage: "Signing you in...",
      })
    );
    try {
      await auth.loginWithOriginalPasskey?.();
    } catch (error) {
      handleAuthError(error, "login");
    }
  };
  const createAccount = async () => {
    if (blockUnsupportedPasskeyCeremony()) return;
    const name = username.trim();
    if (name.length < 3) {
      setLoginError(
        intl.formatMessage({
          id: "app.login.error.usernameTooShort",
          defaultMessage: "Display name must be at least 3 characters.",
        })
      );
      return;
    }
    recoveryAttemptNameRef.current = null;
    begin(
      intl.formatMessage({
        id: "app.login.loading.creatingWallet",
        defaultMessage: "Setting up your account...",
      }),
      { creating: true }
    );
    try {
      await auth.createAccount?.(name);
    } catch (error) {
      handleAuthError(error, "create");
    }
  };
  const walletLogin = () => {
    setLoginError(null);
    recoveryAttemptNameRef.current = null;
    auth.loginWithWallet?.();
  };
  const goTo = (next: LoginScreen) => {
    setLoginError(null);
    setScreen(next);
  };
  const switchBrowser = useCallback(async () => {
    if (guidance.openInBrowserUrl) {
      window.location.href = guidance.openInBrowserUrl;
      return;
    }
    const success = await copyToClipboard(window.location.href);
    toastService.show(
      success
        ? {
            status: "success",
            title: intl.formatMessage({
              id: "app.login.toast.linkCopied",
              defaultMessage: "Link copied!",
            }),
            description: intl.formatMessage({
              id: "app.login.toast.linkCopiedDescription",
              defaultMessage: "Now open Safari and paste this link to continue.",
            }),
          }
        : {
            status: "error",
            title: intl.formatMessage({
              id: "app.login.toast.copyFailed",
              defaultMessage: "Couldn't copy link",
            }),
            description: intl.formatMessage({
              id: "app.login.toast.copyFailedDescription",
              defaultMessage: "Please copy this URL manually and open it in Safari.",
            }),
          }
    );
  }, [guidance.openInBrowserUrl, intl]);

  const fromLogout = (location.state as { fromLogout?: boolean } | null)?.fromLogout === true;
  const storedName = auth.hasStoredCredential ? getStoredUsername()?.trim() : undefined;
  return {
    auth,
    pilotInvitation,
    originalAccountAddress,
    loginWithOriginalAccount,
    pilotPreview,
    pilotQuote,
    pilotBusy,
    pilotError,
    showPilotEnrollment: canDiscoverPilot && !pilotSkipped,
    reviewPilotAccount,
    quotePilotProof,
    confirmPilotAccount,
    reconcilePilotProof,
    keepOriginalAccount,
    browserGuidanceAction: unsupportedPasskeyContext
      ? { label: getBrowserGuidanceLabel(guidance, platform, intl), onClick: switchBrowser }
      : undefined,
    createAccount,
    goTo,
    intl,
    isNestedRoute: location.pathname !== routes.login,
    isRecoveryUsernameValid: recoveryUsername.trim().length >= 3,
    isUsernameValid: username.trim().length >= 3,
    loadingMessage,
    loadingState,
    loginError,
    loginWithPasskey,
    passkeyServerEnabled,
    personalizedLabel: storedName
      ? intl.formatMessage(
          { id: "app.login.button.continueAs", defaultMessage: "Continue as {name}" },
          { name: storedName }
        )
      : undefined,
    recoverWithPasskey,
    recoveryUsername,
    redirectTo: fromLogout
      ? routes.home
      : new URLSearchParams(location.search).get("redirectTo") || routes.home,
    screen,
    setRecoveryUsername,
    setUsername,
    username,
    walletLogin,
  };
}
