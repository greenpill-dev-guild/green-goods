/**
 * Conditional auth provider — uses DevAuthProvider in dev mode when
 * `?mockAuth=` URL param is present, otherwise uses real AuthProvider.
 *
 * In production builds, the DEV guard is statically replaced with `false`
 * by Vite, making DevAuthProvider dead code that Rollup tree-shakes away.
 *
 * Either way, a different account than the last one on this device starts
 * clean (`useIdentityChangeReset`); a mock-role switch reloads as another
 * address, as a real account switch can.
 */
import type { ReactNode } from "react";
import { useIdentityChangeReset } from "../hooks/auth/useIdentityChangeReset";
import { usePrimaryAddress } from "../hooks/auth/usePrimaryAddress";
import { AuthProvider } from "./Auth";
import { DevAuthProvider, hasMockAuthOverride } from "./DevAuthProvider";

export function AuthGate({ children }: { children: ReactNode }) {
  if (import.meta.env.DEV && hasMockAuthOverride()) {
    return (
      <DevAuthProvider>
        <IdentityChangeReset />
        {children}
      </DevAuthProvider>
    );
  }
  return (
    <AuthProvider>
      <IdentityChangeReset />
      {children}
    </AuthProvider>
  );
}

function IdentityChangeReset() {
  useIdentityChangeReset(usePrimaryAddress());
  return null;
}
