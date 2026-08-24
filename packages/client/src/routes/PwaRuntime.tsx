import { HydrationFallback } from "@green-goods/shared/components/HydrationFallback";
import { lazy, Suspense } from "react";
import { Outlet } from "react-router-dom";
import { PwaUpdateNotifier } from "@/components/Communication/PwaUpdateNotifier";

const WalletRuntimeProviders = lazy(() => import("./WalletRuntimeProviders"));

export default function PwaRuntime() {
  return (
    <Suspense
      fallback={<HydrationFallback appName="Green Goods" message="Green Goods is loading." />}
    >
      <WalletRuntimeProviders>
        <PwaUpdateNotifier />
        <Outlet />
      </WalletRuntimeProviders>
    </Suspense>
  );
}
