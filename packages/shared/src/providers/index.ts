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
export { AuthProvider, useAuthActions, useAuthContext, useAuthState } from "./Auth";

// Job Queue Provider
export { JobQueueProvider, useJobQueue, useQueueFlush, useQueueStats } from "./JobQueue";

// Work Provider
export type { WorkDataProps, WorkFormValue, WorkSelectionValue } from "./Work";
export {
  useWork,
  useWorkFormContext,
  useWorkSelection,
  WorkProvider,
  WorkTab,
} from "./Work";
