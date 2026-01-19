import { APP_NAME } from "@green-goods/shared/config";
import type React from "react";
import { Link } from "react-router-dom";

import { Button } from "../Actions";

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
  placeholder?: string;
  hint?: string;
  onCancel?: () => void;
  minLength?: number;
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
}) => {
  const stateMessages = {
    welcome: "Welcome",
    "joining-garden": "Joining garden...",
    default: "Loading...",
  };

  const displayMessage = loadingState ? message || stateMessages[loadingState] : APP_NAME;
  const showUsernameInput = usernameInput && !loadingState;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg-white-0 px-4 pb-12 pt-[12vh]">
      {/* Fixed-size container - prevents layout shift */}
      <div className="flex w-full max-w-sm flex-col items-center">
        {/* ─────────────────────────────────────────────────────────────────────
            LOGO SECTION - Always visible, never moves
        ───────────────────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 mb-6">
          <img
            src="/icon.png"
            alt={APP_NAME}
            width={240}
            height={240}
            className={`transition-opacity duration-300 ${loadingState ? "animate-pulse" : ""}`}
          />
        </div>

        {/* ─────────────────────────────────────────────────────────────────────
            TITLE/MESSAGE - Fixed height container
        ───────────────────────────────────────────────────────────────────── */}
        <div className="h-8 flex items-center justify-center mb-6">
          <h3 className="text-center font-bold text-primary transition-all duration-200">
            {displayMessage}
          </h3>
        </div>

        {/* ─────────────────────────────────────────────────────────────────────
            USERNAME INPUT - Reserved space with CSS transitions
            Uses max-height + opacity for smooth show/hide without layout shift
        ───────────────────────────────────────────────────────────────────── */}
        <div
          className={`w-full overflow-hidden transition-all duration-300 ease-in-out ${
            showUsernameInput ? "max-h-24 opacity-100 mb-4" : "max-h-0 opacity-0 mb-0"
          }`}
        >
          <input
            type="text"
            value={usernameInput?.value ?? ""}
            onChange={usernameInput?.onChange ?? (() => {})}
            placeholder={usernameInput?.placeholder || "Choose a username"}
            minLength={usernameInput?.minLength}
            data-testid="username-input"
            className="w-full px-4 py-3 rounded-full border border-stroke-soft-200 bg-bg-white-0 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-center text-text-strong-950 placeholder:text-text-soft-400"
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
            className={`mt-2 text-center text-xs text-text-sub-600 transition-opacity duration-200 ${
              showUsernameInput ? "opacity-100" : "opacity-0"
            }`}
          >
            {usernameInput?.hint || "This username identifies your passkey on our server"}
          </p>
        </div>

        {/* ─────────────────────────────────────────────────────────────────────
            ACTION BUTTONS - Fixed height container for stability
        ───────────────────────────────────────────────────────────────────── */}
        <div className="w-full flex flex-col items-center gap-3 h-[100px]">
          {/* Primary button / Loader */}
          <div className="w-full h-10 flex items-center justify-center">
            {loadingState ? (
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            ) : (
              login && (
                <Button
                  onClick={login}
                  disabled={isLoggingIn || isLoginDisabled}
                  className="w-full transition-all duration-200"
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
              className={`w-full transition-all duration-200 ${
                !loadingState && secondaryAction && !secondaryAction.isDisabled && !isLoggingIn
                  ? "opacity-100"
                  : "opacity-0 pointer-events-none"
              }`}
              aria-hidden={!!loadingState || !secondaryAction}
              tabIndex={!loadingState && secondaryAction ? 0 : -1}
            />
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────────
            CONTEXT MESSAGE - Fixed height for loading states
        ───────────────────────────────────────────────────────────────────── */}
        <div className="h-6 flex items-center justify-center mt-2">
          <p
            className={`max-w-sm text-center text-sm text-text-sub-600 transition-opacity duration-200 ${
              loadingState === "joining-garden" ? "opacity-100" : "opacity-0"
            }`}
          >
            Please approve the passkey prompt
          </p>
        </div>

        {/* ─────────────────────────────────────────────────────────────────────
            ERROR MESSAGE - Fixed height with smooth reveal
        ───────────────────────────────────────────────────────────────────── */}
        <div className="relative w-full h-16 mt-2">
          <div
            role="alert"
            aria-live="polite"
            className={`absolute left-0 right-0 top-0 w-full transition-all duration-200 ${
              errorMessage && !loadingState
                ? "opacity-100 translate-y-0"
                : "opacity-0 -translate-y-2 pointer-events-none"
            }`}
          >
            <div className="flex w-full items-start gap-2 rounded-lg border border-error-light bg-error-lighter p-3 text-sm text-error-dark">
              <span className="font-semibold shrink-0">Error:</span>
              <span>{errorMessage || "\u00A0"}</span>
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────────
            TERTIARY ACTION - Fixed height
        ───────────────────────────────────────────────────────────────────── */}
        <div className="h-5 flex items-center justify-center mt-2">
          {tertiaryAction ? (
            tertiaryAction.onClick ? (
              <button
                type="button"
                onClick={tertiaryAction.onClick}
                className={`text-xs underline transition-all duration-200 ${
                  !loadingState && !isLoggingIn
                    ? "text-foreground hover:text-primary opacity-100"
                    : "text-text-soft-400 opacity-0 pointer-events-none"
                }`}
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
                className={`text-xs underline transition-all duration-200 ${
                  !loadingState && !isLoggingIn
                    ? "text-foreground hover:text-primary opacity-100"
                    : "text-text-soft-400 opacity-0 pointer-events-none"
                }`}
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
