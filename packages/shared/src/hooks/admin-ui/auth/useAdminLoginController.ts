import { useCallback, useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import {
  classifyPasskeyCeremonyContext,
  isPasskeyServerEnabled,
  normalizePasskeyAccountIdentifier,
} from "../../../config/passkeyServer";
import { trackAuthError } from "../../../modules/app/error-categories";
import { getStoredUsername } from "../../../modules/auth/session";
import { useAuthActions, useAuthState } from "../../../providers/Auth";
import { withoutQuotedRequest } from "../../../utils/errors/extract-message";
import { getFriendlyLoginErrorMessage } from "../../auth/login-error-message";

/** Shared auth owns registration, existing-account sign-in, and session checks. */
export function useAdminLoginController() {
  const intl = useIntl();
  const { createAccount, loginWithPasskey } = useAuthActions();
  const {
    hasStoredCredential,
    isAuthenticating,
    isAuthenticated,
    error: authError,
  } = useAuthState();
  const [mode, setMode] = useState<"create" | "signin">(hasStoredCredential ? "signin" : "create");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const mounted = useRef(true);
  const awaitingActorRef = useRef<{ initialError: unknown; sawAuthenticating: boolean } | null>(
    null
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Auth actions dispatch an actor event; the ceremony result arrives through state.
  useEffect(() => {
    const attempt = awaitingActorRef.current;
    if (!attempt) return;
    if (isAuthenticating) {
      attempt.sawAuthenticating = true;
    } else if (isAuthenticated) {
      awaitingActorRef.current = null;
    } else if (authError && (attempt.sawAuthenticating || authError !== attempt.initialError)) {
      awaitingActorRef.current = null;
      setError(getFriendlyLoginErrorMessage(authError, intl));
    }
  }, [authError, intl, isAuthenticating, isAuthenticated]);

  const submitPasskey = useCallback(
    async (operation: "create" | "signin", requestedName?: string) => {
      if (pendingRef.current || isAuthenticating) return;
      if (!classifyPasskeyCeremonyContext().supported) {
        setError(
          intl.formatMessage({
            id: "app.login.error.unsupportedBrowser",
            defaultMessage: "Open Green Goods in the recommended browser.",
          })
        );
        return;
      }
      const name =
        requestedName === undefined ? undefined : normalizePasskeyAccountIdentifier(requestedName);
      if (name !== undefined && name.length < 3) {
        setError(
          intl.formatMessage({
            id: "app.login.error.usernameTooShort",
            defaultMessage: "Display name must be at least 3 characters.",
          })
        );
        return;
      }

      pendingRef.current = true;
      setPending(true);
      setError(null);
      try {
        awaitingActorRef.current = { initialError: authError, sawAuthenticating: false };
        if (operation === "create") {
          await createAccount(name ?? "");
        } else {
          await loginWithPasskey(name);
        }
      } catch (cause) {
        awaitingActorRef.current = null;
        if (mounted.current) setError(getFriendlyLoginErrorMessage(cause, intl));
        const message =
          cause instanceof Error ? withoutQuotedRequest(cause.message).toLowerCase() : "";
        if (!/cancel|abort|user deny|not allowed/.test(message)) {
          trackAuthError(cause, {
            source: "Admin passkey authentication",
            userAction: operation === "create" ? "create with passkey" : "login with passkey",
            authMode: "passkey",
            recoverable: true,
            metadata: { has_stored_credential: hasStoredCredential },
          });
        }
      } finally {
        pendingRef.current = false;
        if (mounted.current) setPending(false);
      }
    },
    [authError, createAccount, hasStoredCredential, intl, isAuthenticating, loginWithPasskey]
  );

  return {
    mode,
    changeMode: (next: "create" | "signin") => {
      if (pendingRef.current || isAuthenticating) return;
      awaitingActorRef.current = null;
      setError(null);
      setMode(next);
    },
    username,
    setUsername,
    error,
    isSigningIn: pending || isAuthenticating,
    canSignInByName: isPasskeyServerEnabled(),
    hasStoredCredential,
    storedUsername: hasStoredCredential ? getStoredUsername() : null,
    createAccountByName: () => submitPasskey("create", username),
    signInByName: () => submitPasskey("signin", username),
    signInWithStoredPasskey: () => submitPasskey("signin"),
  };
}

export type AdminLoginController = ReturnType<typeof useAdminLoginController>;
