import React from "react";

import { RC as MobileInstallIcon } from "../../assets/icons/mobile-install.svg";
import { PWADataProps } from "../../hooks/providers/pwa";

interface PWAPromptProps extends PWADataProps {}

const promptText: Record<PWADataProps["platform"], React.ReactNode> = {
  ios: (
    <p>
      In your Safari browser menu, tap the Share icon and choose{" "}
      <span className="font-bold">Add to Home Screen</span> in the options. Then
      open the web3 app on your home screen.
    </p>
  ),
  android: (
    <p>
      In your Chrome browser menu, tap the{" "}
      <span className="font-bold">Add to Home Screen</span> option. Then open
      the web3 app on your home screen.
    </p>
  ),
  windows: (
    <p>
      In your Edge browser menu, tap the{" "}
      <span className="font-bold">Install Web3 App</span> option. Then open the
      web3 app on your home screen.
    </p>
  ),
  unknown: (
    <p>
      In your browser menu, tap the{" "}
      <span className="font-bold">Install Web3 App</span> option. Then open the
      web3 app on your home screen.
    </p>
  ),
};

export const PWAPrompt: React.FC<PWAPromptProps> = ({ platform }) => {
  return (
    <div className="fixed top-0 left-0 backdrop-blur-md z-40 w-screen h-screen grid place-items-center">
      <div className="modal-box flex w-full max-w-sm flex-col gap-4 text-center text-xl text-black items-center">
        <MobileInstallIcon
          className="fill-stone-600"
          width={120}
          height={120}
        />
        <h3 className="text-4xl">Add To Home Screen</h3>
        <p>
          To install the app, you need to add this website to your home screen.
        </p>
        {promptText[platform]}
      </div>
    </div>
  );
};
