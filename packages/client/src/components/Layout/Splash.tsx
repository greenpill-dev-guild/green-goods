import type React from "react";

import { APP_NAME } from "@/config/app";

import { Button } from "../UI/Button";

/**
 * Loading state types for the splash screen
 * - creating-account: First-time user creating smart account
 * - joining-garden: First-time user joining community garden
 * - welcome-back: Returning user
 * - default: Standard loading state
 */
export type LoadingState = "creating-account" | "joining-garden" | "welcome-back" | "default";

interface SplashProps {
  login?: () => void;
  isLoggingIn?: boolean;
  buttonLabel?: string;
  loadingState?: LoadingState;
  message?: string;
}

/**
 * Splash component with support for onboarding loading states
 *
 * Displays:
 * - Logo with optional loading animation
 * - State-specific messages (creating account, joining garden, welcome back)
 * - Login button (when not in loading state)
 */
export const Splash: React.FC<SplashProps> = ({
  login,
  isLoggingIn = false,
  buttonLabel = "Login",
  loadingState,
  message,
}) => {
  // If loadingState is provided, show loading view with animation
  if (loadingState) {
    const stateMessages = {
      "creating-account": "Creating your garden account...",
      "joining-garden": "Joining community garden...",
      "welcome-back": "Welcome back...",
      default: "Loading...",
    };

    const defaultMessage = message || stateMessages[loadingState];

    return (
      <div className="flex flex-col items-center gap-4 w-full h-full px-4 pb-12 pt-[20vh]">
        {/* Logo with pulse animation */}
        <img src="/icon.png" alt={APP_NAME} width={240} className="animate-pulse" />

        {/* Loading spinner */}
        <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />

        {/* State message */}
        <h3 className="font-bold text-center text-[#367D42] mt-4">{defaultMessage}</h3>

        {/* Additional context message */}
        {loadingState === "creating-account" && (
          <p className="text-sm text-gray-600 text-center max-w-sm">
            Setting up your secure passkey wallet
          </p>
        )}
        {loadingState === "joining-garden" && (
          <p className="text-sm text-gray-600 text-center max-w-sm">
            Adding you to the Green Goods community
          </p>
        )}
      </div>
    );
  }

  // Standard splash screen with login button
  return (
    <div className="flex flex-col items-center gap-4 w-full h-full px-4 pb-12 pt-[20vh]">
      <img src="/icon.png" alt={APP_NAME} width={240} />
      <h3 className="font-bold text-center text-[#367D42] mb-12">{APP_NAME}</h3>
      {login && (
        <Button
          onClick={login}
          disabled={isLoggingIn}
          className="w-full"
          shape="pilled"
          data-testid="login-button"
          label={buttonLabel}
        />
      )}
    </div>
  );
};
