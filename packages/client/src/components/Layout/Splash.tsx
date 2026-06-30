import { APP_NAME, cn } from "@green-goods/shared";
import type React from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";

import { Button } from "../Actions";
import { SplashScaffold } from "./SplashScaffold";
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
  const tertiaryClassName = cn(
    "text-xs underline transition-[color,opacity] duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)]",
    !loadingState && !isLoggingIn
      ? "text-foreground hover:text-primary opacity-100"
      : "text-text-soft-400 opacity-0 pointer-events-none"
  );

  return (
    <SplashScaffold
      pulse={!!loadingState}
      title={displayMessage}
      content={
        <>
          {/* USERNAME INPUT — only mounted when this state collects a username.
              The scaffold's fixed-height content viewport reserves the space, so
              mounting / unmounting across states never shifts the logo or the
              primary button. */}
          {showUsernameInput && (
            <div className="w-full">
              <label
                htmlFor={usernameInputId}
                className="mb-2 block text-center text-sm font-semibold text-text-strong-950"
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
                aria-invalid={Boolean(errorMessage)}
                data-testid="username-input"
                className="w-full px-4 py-3 rounded-full border border-stroke-soft-200 bg-bg-white-0 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-alpha-24 text-center text-text-strong-950 placeholder:text-text-soft-400"
                disabled={isLoggingIn}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && login && !isLoginDisabled) {
                    login();
                  }
                  if (e.key === "Escape" && usernameInput?.onCancel) {
                    usernameInput.onCancel();
                  }
                }}
              />
              <p id={usernameHintId} className="mt-2 text-center text-xs text-text-sub-600">
                {usernameInput?.hint || "This username identifies your passkey on our server"}
              </p>
            </div>
          )}

          {/* INFO CALLOUT — educational text (e.g. passkey explainer). Inside the
              clamped viewport, so its variable localized length never pushes the
              primary button down. */}
          {infoCallout && !loadingState && (
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
          )}

          {/* Loading hint (joining a garden) shares the same reserved viewport. */}
          {loadingState === "joining-garden" && (
            <p className="text-center text-sm text-text-sub-600">
              {intl.formatMessage({
                id: "app.login.splash.joiningGardenHint",
                defaultMessage: "Confirm on your device when prompted",
              })}
            </p>
          )}
        </>
      }
      action={
        loadingState ? (
          <div className="w-full h-10 flex items-center justify-center">
            <div
              className={cn(
                "h-10 w-10 animate-spin rounded-full border-4 border-primary-alpha-24",
                pwaStatusStyles.primary.spinnerBorder
              )}
            />
          </div>
        ) : (
          <>
            {/* Primary button */}
            <div className="w-full h-10 flex items-center justify-center">
              {login && (
                <Button
                  onClick={login}
                  disabled={isLoggingIn || isLoginDisabled}
                  className={cn("w-full", effectsTransition)}
                  shape="pilled"
                  data-testid="login-button"
                  label={buttonLabel}
                />
              )}
            </div>

            {/* Secondary action — opacity-toggled so its slot stays reserved */}
            <div className="w-full h-10 flex items-center justify-center">
              <Button
                variant="primary"
                mode="stroke"
                size="small"
                shape="pilled"
                onClick={secondaryAction?.onSelect}
                disabled={!secondaryAction || secondaryAction.isDisabled || isLoggingIn}
                label={secondaryAction?.label || "Login with wallet"}
                data-testid="secondary-action-button"
                className={cn(
                  "w-full",
                  effectsTransition,
                  secondaryAction && !secondaryAction.isDisabled && !isLoggingIn
                    ? "opacity-100"
                    : "opacity-0 pointer-events-none"
                )}
                aria-hidden={!secondaryAction}
                tabIndex={secondaryAction ? 0 : -1}
              />
            </div>
          </>
        )
      }
      error={
        <div
          id={errorMessageId}
          role="alert"
          aria-live="polite"
          className={cn(
            // `visibility` joins the transition so the reveal still animates
            // (visible flips on immediately, opacity fades in) while the hidden
            // state drops the region — and its "Error:" prefix — out of the
            // accessibility tree instead of relying on opacity.
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
            <span>{errorMessage || " "}</span>
          </div>
        </div>
      }
      notice={
        notice && !loadingState ? (
          <p className="text-center text-xs text-text-sub-600">{notice}</p>
        ) : null
      }
      tertiary={
        tertiaryAction ? (
          tertiaryAction.onClick ? (
            <button
              type="button"
              onClick={tertiaryAction.onClick}
              className={tertiaryClassName}
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
              className={tertiaryClassName}
              tabIndex={!loadingState && !isLoggingIn ? 0 : -1}
              aria-hidden={!!loadingState || isLoggingIn}
            >
              {tertiaryAction.label}
            </Link>
          )
        ) : (
          <span className="text-xs text-transparent">{" "}</span>
        )
      }
    />
  );
};
