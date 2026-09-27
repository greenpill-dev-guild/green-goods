/**
 * Conditional auth provider — uses DevAuthProvider in dev mode when
 * `?mockAuth=` URL param is present, otherwise uses real AuthProvider.
 *
 * In production builds, the DEV guard is statically replaced with `false`
 * by Vite, making DevAuthProvider dead code that Rollup tree-shakes away.
 *
 * Either way, a different account than the last one on this device starts
 * clean (`useIdentityChangeReset`), down to the screens: the app below remounts
 * when another account replaces the last one. A mock-role switch reads as
 * another address, as a real account switch does.
 */
import { Fragment, type ReactNode } from "react";
import { useIdentityChangeReset } from "../hooks/auth/useIdentityChangeReset";
import { usePrimaryAddress } from "../hooks/auth/usePrimaryAddress";
import { AuthProvider, useOptionalAuthContext } from "./Auth";
import { DevAuthProvider, hasMockAuthOverride } from "./DevAuthProvider";

export function AuthGate({ children }: { children: ReactNode }) {
  if (import.meta.env.DEV && hasMockAuthOverride()) {
    return (
      <DevAuthProvider>
        <AccountSession>{children}</AccountSession>
      </DevAuthProvider>
    );
  }
  return (
    <AuthProvider>
      <AccountSession>{children}</AccountSession>
    </AuthProvider>
  );
}

function AccountSession({ children }: { children: ReactNode }) {
  const auth = useOptionalAuthContext();
  const generation = useIdentityChangeReset(usePrimaryAddress(), Boolean(auth?.isReady));
  return <Fragment key={generation}>{children}</Fragment>;
}
