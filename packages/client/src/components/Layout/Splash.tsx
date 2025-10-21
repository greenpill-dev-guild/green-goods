import { APP_NAME } from "@green-goods/shared/config";
import type React from "react";
import { Link } from "react-router-dom";

import { Button } from "../UI/Button";

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

interface SplashProps {
  login?: () => void;
  isLoggingIn?: boolean;
  buttonLabel?: string;
  loadingState?: LoadingState;
  message?: string;
  errorMessage?: string | null;
  secondaryAction?: SecondaryActionConfig;
  tertiaryAction?: TertiaryActionConfig;
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
}) => {
  // If loadingState is provided, show loading view with animation
  if (loadingState) {
    const stateMessages = {
      welcome: "Welcome",
      "joining-garden": "Joining community garden...",
      default: "Loading...",
    };

    const defaultMessage = message || stateMessages[loadingState];

    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
        <div className="flex h-full w-full flex-col items-center gap-4 px-4 pb-12 pt-[20vh]">
          {/* Logo with pulse animation */}
          <img src="/icon.png" alt={APP_NAME} width={240} className="animate-pulse" />

          {/* Loading spinner */}
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />

          {/* State message */}
          <h3 className="mt-4 text-center font-bold text-[#367D42]">{defaultMessage}</h3>

          {/* Additional context message */}
          {loadingState === "welcome" && (
            <p className="max-w-sm text-center text-sm text-gray-600">Welcome</p>
          )}
          {loadingState === "joining-garden" && (
            <p className="max-w-sm text-center text-sm text-gray-600">
              Adding you to the Green Goods community
            </p>
          )}
        </div>
      </div>
    );
  }

  // Standard splash screen with login button
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-green-50 to-white px-4 pb-12 pt-[12vh]">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <img src="/icon.png" alt={APP_NAME} width={240} />
        <h3 className="mb-6 text-center font-bold text-[#367D42]">{APP_NAME}</h3>

        {login && (
          <div className="w-full">
            {/* Reserve visual space so the absolute error banner never shifts surrounding layout */}
            <div className={`relative w-full ${errorMessage ? "pb-16" : "pb-4"}`}>
              <Button
                onClick={login}
                disabled={isLoggingIn}
                className="w-full"
                shape="pilled"
                data-testid="login-button"
                label={buttonLabel}
              />

              <div
                aria-live="polite"
                className="absolute left-0 right-0 top-full mt-2 min-h-[48px] w-full"
              >
                {errorMessage && (
                  <div className="flex w-full items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    <span className="font-semibold">Error:</span>
                    <span>{errorMessage}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {secondaryAction && (
          <button
            onClick={secondaryAction.onSelect}
            disabled={secondaryAction.isDisabled}
            className="text-sm text-gray-600 underline transition-colors hover:text-green-600 disabled:cursor-not-allowed disabled:text-gray-400"
          >
            {secondaryAction.label}
          </button>
        )}

        {tertiaryAction && (
          <Link
            to={tertiaryAction.href}
            className="text-xs text-gray-500 underline transition-colors hover:text-green-600"
          >
            {tertiaryAction.label}
          </Link>
        )}
      </div>
    </div>
  );
};
