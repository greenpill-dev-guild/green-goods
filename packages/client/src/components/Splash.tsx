import React from "react";

import { Button } from "./Button";

interface SplashProps {
  login: () => void;
  isLoggingIn: boolean;
  buttonLabel: string;
}

export const Splash: React.FC<SplashProps> = ({
  login,
  isLoggingIn,
  buttonLabel,
}) => {
  return (
    <div
      className="flex flex-col items-center justify-center  gap-4 text-black w-full h-full"
      // className="absolute top-0 z-50 flex items-center justify-center w-screen h-screen overflow-hidden bg-white"
    >
      <img
        src="/icons/android-chrome-512x512.png"
        alt="Impact Vocie"
        width={100}
        height={100}
      />
      <h1 className="text-3xl font-bold text-center w-3/4">
        Welcome To Impact Voice
      </h1>
      <Button
        label={buttonLabel}
        onClick={login}
        disabled={isLoggingIn}
        fullWidth
      />
    </div>
  );
};
