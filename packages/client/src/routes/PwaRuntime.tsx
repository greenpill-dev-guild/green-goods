import { lazy, Suspense } from "react";
import { Outlet } from "react-router-dom";
import { PwaUpdateNotifier } from "@/components/Communication/PwaUpdateNotifier";

const WalletRuntimeProviders = lazy(() => import("./WalletRuntimeProviders"));

export default function PwaRuntime() {
  return (
    <Suspense fallback={null}>
      <WalletRuntimeProviders>
        <PwaUpdateNotifier />
        <Outlet />
      </WalletRuntimeProviders>
    </Suspense>
  );
}
