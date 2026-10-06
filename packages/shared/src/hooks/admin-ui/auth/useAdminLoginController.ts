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

/** Admin signs in to existing accounts; Shared auth owns the credential and session checks. */
export function useAdminLoginController() {
  const intl = useIntl();
  const { loginWithPasskey } = useAuthActions();
  const { hasStoredCredential, isAuthenticating, error: authError } = useAuthState();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Auth actions dispatch an actor event; the ceremony result arrives through state.
  useEffect(() => {
    if (authError && !isAuthenticating) {
      setError(getFriendlyLoginErrorMessage(authError, intl));
    }
  }, [authError, intl, isAuthenticating]);

  const signIn = useCallback(
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

      pendingRef.current = true;
      setPending(true);
      setError(null);
      try {
        await loginWithPasskey(name);
      } catch (cause) {
        if (mounted.current) setError(getFriendlyLoginErrorMessage(cause, intl));
        const message =
          cause instanceof Error ? withoutQuotedRequest(cause.message).toLowerCase() : "";
        if (!/cancel|abort|user deny|not allowed/.test(message)) {
          trackAuthError(cause, {
            source: "Admin passkey sign-in",
            userAction: name === undefined ? "login with passkey" : "recover with passkey",
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
    [hasStoredCredential, intl, isAuthenticating, loginWithPasskey]
  );

  return {
    username,
    setUsername,
    error,
    isSigningIn: pending || isAuthenticating,
    canSignInByName: isPasskeyServerEnabled(),
    hasStoredCredential,
    storedUsername: hasStoredCredential ? getStoredUsername() : null,
    signInByName: () => signIn(username),
    signInWithStoredPasskey: () => signIn(),
  };
}

export type AdminLoginController = ReturnType<typeof useAdminLoginController>;
