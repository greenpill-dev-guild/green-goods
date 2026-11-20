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

/** The Hub's sign-in screens: the entry, and the one name step that signs in or creates. */
export type AdminLoginMode = "entry" | "username";

/**
 * The Hub's sign-in, shaped like the App's: a passkey first, a wallet second, and one name
 * step that signs in to an existing account or creates a new one. Shared auth owns the
 * ceremonies and session checks; this hook owns what the screen says about them.
 */
export function useAdminLoginController({
  initialMode = "entry",
}: {
  initialMode?: AdminLoginMode;
} = {}) {
  const intl = useIntl();
  const { createAccount, loginWithPasskey } = useAuthActions();
  const {
    hasStoredCredential,
    isAuthenticating,
    isAuthenticated,
    error: authError,
    walletConnectFailure,
    walletReleaseStalled,
  } = useAuthState();
  const [mode, setMode] = useState<AdminLoginMode>(initialMode);
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const mounted = useRef(true);
  const awaitingActorRef = useRef<{ initialError: unknown; sawAuthenticating: boolean } | null>(
    null
  );
  const canSignInByName = isPasskeyServerEnabled();

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

  // A wallet that did not open or did not connect points the steward to a passkey, as the
  // App's sign-in does. Declared after the effect above, so an older passkey error the
  // machine still holds does not cover the newer failure.
  useEffect(() => {
    if (!walletConnectFailure || isAuthenticating) return;
    setError(
      intl.formatMessage(
        walletConnectFailure === "timeout"
          ? {
              id: "app.login.error.walletNotOpened",
              defaultMessage: "Your wallet app didn't open. Try again, or sign in with a passkey.",
            }
          : {
              id: "app.login.error.walletConnectFailed",
              defaultMessage:
                "We couldn't connect your wallet. Try again, or sign in with a passkey.",
            }
      )
    );
  }, [walletConnectFailure, isAuthenticating, intl]);

  const submitPasskey = useCallback(
    async (requestedName?: string) => {
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
      // Without the passkey server a name cannot be looked up, so the name step creates.
      const creating = name !== undefined && !canSignInByName;

      pendingRef.current = true;
      setPending(true);
      setError(null);
      try {
        awaitingActorRef.current = { initialError: authError, sawAuthenticating: false };
        if (name === undefined) {
          await loginWithPasskey(undefined);
        } else if (creating) {
          await createAccount(name);
        } else {
          await loginWithPasskey(name, { createIfMissing: true });
        }
      } catch (cause) {
        awaitingActorRef.current = null;
        if (mounted.current) setError(getFriendlyLoginErrorMessage(cause, intl, { creating }));
        const message =
          cause instanceof Error ? withoutQuotedRequest(cause.message).toLowerCase() : "";
        if (!/cancel|abort|user deny|not allowed/.test(message)) {
          trackAuthError(cause, {
            source: "Admin passkey authentication",
            userAction:
              name === undefined
                ? "login with passkey"
                : creating
                  ? "create with passkey"
                  : "continue with passkey",
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
    [
      authError,
      canSignInByName,
      createAccount,
      hasStoredCredential,
      intl,
      isAuthenticating,
      loginWithPasskey,
    ]
  );

  return {
    mode,
    changeMode: (next: AdminLoginMode) => {
      if (pendingRef.current || isAuthenticating) return;
      awaitingActorRef.current = null;
      setError(null);
      setMode(next);
    },
    username,
    setUsername,
    error: walletReleaseStalled
      ? intl.formatMessage({
          id: "app.login.walletStalled",
          defaultMessage:
            "The previous wallet request has not ended. Reload to retry, or sign in with a passkey.",
        })
      : error,
    isSigningIn: pending || isAuthenticating,
    canSignInByName,
    hasStoredCredential,
    storedUsername: hasStoredCredential ? getStoredUsername() : null,
    /** Signs in to the named account, or creates it when no passkey has that name. */
    continueByName: () => submitPasskey(username),
    signInWithStoredPasskey: () => submitPasskey(),
  };
}

export type AdminLoginController = ReturnType<typeof useAdminLoginController>;
