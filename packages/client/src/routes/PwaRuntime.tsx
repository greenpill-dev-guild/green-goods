import { lazy, Suspense } from "react";
import { Outlet } from "react-router-dom";
import { PwaUpdateNotifier } from "@/components/Communication/PwaUpdateNotifier";
import { PwaHydrationFallback } from "./PresentationHydrationFallback";

const WalletRuntimeProviders = lazy(() => import("./WalletRuntimeProviders"));

export default function PwaRuntime() {
  return (
    <Suspense fallback={<PwaHydrationFallback />}>
      <WalletRuntimeProviders>
        <PwaUpdateNotifier />
        <Outlet />
      </WalletRuntimeProviders>
    </Suspense>
  );
}
