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

// Auth Providers
// Unified XState-based provider with Pimlico passkey server
export type { AuthContextType } from "./Auth";
export { AuthProvider, useAuthContext, useOptionalAuthContext } from "./Auth";

// Wallet-only provider (for admin package)
export { WalletAuthProvider, useWalletAuth, useOptionalWalletAuth } from "./WalletAuth";

// Job Queue Provider
export { JobQueueProvider, useJobQueue, useQueueFlush, useQueueStats } from "./JobQueue";

// Work Provider
export type { WorkDataProps } from "./Work";
export { useWork, WorkProvider, WorkTab } from "./Work";
