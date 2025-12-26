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
export type { AuthContextType } from "./Auth";
export { AuthProvider, useAuthContext } from "./Auth";

// Job Queue Provider
export { JobQueueProvider, useJobQueue, useQueueFlush, useQueueStats } from "./JobQueue";

// Work Provider
export type { WorkDataProps } from "./Work";
export { useWork, WorkProvider, WorkTab } from "./Work";
