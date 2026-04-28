import { lazy, Suspense } from "react";
import { Outlet } from "react-router-dom";

const WalletRuntimeProviders = lazy(() => import("./WalletRuntimeProviders"));

export default function PwaRuntime() {
  return (
    <Suspense fallback={null}>
      <WalletRuntimeProviders>
        <Outlet />
      </WalletRuntimeProviders>
    </Suspense>
  );
}
