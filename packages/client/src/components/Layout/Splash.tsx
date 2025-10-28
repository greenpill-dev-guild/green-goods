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

          {/* Loading spinner - fixed height container */}
          <div className="flex h-12 items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
          </div>

          {/* State message - fixed height container */}
          <div className="flex min-h-[32px] items-center justify-center">
            <h3 className="text-center font-bold text-[#367D42] animate-fadeInScale">
              {defaultMessage}
            </h3>
          </div>

          {/* Additional context message - fixed height container */}
          <div className="flex min-h-[40px] items-center justify-center">
            {loadingState === "welcome" && (
              <p
                className="max-w-sm text-center text-sm text-gray-600 animate-fadeInScale"
                style={{ animationDelay: "100ms" }}
              >
                Welcome
              </p>
            )}
            {loadingState === "joining-garden" && (
              <p
                className="max-w-sm text-center text-sm text-gray-600 animate-fadeInScale"
                style={{ animationDelay: "100ms" }}
              >
                Adding you to the Green Goods community
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Standard splash screen with login button
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-green-50 to-white px-4 pb-12 pt-[12vh]">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        {/* Logo - consistent size */}
        <img src="/icon.png" alt={APP_NAME} width={240} className="shrink-0" />

        {/* Title - fixed height */}
        <div className="flex h-8 items-center justify-center">
          <h3 className="text-center font-bold text-[#367D42]">{APP_NAME}</h3>
        </div>

        {login && (
          <div className="w-full">
            {/* Fixed height container prevents shifts */}
            <div className="relative w-full pb-2">
              <Button
                onClick={login}
                disabled={isLoggingIn}
                className="w-full transition-opacity"
                shape="pilled"
                data-testid="login-button"
                label={buttonLabel}
              />

              {/* Fixed height error container */}
              <div
                aria-live="polite"
                className="absolute left-0 right-0 top-full mt-2 h-[60px] w-full"
              >
                <div
                  className={`transition-all duration-200 ${
                    errorMessage
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
            </div>
          </div>
        )}

        {/* Fixed height containers for action buttons prevent shifts */}
        <div className="flex h-6 items-center justify-center">
          <button
            onClick={secondaryAction?.onSelect}
            disabled={!secondaryAction || secondaryAction.isDisabled}
            className={`text-sm underline transition-all duration-200 ${
              secondaryAction && !secondaryAction.isDisabled
                ? "text-gray-600 hover:text-green-600 opacity-100"
                : "text-gray-400 cursor-default opacity-0 pointer-events-none"
            }`}
          >
            {secondaryAction?.label || "Login with wallet"}
          </button>
        </div>

        <div className="flex h-5 items-center justify-center">
          {tertiaryAction ? (
            <Link
              to={tertiaryAction.href}
              className={`text-xs underline transition-all duration-200 ${
                secondaryAction
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
