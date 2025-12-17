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
  href: string;
}

interface UsernameInputConfig {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  onCancel?: () => void;
}

interface SplashProps {
  login?: () => void;
  isLoggingIn?: boolean;
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-green-50 to-white px-4 pb-12 pt-[12vh]">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        {/* Logo - fixed position */}
        <img
          src="/icon.png"
          alt={APP_NAME}
          width={240}
          className={`shrink-0 ${loadingState ? "animate-pulse" : ""}`}
        />

        {/* Title/Message - fixed height */}
        <div className="flex h-8 items-center justify-center">
          <h3 className="text-center font-bold text-[#367D42]">{displayMessage}</h3>
        </div>

        {/* Username input - shown when creating new account */}
        {usernameInput && !loadingState && (
          <div className="w-full">
            <input
              type="text"
              value={usernameInput.value}
              onChange={usernameInput.onChange}
              placeholder={usernameInput.placeholder || "Choose a username"}
              className="w-full px-4 py-3 rounded-full border border-gray-300 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 text-center text-gray-900 placeholder:text-gray-400"
              disabled={isLoggingIn}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && login) {
                  login();
                }
                if (e.key === "Escape" && usernameInput.onCancel) {
                  usernameInput.onCancel();
                }
              }}
            />
            <p className="mt-2 text-center text-xs text-gray-500">
              This username identifies your passkey on our server
            </p>
          </div>
        )}

        {/* Button/Loader/Secondary action container - shared space, fixed height */}
        <div className="w-full flex flex-col items-center gap-3" style={{ height: "100px" }}>
          <div className="w-full flex items-center justify-center h-10">
            {loadingState ? (
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
            ) : (
              login && (
                <Button
                  onClick={login}
                  disabled={isLoggingIn}
                  className="w-full transition-opacity"
                  shape="pilled"
                  data-testid="login-button"
                  label={buttonLabel}
                />
              )
            )}
          </div>

          {/* Secondary action (Login with wallet / Cancel) - fixed height slot */}
          <div className="flex w-full h-10 items-center justify-center">
            {!loadingState ? (
              <Button
                variant="primary"
                mode="stroke"
                size="small"
                shape="pilled"
                onClick={secondaryAction?.onSelect}
                disabled={!secondaryAction || secondaryAction.isDisabled || isLoggingIn}
                label={secondaryAction?.label || "Login with wallet"}
                className={`w-full transition-all duration-200 ${
                  secondaryAction && !secondaryAction.isDisabled && !isLoggingIn
                    ? "opacity-100"
                    : "opacity-0 pointer-events-none"
                }`}
              />
            ) : (
              <span className="text-sm text-transparent">\u00A0</span>
            )}
          </div>
        </div>

        {/* Context message - fixed height - only show in loading state */}
        <div className="flex h-6 items-center justify-center">
          {loadingState === "joining-garden" && (
            <p className="max-w-sm text-center text-sm text-gray-600">
              Please approve the passkey prompt
            </p>
          )}
        </div>

        {/* Error message - fixed height container */}
        <div className="relative w-full h-16">
          <div
            aria-live="polite"
            className={`absolute left-0 right-0 top-0 w-full transition-all duration-200 ${
              errorMessage && !loadingState
                ? "opacity-100 translate-y-0"
                : "opacity-0 -translate-y-2 pointer-events-none"
            }`}
          >
            <div className="flex w-full items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <span className="font-semibold">Error:</span>
              <span>{errorMessage || "\u00A0"}</span>
            </div>
          </div>
        </div>

        {/* Tertiary action - fixed height */}
        <div className="flex h-5 items-center justify-center">
          {tertiaryAction && !loadingState ? (
            <Link
              to={tertiaryAction.href}
              className={`text-xs underline transition-all duration-200 ${
                !isLoggingIn
                  ? "text-gray-500 hover:text-green-600 opacity-100"
                  : "text-gray-400 opacity-0 pointer-events-none"
              }`}
            >
              {tertiaryAction.label}
            </Link>
          ) : (
            <span className="text-xs text-transparent">\u00A0</span>
          )}
        </div>
      </div>
    </div>
  );
};
