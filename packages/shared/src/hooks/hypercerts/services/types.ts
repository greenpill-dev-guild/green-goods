/**
 * Shared types for hypercert minting service actors.
 *
 * Each service factory accepts mutable refs to React state so that
 * XState actors always read the *current* wallet/auth values without
 * requiring machine recreation on every change.
 *
 * @module hooks/hypercerts/services/types
 */

import type { MutableRefObject } from "react";
import type { SmartAccountClient } from "permissionless";
import type { WalletClient } from "viem";
import type { AuthMode } from "../../../modules/auth/session";

/**
 * Mutable dependency refs passed to every service factory.
 * These refs are maintained by the useMintHypercert hook and
 * updated via useEffect on each render cycle.
 */
export interface MintServiceDeps {
  walletClientRef: MutableRefObject<WalletClient | undefined | null>;
  smartAccountClientRef: MutableRefObject<SmartAccountClient | undefined | null>;
  eoaAddressRef: MutableRefObject<string | undefined | null>;
  authModeRef: MutableRefObject<AuthMode>;
  chainIdRef: MutableRefObject<number>;
}
