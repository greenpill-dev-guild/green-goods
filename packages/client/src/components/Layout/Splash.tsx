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
  onCancel?: () => void;
  minLength?: number;
  autoComplete?: string;
}

interface SplashProps {
  login?: () => void;
  isLoggingIn?: boolean;
  isLoginDisabled?: boolean;
  buttonLabel?: string;
  /**
   * Full untruncated primary label (e.g. the complete stored username) exposed
   * as the button's hover/tooltip title when the pill truncates.
   */
  buttonTitle?: string;
  loadingState?: LoadingState;
  message?: string;
  errorMessage?: string | null;
  /**
   * Info/helper copy for the shared message zone (input hints, explainers,
   * separate-account warnings). The error always wins the zone; info returns
   * when the error clears.
   */
  infoMessage?: string;
  secondaryAction?: SecondaryActionConfig;
  tertiaryAction?: TertiaryActionConfig;
  usernameInput?: UsernameInputConfig;
}

export const Splash: React.FC<SplashProps> = ({
  login,
  isLoggingIn = false,
  isLoginDisabled = false,
  buttonLabel = "Login",
  buttonTitle,
  loadingState,
  message,
  errorMessage,
  infoMessage,
  secondaryAction,
  tertiaryAction,
  usernameInput,
}) => {
  const intl = useIntl();
  const stateMessages = {
    welcome: "Welcome",
    "joining-garden": "Joining garden...",
    default: "Loading...",
  };

  const displayMessage = loadingState ? message || stateMessages[loadingState] : APP_NAME;
  // Passkey attempts set loadingState; wallet attempts only flip isLoggingIn
  // (the AppKit modal carries its own progress UI, so the primary stays a
  // plain disabled button there).
  const busy = Boolean(loadingState) || isLoggingIn;
  const usernameInputId = "login-username";
  const infoMessageId = "login-username-hint";
  const errorMessageId = "login-error-message";
  const showError = Boolean(errorMessage) && !loadingState;
  const showInfo = Boolean(infoMessage) && !showError && !loadingState;
  const usernameDescription = [
    showInfo ? infoMessageId : null,
    showError && usernameInput ? errorMessageId : null,
  ]
    .filter(Boolean)
    .join(" ");
  const effectsTransition =
    "transition-[opacity,color,border-color,background-color,box-shadow] duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)]";
  const tertiaryClassName = cn(
    "text-xs underline transition-[color,opacity] duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)]",
    !busy
      ? "text-foreground hover:text-primary opacity-100"
      : "text-text-soft-400 opacity-0 pointer-events-none"
  );

  return (
    <SplashScaffold
      pulse={!!loadingState}
      title={displayMessage}
      slotA={
        usernameInput ? (
          <>
            {/* Visible per-field labels left the slot heights uneven, so the
                label is screen-reader-only; the visible instruction for the
                field lives in the shared message zone (aria-describedby). */}
            <label htmlFor={usernameInputId} className="sr-only">
              {usernameInput.label ||
                intl.formatMessage({
                  id: "app.login.username.label",
                  defaultMessage: "Username or ENS handle",
                })}
            </label>
            <input
              id={usernameInputId}
              type="text"
              value={usernameInput.value ?? ""}
              onChange={usernameInput.onChange ?? (() => {})}
              placeholder={usernameInput.placeholder || "Choose a username"}
              minLength={usernameInput.minLength}
              autoComplete={usernameInput.autoComplete || "username"}
              aria-describedby={usernameDescription || undefined}
              aria-invalid={Boolean(errorMessage)}
              data-testid="username-input"
              className="w-full h-11 px-4 rounded-full border border-stroke-soft-200 bg-bg-white-0 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-alpha-24 text-center text-text-strong-950 placeholder:text-text-soft-400"
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === "Enter" && login && !isLoginDisabled && !busy) {
                  login();
                }
                if (e.key === "Escape" && usernameInput.onCancel) {
                  usernameInput.onCancel();
                }
              }}
            />
          </>
        ) : undefined
      }
      slotB={
        login && (
          <Button
            onClick={login}
            disabled={isLoggingIn || isLoginDisabled}
            isLoading={Boolean(loadingState)}
            className={cn("w-full", effectsTransition)}
            shape="pilled"
            data-testid="login-button"
            label={buttonLabel}
            title={buttonTitle}
          />
        )
      }
      slotC={
        <Button
          variant="primary"
          mode="stroke"
          size="small"
          shape="pilled"
          onClick={secondaryAction?.onSelect}
          disabled={!secondaryAction || secondaryAction.isDisabled || busy}
          label={secondaryAction?.label || "Login with wallet"}
          data-testid="secondary-action-button"
          className={cn(
            "w-full",
            effectsTransition,
            secondaryAction && !secondaryAction.isDisabled && !busy
              ? "opacity-100"
              : "opacity-0 pointer-events-none"
          )}
          aria-hidden={!secondaryAction}
          tabIndex={secondaryAction ? 0 : -1}
        />
      }
      message={
        <>
          {/* ERROR — the zone's only live region. Always mounted and toggled via
              `visibility` (not conditional render): the reveal still animates,
              the hidden state drops out of the accessibility tree, and a stable
              live region announces reliably. Absolutely positioned so its
              hidden box never displaces the info node below.
              Inline styles are a deliberate Rule 16 (shared Alert) exception:
              Alert's mandatory icon + p-4 + text-sm overflows this fixed-height
              zone with worst-case es/pt copy, and its role remounts alert↔status,
              which breaks the stable-live-region design. */}
          <div
            id={errorMessageId}
            role="alert"
            aria-live="polite"
            className={cn(
              "absolute inset-x-0 top-0 w-full transition-[opacity,transform,visibility] duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)]",
              showError
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
              <span>{errorMessage || " "}</span>
            </div>
          </div>

          {/* INFO — plain content, never announced. Hidden whenever the error
              owns the zone. */}
          {showInfo && (
            <p
              id={infoMessageId}
              data-testid="info-message"
              className={cn(
                "w-full rounded-lg border px-4 py-3 text-xs text-text-sub-600 text-center",
                pwaStatusStyles.primary.surface,
                pwaStatusStyles.primary.border
              )}
            >
              {infoMessage}
            </p>
          )}
        </>
      }
      tertiary={
        tertiaryAction ? (
          tertiaryAction.onClick ? (
            <button
              type="button"
              onClick={tertiaryAction.onClick}
              className={tertiaryClassName}
              tabIndex={!busy ? 0 : -1}
              aria-hidden={busy}
              disabled={busy}
            >
              {tertiaryAction.label}
            </button>
          ) : (
            <Link
              to={tertiaryAction.href || "#"}
              viewTransition
              className={tertiaryClassName}
              tabIndex={!busy ? 0 : -1}
              aria-hidden={busy}
            >
              {tertiaryAction.label}
            </Link>
          )
        ) : (
          <span className="text-xs text-transparent"> </span>
        )
      }
    />
  );
};
