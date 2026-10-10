import { installPressHaptics } from "@green-goods/shared/utils/app/haptics";
import { lazy, Suspense, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { PwaUpdateNotifier } from "@/components/Communication/PwaUpdateNotifier";

const WalletRuntimeProviders = lazy(() => import("./WalletRuntimeProviders"));

export default function PwaRuntime() {
  // One listener answers every press in the installed app, sign-in included.
  // The editorial website never mounts this runtime, so it stays silent.
  useEffect(() => installPressHaptics(), []);

  return (
    <Suspense fallback={null}>
      <WalletRuntimeProviders>
        <PwaUpdateNotifier />
        <Outlet />
      </WalletRuntimeProviders>
    </Suspense>
  );
}
