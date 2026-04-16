/**
 * Conditional auth provider — uses DevAuthProvider in dev mode when
 * `?mockAuth=` URL param is present, otherwise uses real AuthProvider.
 *
 * In production builds, the DEV guard is statically replaced with `false`
 * by Vite, making DevAuthProvider dead code that Rollup tree-shakes away.
 */
import type { ReactNode } from "react";
import { AuthProvider } from "./Auth";
import { DevAuthProvider, hasMockAuthOverride } from "./DevAuthProvider";

export function AuthGate({ children }: { children: ReactNode }) {
  if (import.meta.env.DEV && hasMockAuthOverride()) {
    return <DevAuthProvider>{children}</DevAuthProvider>;
  }
  return <AuthProvider>{children}</AuthProvider>;
}
