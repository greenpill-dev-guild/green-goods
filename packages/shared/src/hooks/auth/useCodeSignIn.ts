/**
 * Email code sign-in, for the App's and the Hub's sign-in screens.
 *
 * The flow is two screens: the person types their email and gets a code, then types the code.
 * Nothing is remembered between people: each sign-in starts from an empty field, so on a shared
 * phone the next person never inherits the last one's address. Sending a code first ends any
 * Openfort session left on the device.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useIntl, type IntlShape } from "react-intl";
import { isOpenfortSignInEnabled } from "../../config/openfort";
import { logger } from "../../modules/app/logger";
import { OpenfortOwnerMismatchError } from "../../modules/auth/openfort-account";
import { OpenfortRecoveryUnavailableError } from "../../modules/auth/openfort-wallet";
import type { AuthActionsValue, AuthStateValue } from "../../providers/authContext";

export type CodeSignInStep = "email" | "code";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Whether what was typed looks like an email address yet. */
export function isEmailAddress(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

/** Plain words for each way a code sign-in can fail; never the provider's own message. */
function getCodeSignInErrorMessage(error: unknown, intl: IntlShape, step: CodeSignInStep): string {
  const text = error instanceof Error ? `${error.name} ${error.message}`.toLowerCase() : "";
  const code =
    typeof error === "object" && error && "error" in error
      ? String((error as { error: unknown }).error).toLowerCase()
      : "";
  if (typeof navigator !== "undefined" && navigator.onLine === false)
    return intl.formatMessage({
      id: "app.login.code.error.offline",
      defaultMessage: "You're offline. Connect to the internet to sign in.",
    });
  if (
    error instanceof OpenfortRecoveryUnavailableError ||
    error instanceof OpenfortOwnerMismatchError
  )
    return intl.formatMessage({
      id: "app.login.code.error.setup",
      defaultMessage: "We couldn't open your account just now. Try again in a minute.",
    });
  if (text.includes("rate") || text.includes("too many") || code.includes("rate"))
    return intl.formatMessage({
      id: "app.login.code.error.tooMany",
      defaultMessage: "Too many tries. Wait a few minutes, then try again.",
    });
  if (step === "code")
    return intl.formatMessage({
      id: "app.login.code.error.invalidCode",
      defaultMessage: "That code didn't work. Check it, or send a new one.",
    });
  return intl.formatMessage({
    id: "app.login.code.error.send",
    defaultMessage: "We couldn't send a code. Check the address and try again.",
  });
}

export interface CodeSignIn {
  /** The switch: email sign-in shows only when the build turns it on and has its keys. */
  enabled: boolean;
  step: CodeSignInStep;
  email: string;
  setEmail: (value: string) => void;
  code: string;
  setCode: (value: string) => void;
  /** Whether the typed email looks like an address, so Send Code can be pressed. */
  emailValid: boolean;
  sending: boolean;
  signingIn: boolean;
  error: string | null;
  sendCode: () => Promise<void>;
  signIn: () => Promise<void>;
  /** From the code screen, back to the email to change it or send a new code. */
  changeEmail: () => void;
  /** Leave the flow: fields and errors clear so the next person starts fresh. */
  reset: () => void;
}

/** The auth each sign-in screen already reads, passed in so each keeps its own seam. */
export type CodeSignInAuth = Pick<AuthStateValue, "isAuthenticating" | "error" | "openfortMethod"> &
  Pick<AuthActionsValue, "requestSignInCode" | "loginWithCode">;

export function useCodeSignIn(auth: CodeSignInAuth): CodeSignIn {
  const intl = useIntl();
  const {
    isAuthenticating,
    error: authError,
    openfortMethod,
    requestSignInCode,
    loginWithCode,
  } = auth;
  const enabled = isOpenfortSignInEnabled() && Boolean(requestSignInCode && loginWithCode);
  const [step, setStep] = useState<CodeSignInStep>("email");
  const [email, setEmailValue] = useState("");
  const [code, setCodeValue] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);
  const emailValid = isEmailAddress(email);

  // The machine reports a failed code sign-in as its error; say it in this flow's words.
  useEffect(() => {
    if (!attempted.current || !authError || !openfortMethod) return;
    logger.warn("[Auth] Code sign-in failed", { error: authError });
    setError(getCodeSignInErrorMessage(authError, intl, "code"));
  }, [authError, openfortMethod, intl]);

  const setEmail = useCallback((value: string) => {
    setEmailValue(value);
    setError(null);
  }, []);
  const setCode = useCallback((value: string) => {
    setCodeValue(value.replace(/\s/g, ""));
    setError(null);
  }, []);

  const sendCode = useCallback(async () => {
    if (!requestSignInCode || !emailValid || sending) return;
    setSending(true);
    setError(null);
    try {
      await requestSignInCode(email);
      setCodeValue("");
      setStep("code");
    } catch (sendError) {
      logger.warn("[Auth] Could not send a sign-in code", { error: sendError });
      setError(getCodeSignInErrorMessage(sendError, intl, "email"));
    } finally {
      setSending(false);
    }
  }, [requestSignInCode, emailValid, email, sending, intl]);

  const signIn = useCallback(async () => {
    if (!loginWithCode || !emailValid || code.length < 4) return;
    attempted.current = true;
    setError(null);
    await loginWithCode(email, code);
  }, [loginWithCode, emailValid, email, code]);

  const changeEmail = useCallback(() => {
    setStep("email");
    setCodeValue("");
    setError(null);
  }, []);

  const reset = useCallback(() => {
    attempted.current = false;
    setStep("email");
    setEmailValue("");
    setCodeValue("");
    setError(null);
  }, []);

  return {
    enabled,
    step,
    email,
    setEmail,
    code,
    setCode,
    emailValid,
    sending,
    signingIn: isAuthenticating && openfortMethod !== null,
    error,
    sendCode,
    signIn,
    changeEmail,
    reset,
  };
}
