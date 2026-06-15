import { APP_NAME, cn } from "@green-goods/shared";
import type React from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";

import { Button } from "../Actions";
import { pwaStatusStyles } from "@/styles/pwaStatusStyles";

export type LoadingState = "welcome" | "joining-garden" | "default";

interface SecondaryActionConfig {
  label: string;
  onSelect: () => void;
  isDisabled?: boolean;
}

interface TertiaryActionConfig {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface UsernameInputConfig {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label?: string;
  placeholder?: string;
  hint?: string;
  onCancel?: () => void;
  minLength?: number;
  autoComplete?: string;
}

interface SplashProps {
  login?: () => void;
  isLoggingIn?: boolean;
  isLoginDisabled?: boolean;
  buttonLabel?: string;
  loadingState?: LoadingState;
  message?: string;
  errorMessage?: string | null;
  secondaryAction?: SecondaryActionConfig;
  tertiaryAction?: TertiaryActionConfig;
  usernameInput?: UsernameInputConfig;
  /** Small muted text displayed below error area (e.g. address continuity notice) */
  notice?: string;
  /** Info callout text shown above action buttons (e.g. passkey explainer) */
  infoCallout?: string;
}

export const Splash: React.FC<SplashProps> = ({
  login,
  isLoggingIn = false,
  isLoginDisabled = false,
  buttonLabel = "Login",
  loadingState,
  message,
  errorMessage,
  secondaryAction,
  tertiaryAction,
  usernameInput,
  notice,
  infoCallout,
}) => {
  const intl = useIntl();
  const stateMessages = {
    welcome: "Welcome",
    "joining-garden": "Joining garden...",
    default: "Loading...",
  };

  const displayMessage = loadingState ? message || stateMessages[loadingState] : APP_NAME;
  const showUsernameInput = usernameInput && !loadingState;
  const usernameInputId = "login-username";
  const usernameHintId = "login-username-hint";
  const errorMessageId = "login-error-message";
  const usernameDescription = [
    usernameHintId,
    errorMessage && showUsernameInput ? errorMessageId : null,
  ]
    .filter(Boolean)
    .join(" ");
  const effectsTransition =
    "transition-[opacity,color,border-color,background-color,box-shadow] duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)]";
  const revealTransition =
    "transition-[max-height,opacity,margin] duration-[var(--spring-spatial-duration)] ease-[var(--spring-spatial-easing)]";

  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-bg-white-0 px-4 pb-8 pt-[5vh] sm:pt-[7vh]">
      {/* Fixed-size container - prevents layout shift */}
      <div className="flex w-full max-w-sm flex-col items-center">
        {/* ─────────────────────────────────────────────────────────────────────
            LOGO SECTION - Always visible, never moves
        ───────────────────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 mb-4">
          <img
            src="/icon.png"
            alt={APP_NAME}
            // The logomark is a wide horizontal GG (819×464). Constrain the
            // height and let the width follow the aspect ratio — `w-24`/`w-28`
            // forced it into a square box and crushed it (the intrinsic size
            // hint must match the asset, not a 240×240 square, or the box
            // squishes the same way).
            width={819}
            height={464}
            className={cn(
              "h-24 w-auto sm:h-28 transition-opacity duration-[var(--spring-effects-slow-duration)] ease-[var(--spring-effects-slow-easing)]",
              loadingState && "animate-pulse"
            )}
          />
        </div>

        {/* ─────────────────────────────────────────────────────────────────────
            TITLE/MESSAGE - Fixed height container
        ───────────────────────────────────────────────────────────────────── */}
        <div className="h-8 flex items-center justify-center mb-5">
          <h3 className={cn("text-center font-bold text-primary", effectsTransition)}>
            {displayMessage}
          </h3>
        </div>

        {/* ─────────────────────────────────────────────────────────────────────
            USERNAME INPUT - Reserved space with CSS transitions
            Uses max-height + opacity for smooth show/hide without layout shift
        ───────────────────────────────────────────────────────────────────── */}
        <div
          className={cn(
            "w-full overflow-hidden",
            revealTransition,
            showUsernameInput ? "max-h-36 opacity-100 mb-4" : "max-h-0 opacity-0 mb-0"
          )}
          aria-hidden={!showUsernameInput}
          hidden={!showUsernameInput}
        >
          <label
            htmlFor={usernameInputId}
            className={cn(
              "mb-2 block text-center text-sm font-semibold text-text-strong-950 transition-opacity duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)]",
              showUsernameInput ? "opacity-100" : "opacity-0"
            )}
          >
            {usernameInput?.label ||
              intl.formatMessage({
                id: "app.login.username.label",
                defaultMessage: "Username or ENS handle",
              })}
          </label>
          <input
            id={usernameInputId}
            type="text"
            value={usernameInput?.value ?? ""}
            onChange={usernameInput?.onChange ?? (() => {})}
            placeholder={usernameInput?.placeholder || "Choose a username"}
            minLength={usernameInput?.minLength}
            autoComplete={usernameInput?.autoComplete || "username"}
            aria-describedby={usernameDescription || undefined}
            aria-invalid={Boolean(errorMessage && showUsernameInput)}
            data-testid="username-input"
            className="w-full px-4 py-3 rounded-full border border-stroke-soft-200 bg-bg-white-0 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-alpha-24 text-center text-text-strong-950 placeholder:text-text-soft-400"
            disabled={isLoggingIn || !showUsernameInput}
            tabIndex={showUsernameInput ? 0 : -1}
            aria-hidden={!showUsernameInput}
            onKeyDown={(e) => {
              if (!showUsernameInput) return;
              if (e.key === "Enter" && login && !isLoginDisabled) {
                login();
              }
              if (e.key === "Escape" && usernameInput?.onCancel) {
                usernameInput.onCancel();
              }
            }}
          />
          <p
            id={usernameHintId}
            className={cn(
              "mt-2 text-center text-xs text-text-sub-600 transition-opacity duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)]",
              showUsernameInput ? "opacity-100" : "opacity-0"
            )}
          >
            {usernameInput?.hint || "This username identifies your passkey on our server"}
          </p>
        </div>

        {/* ─────────────────────────────────────────────────────────────────────
            INFO CALLOUT - Expandable educational text (e.g. passkey explainer)
        ───────────────────────────────────────────────────────────────────── */}
        <div
          className={cn(
            "w-full overflow-hidden",
            revealTransition,
            infoCallout && !loadingState ? "max-h-40 opacity-100 mb-4" : "max-h-0 opacity-0 mb-0"
          )}
        >
          <p
            data-testid="info-callout"
            className={cn(
              "w-full rounded-lg border px-4 py-3 text-xs text-text-sub-600 text-center",
              pwaStatusStyles.primary.surface,
              pwaStatusStyles.primary.border
            )}
          >
            {infoCallout}
          </p>
        </div>

        {/* ─────────────────────────────────────────────────────────────────────
            ACTION BUTTONS - Fixed height container for stability
        ───────────────────────────────────────────────────────────────────── */}
        <div className="w-full flex flex-col items-center gap-3 h-[100px]">
          {/* Primary button / Loader */}
          <div className="w-full h-10 flex items-center justify-center">
            {loadingState ? (
              <div
                className={cn(
                  "h-10 w-10 animate-spin rounded-full border-4 border-primary-alpha-24",
                  pwaStatusStyles.primary.spinnerBorder
                )}
              />
            ) : (
              login && (
                <Button
                  onClick={login}
                  disabled={isLoggingIn || isLoginDisabled}
                  className={cn("w-full", effectsTransition)}
                  shape="pilled"
                  data-testid="login-button"
                  label={buttonLabel}
                />
              )
            )}
          </div>

          {/* Secondary action - Uses opacity for smooth transition */}
          <div className="w-full h-10 flex items-center justify-center">
            <Button
              variant="primary"
              mode="stroke"
              size="small"
              shape="pilled"
              onClick={secondaryAction?.onSelect}
              disabled={
                !secondaryAction || secondaryAction.isDisabled || isLoggingIn || !!loadingState
              }
              label={secondaryAction?.label || "Login with wallet"}
              data-testid="secondary-action-button"
              className={cn(
                "w-full",
                effectsTransition,
                !loadingState && secondaryAction && !secondaryAction.isDisabled && !isLoggingIn
                  ? "opacity-100"
                  : "opacity-0 pointer-events-none"
              )}
              aria-hidden={!!loadingState || !secondaryAction}
              tabIndex={!loadingState && secondaryAction ? 0 : -1}
            />
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────────
            CONTEXT MESSAGE - Fixed height for loading states
        ───────────────────────────────────────────────────────────────────── */}
        {loadingState === "joining-garden" && (
          <div className="h-6 flex items-center justify-center mt-2">
            <p className="max-w-sm text-center text-sm text-text-sub-600">
              {intl.formatMessage({
                id: "app.login.splash.joiningGardenHint",
                defaultMessage: "Confirm on your device when prompted",
              })}
            </p>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────
            ERROR MESSAGE - Fixed height with smooth reveal
        ───────────────────────────────────────────────────────────────────── */}
        <div className="w-full min-h-16 mt-2">
          <div
            id={errorMessageId}
            role="alert"
            aria-live="polite"
            className={cn(
              // `visibility` joins the transition so the reveal still animates
              // (visible flips on immediately, opacity fades in) while the
              // hidden state drops the region — and its "Error:" prefix —
              // out of the accessibility tree instead of relying on opacity.
              "w-full transition-[opacity,transform,visibility] duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)]",
              errorMessage && !loadingState
                ? "visible opacity-100 translate-y-0"
                : "invisible opacity-0 -translate-y-2 pointer-events-none"
            )}
          >
            <div className="flex w-full items-start gap-2 rounded-lg border border-error-light bg-error-lighter p-3 text-sm text-error-dark">
              <span className="font-semibold shrink-0">
                {intl.formatMessage({
                  id: "app.login.splash.errorPrefix",
                  defaultMessage: "Error:",
                })}
              </span>
              <span>{errorMessage || "\u00A0"}</span>
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────────
            NOTICE - Small muted text (e.g. address continuity)
        ───────────────────────────────────────────────────────────────────── */}
        {notice && !loadingState && (
          <p className="text-center text-xs text-text-sub-600 mt-1 mb-1">{notice}</p>
        )}

        {/* ─────────────────────────────────────────────────────────────────────
            TERTIARY ACTION - Fixed height
        ───────────────────────────────────────────────────────────────────── */}
        <div className="h-5 flex items-center justify-center mt-2">
          {tertiaryAction ? (
            tertiaryAction.onClick ? (
              <button
                type="button"
                onClick={tertiaryAction.onClick}
                className={cn(
                  "text-xs underline transition-[color,opacity] duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)]",
                  !loadingState && !isLoggingIn
                    ? "text-foreground hover:text-primary opacity-100"
                    : "text-text-soft-400 opacity-0 pointer-events-none"
                )}
                tabIndex={!loadingState && !isLoggingIn ? 0 : -1}
                aria-hidden={!!loadingState || isLoggingIn}
                disabled={!!loadingState || isLoggingIn}
              >
                {tertiaryAction.label}
              </button>
            ) : (
              <Link
                to={tertiaryAction.href || "#"}
                viewTransition
                className={cn(
                  "text-xs underline transition-[color,opacity] duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)]",
                  !loadingState && !isLoggingIn
                    ? "text-foreground hover:text-primary opacity-100"
                    : "text-text-soft-400 opacity-0 pointer-events-none"
                )}
                tabIndex={!loadingState && !isLoggingIn ? 0 : -1}
                aria-hidden={!!loadingState || isLoggingIn}
              >
                {tertiaryAction.label}
              </Link>
            )
          ) : (
            <span className="text-xs text-transparent">{"\u00A0"}</span>
          )}
        </div>
      </div>
    </div>
  );
};
