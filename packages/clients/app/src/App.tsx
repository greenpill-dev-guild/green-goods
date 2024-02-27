import { useEffect } from "react";
import { Toaster } from "react-hot-toast";
import { useHuddle01 } from "@huddle01/react";

import { usePWA, InstallState } from "./hooks/providers/pwa";

import { Appbar } from "./components/Layout/AppBar";
import { PWAPrompt } from "./components/Layout/PWAPrompt";
import { OnlyMobile } from "./components/Layout/OnlyMobile";
import { CircleLoader } from "./components/Loader/Circle";

import Views from "./views";

export function App() {
  const { initialize } = useHuddle01();
  const { installState, ...pwaData } = usePWA();

  const Onboard: Record<InstallState, React.ReactNode> = {
    idle: (
      <div className="w-screen h-screen pb-20 bg-[#e9e3dd] grid place-items-center z-30 fixed top-0 left-0">
        <CircleLoader />
      </div>
    ),
    installed: null,
    prompt:
      installState === "unsupported" ? (
        <PWAPrompt {...pwaData} installState={installState} />
      ) : null,
    unsupported: <OnlyMobile />,
  };

  useEffect(() => {
    // its preferable to use env vars to store projectId
    initialize(import.meta.env.VITE_HUDDLE_PROJECT_ID);
  }, []);

  return (
    <>
      {Onboard[installState]}
      {installState !== "unsupported" && (
        <>
          <Appbar />
          <Views />
        </>
      )}
      <Toaster />
    </>
  );
}
