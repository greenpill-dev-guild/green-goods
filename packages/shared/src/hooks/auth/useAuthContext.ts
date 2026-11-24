import { useContext } from "react";
import {
  AuthStateContext,
  AuthActionsContext,
  AuthContext,
  type AuthStateValue,
  type AuthActionsValue,
  type AuthContextType,
} from "../../providers/authContext";

// HOOKS

/** Read-only auth state. Use for components that only display auth info. */
export function useAuthState(): AuthStateValue {
  const context = useContext(AuthStateContext);
  if (!context) {
    throw new Error("useAuthState must be used within AuthProvider");
  }
  return context;
}

/** Auth mutation actions. Use for components that only trigger auth flows. */
export function useAuthActions(): AuthActionsValue {
  const context = useContext(AuthActionsContext);
  if (!context) {
    throw new Error("useAuthActions must be used within AuthProvider");
  }
  return context;
}

/** Combined auth context (backward compatible). */
export function useAuthContext(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }
  return context;
}

export function useOptionalAuthContext(): AuthContextType | undefined {
  return useContext(AuthContext);
}
