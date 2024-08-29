import React from "react";

import { APP_NAME } from "@/constants";

import { Button } from "../Button";

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
      <img src="/icon.png" alt={APP_NAME} width={180} height={180} />
      <h3 className=" font-bold text-center">{APP_NAME}</h3>
      <Button
        label={buttonLabel}
        onClick={login}
        disabled={isLoggingIn}
        fullWidth
      />
    </div>
  );
};
