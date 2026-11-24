import { useCallback, useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import {
  classifyPasskeyCeremonyContext,
  isPasskeyServerEnabled,
  normalizePasskeyAccountIdentifier,
} from "../../../config/passkeyServer";
import { trackAuthError } from "../../../modules/app/error-categories";
import { getStoredUsername } from "../../../modules/auth/session";
import { displayablePasskeyName } from "../../../public-contracts/passkey-directory";
import { PasskeyNotFoundError } from "../../../workflows/auth-passkey-errors";
import { useAuthActions, useAuthState } from "../../../providers/Auth";
import { withoutQuotedRequest } from "../../../utils/errors/extract-message";
import { getFriendlyLoginErrorMessage } from "../../auth/login-error-message";
import { useCodeSignIn } from "../../auth/useCodeSignIn";

/**
 * The Hub's sign-in screens: the entry, the one name step that signs in or creates, the question
 * asked before a typed name nobody holds becomes a second account on a device that already has
 * one (PRD-1611, as the App asks since PRD-1588), and, with email sign-in on, the other ways
 * (email or a wallet) and the email code flow.
 */
export type AdminLoginMode = "entry" | "username" | "confirmNewAccount" | "otherWays" | "code";

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
  const { createAccount, loginWithPasskey, requestSignInCode, loginWithCode } = useAuthActions();
  const {
    hasStoredCredential,
    isAuthenticating,
    isAuthenticated,
    error: authError,
    openfortMethod,
    walletConnectFailure,
    walletReleaseStalled,
  } = useAuthState();
  const [mode, setMode] = useState<AdminLoginMode>(initialMode);
  const codeSignIn = useCodeSignIn({
    isAuthenticating,
    error: authError,
    openfortMethod,
    requestSignInCode,
    loginWithCode,
  });
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Whether the sign-in in flight is a passkey's, so a wallet sign-in never shows the passkey's
  // progress. Shared auth reports both as one authenticating state.
  const [passkeyAttempt, setPasskeyAttempt] = useState(false);
  const pendingRef = useRef(false);
  const mounted = useRef(true);
  const awaitingActorRef = useRef<{
    initialError: unknown;
    sawAuthenticating: boolean;
    creating: boolean;
    /** The name was tried as a sign-in only, because another account is saved here. */
    signInOnly: boolean;
  } | null>(null);
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
      setPasskeyAttempt(false);
    } else if (authError && (attempt.sawAuthenticating || authError !== attempt.initialError)) {
      awaitingActorRef.current = null;
      setPasskeyAttempt(false);
      // Nobody holds the typed name, and this device already has an account: a typo must not
      // quietly become a second account, so the steward says it is a new one.
      if (
        attempt.signInOnly &&
        authError instanceof PasskeyNotFoundError &&
        authError.scope === "name"
      ) {
        setError(null);
        setMode("confirmNewAccount");
        return;
      }
      setError(getFriendlyLoginErrorMessage(authError, intl, { creating: attempt.creating }));
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
    async (requestedName?: string, { confirmedNew = false } = {}) => {
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
      // Another account is saved on this device under a different name: ask before creating.
      const anotherAccountSaved =
        name !== undefined &&
        !confirmedNew &&
        hasStoredCredential &&
        normalizePasskeyAccountIdentifier(getStoredUsername() ?? "") !== name;
      if (anotherAccountSaved && !canSignInByName) {
        // Without the passkey server nothing can say whether the name exists.
        setError(null);
        setMode("confirmNewAccount");
        return;
      }
      const signInOnly = anotherAccountSaved;
      // Without the passkey server a name cannot be looked up, so the name step creates.
      const creating = name !== undefined && !canSignInByName;

      pendingRef.current = true;
      setPending(true);
      setPasskeyAttempt(true);
      setError(null);
      try {
        awaitingActorRef.current = {
          initialError: authError,
          sawAuthenticating: false,
          creating,
          signInOnly,
        };
        if (name === undefined) {
          await loginWithPasskey(undefined);
        } else if (creating) {
          await createAccount(name);
        } else if (signInOnly) {
          await loginWithPasskey(name);
        } else {
          await loginWithPasskey(name, { createIfMissing: true });
        }
      } catch (cause) {
        awaitingActorRef.current = null;
        if (mounted.current) {
          setPasskeyAttempt(false);
          setError(getFriendlyLoginErrorMessage(cause, intl, { creating }));
        }
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
      setPasskeyAttempt(false);
      setError(null);
      // Leaving the code flow forgets what was typed, so the next person starts from nothing.
      if (next !== "code") codeSignIn.reset();
      setMode(next);
    },
    codeSignIn,
    /** A new wallet attempt clears what the last attempt said, as the App's sign-in does. */
    beginWalletSignIn: () => {
      awaitingActorRef.current = null;
      setPasskeyAttempt(false);
      setError(null);
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
    /** A wallet request from an ended sign-in still holds the connector. */
    walletReleaseStalled: Boolean(walletReleaseStalled),
    isSigningIn: pending || isAuthenticating,
    /** A passkey ceremony is in flight, as opposed to a wallet sign-in. */
    isPasskeySigningIn: pending || (passkeyAttempt && isAuthenticating),
    canSignInByName,
    hasStoredCredential,
    storedUsername: hasStoredCredential ? getStoredUsername() : null,
    /** The account already saved on this device, when it has a name a person chose. */
    savedAccountName: hasStoredCredential
      ? (displayablePasskeyName(getStoredUsername()) ?? undefined)
      : undefined,
    /** Signs in to the named account, or creates it when no passkey has that name. */
    continueByName: () => submitPasskey(username),
    /** The steward said the typed name is a new account, not a misspelled one. */
    createNamedAccount: () => submitPasskey(username, { confirmedNew: true }),
    signInWithStoredPasskey: () => submitPasskey(),
  };
}

export type AdminLoginController = ReturnType<typeof useAdminLoginController>;
