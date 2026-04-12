// Providers — EXPLICIT EXPORTS for tree-shaking

// App Provider
export type {
  AppDataProps,
  InstallState,
  Locale,
  Platform,
} from "./App";
export {
  AppContext,
  AppProvider,
  supportedLanguages,
  useApp,
} from "./App";

// AppKit Provider
export { AppKitProvider, useAppKit } from "./AppKitProvider";

// Auth Provider
// Unified XState-based provider with Pimlico passkey server
// Supports both passkey and wallet authentication modes
export type { AuthActionsValue, AuthContextType, AuthStateValue } from "./Auth";
export {
  AuthContext,
  AuthActionsContext,
  AuthProvider,
  AuthStateContext,
  useAuthActions,
  useAuthContext,
  useAuthState,
} from "./Auth";
export { AuthGate } from "./AuthGate";

// Job Queue Provider
export { JobQueueProvider, useJobQueue, useQueueFlush, useQueueStats } from "./JobQueue";

// Work Provider
export type { WorkDataProps, WorkFormValue, WorkSelectionValue } from "./Work";
export {
  useWorkFormContext,
  useWorkSelection,
  WorkProvider,
  WorkTab,
} from "./Work";
// Compatibility exports
// Prefer useWorkSelection/useWorkFormContext in new code.
export { useWork } from "./Work";
