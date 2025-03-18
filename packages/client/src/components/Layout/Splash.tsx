import React from "react";

import { APP_NAME } from "@/constants";

import { Button } from "../UI/Button";

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
    <div className="flex flex-col items-center gap-4 w-full h-full pb-12 pt-[20vh]">
      <img src="/icon.png" alt={APP_NAME} width={240} />
      <h3 className="font-bold text-center text-[#367D42] mb-12">{APP_NAME}</h3>
      <Button
        onClick={login}
        disabled={isLoggingIn}
        className="w-full"
        // variant="secondary"
        // fullWidth
      >
        {buttonLabel}
      </Button>
    </div>
  );
};
