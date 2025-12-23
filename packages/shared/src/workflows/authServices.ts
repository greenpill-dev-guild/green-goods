/**
 * Authentication Services for XState Machine
 *
 * These services handle the async operations for the auth machine,
 * using Pimlico's passkey server for credential storage.
 *
 * Services:
 * - restoreSession: Check for existing session on app start
 * - registerPasskey: Create new passkey (new user)
 * - authenticatePasskey: Login with existing passkey (returning user)
 * - claimENS: Claim ENS subdomain on mainnet
 *
 * Reference: https://docs.pimlico.io/guides/how-to/signers/passkey-server
 */

import { createSmartAccountClient, type SmartAccountClient } from "permissionless";
import { toKernelSmartAccount } from "permissionless/accounts";
import { encodeFunctionData, type Hex, http } from "viem";
import {
  entryPoint07Address,
  type P256Credential,
  toWebAuthnAccount,
} from "viem/account-abstraction";
import { fromPromise } from "xstate";

import { getChain } from "../config/chains";
import {
  createPasskeyServerClient,
  createPasskeyWithServer,
  type PasskeyServerClient,
} from "../config/passkeyServer";
import {
  createPimlicoClientForChain,
  createPublicClientForChain,
  getPimlicoBundlerUrl,
} from "../config/pimlico";
import { clearStoredUsername, getStoredUsername, setStoredUsername } from "../modules/auth/session";

import type { PasskeySessionResult, RestoreSessionResult } from "./authMachine";

// ============================================================================
// TYPES
// ============================================================================

interface RegisterInput {
  passkeyClient: PasskeyServerClient | null;
  userName: string | null;
  chainId: number;
}

interface AuthenticateInput {
  passkeyClient: PasskeyServerClient | null;
  userName: string | null;
  chainId: number;
}

interface RestoreInput {
  passkeyClient: PasskeyServerClient | null;
  chainId: number;
}

interface ClaimENSInput {
  smartAccountClient: SmartAccountClient | null;
  name: string;
}

const DEFAULT_SPONSORSHIP_POLICY_ID = "sp_next_monster_badoon";

// ============================================================================
// HELPER: Build Smart Account from Credential
// ============================================================================

async function buildSmartAccountFromCredential(
  credential: P256Credential,
  chainId: number
): Promise<{ client: SmartAccountClient; address: Hex }> {
  const chain = getChain(chainId);
  const publicClient = createPublicClientForChain(chainId);
  const pimlicoClient = createPimlicoClientForChain(chainId);
  const bundlerUrl = getPimlicoBundlerUrl(chainId);

  const webAuthnAccount = toWebAuthnAccount({ credential });

  const account = await toKernelSmartAccount({
    client: publicClient,
    version: "0.3.1",
    owners: [webAuthnAccount],
    entryPoint: {
      address: entryPoint07Address,
      version: "0.7",
    },
  });

  const sponsorshipPolicyId =
    import.meta.env.VITE_PIMLICO_SPONSORSHIP_POLICY_ID || DEFAULT_SPONSORSHIP_POLICY_ID;

  const client = createSmartAccountClient({
    account,
    chain,
    bundlerTransport: http(bundlerUrl),
    paymaster: pimlicoClient,
    paymasterContext: { sponsorshipPolicyId },
    userOperation: {
      estimateFeesPerGas: async () => {
        const { fast } = await pimlicoClient.getUserOperationGasPrice();
        return {
          maxFeePerGas: fast.maxFeePerGas,
          maxPriorityFeePerGas: fast.maxPriorityFeePerGas,
        };
      },
    },
  });

  return { client, address: account.address };
}

// ============================================================================
// SERVICE: Restore Session
// ============================================================================

/**
 * Restore session from Pimlico server
 *
 * Flow:
 * 1. Check for stored username (only thing stored locally)
 * 2. Fetch credentials from Pimlico server
 * 3. Build smart account (silent - no biometric until first tx)
 */
// Session restore timeout in milliseconds (5 seconds)
const SESSION_RESTORE_TIMEOUT = 5000;

export const restoreSessionService = fromPromise<RestoreSessionResult | null, RestoreInput>(
  async ({ input }) => {
    const { chainId } = input;

    console.debug("[AuthServices] restoreSession starting with chainId:", chainId);

    // Check for stored username
    const storedUsername = getStoredUsername();
    console.debug("[AuthServices] Stored username:", storedUsername);

    if (!storedUsername) {
      console.debug("[AuthServices] No stored username, returning null");
      return null;
    }

    // Create passkey server client
    const passkeyClient = createPasskeyServerClient(chainId);
    console.debug("[AuthServices] Created passkey server client for chain:", chainId);

    try {
      // Fetch credentials from Pimlico server with timeout for poor network
      console.debug("[AuthServices] Fetching credentials from Pimlico for user:", storedUsername);
      const credentials = await Promise.race([
        passkeyClient.getCredentials({
          context: { userName: storedUsername },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Session restore timeout")), SESSION_RESTORE_TIMEOUT)
        ),
      ]);

      console.debug("[AuthServices] Received credentials count:", credentials.length);

      if (credentials.length === 0) {
        // No credentials on server - clear local username
        console.warn("[AuthServices] No credentials on Pimlico server, clearing local username");
        clearStoredUsername();
        return null;
      }

      // Use first credential (most recent)
      const credential = credentials[0];
      console.debug("[AuthServices] Using credential:", credential.id);

      // Build smart account (silent - no biometric prompt)
      console.debug("[AuthServices] Building smart account...");
      const { client, address } = await buildSmartAccountFromCredential(credential, chainId);
      console.debug("[AuthServices] Smart account built:", address);

      return {
        credential,
        smartAccountClient: client,
        smartAccountAddress: address,
        userName: storedUsername,
      };
    } catch (error) {
      if (error instanceof Error && error.message === "Session restore timeout") {
        console.warn("[AuthServices] Session restore timed out - user can re-authenticate");
      } else {
        console.error("[AuthServices] Failed to restore session from Pimlico:", error);
      }
      // Don't clear username on network errors - user still has account
      // Only clear if we successfully contacted server but found no credentials (handled above)
      return null;
    }
  }
);

// ============================================================================
// SERVICE: Register Passkey (New User)
// ============================================================================

/**
 * Register a new passkey for a new user using Pimlico server
 *
 * Flow:
 * 1. Start registration on Pimlico server
 * 2. Create WebAuthn credential (prompts biometric)
 * 3. Verify registration on Pimlico server (stores credential)
 * 4. Build smart account client
 */
export const registerPasskeyService = fromPromise<PasskeySessionResult, RegisterInput>(
  async ({ input }) => {
    const { userName, chainId } = input;

    if (!userName) {
      throw new Error("Username is required for registration");
    }

    // Create passkey server client
    const passkeyClient = createPasskeyServerClient(chainId);

    // Create and register credential via Pimlico server
    const credential = await createPasskeyWithServer(passkeyClient, userName);

    // Store username locally for session restore
    setStoredUsername(userName);

    // Build smart account
    const { client, address } = await buildSmartAccountFromCredential(credential, chainId);

    return {
      credential,
      smartAccountClient: client,
      smartAccountAddress: address,
      userName,
    };
  }
);

// ============================================================================
// SERVICE: Authenticate Passkey (Existing User)
// ============================================================================

/**
 * Authenticate with existing passkey using Pimlico server
 *
 * Flow:
 * 1. Fetch credentials from Pimlico server
 * 2. Prompt biometric authentication
 * 3. Build smart account client
 */
export const authenticatePasskeyService = fromPromise<PasskeySessionResult, AuthenticateInput>(
  async ({ input }) => {
    const { userName, chainId } = input;

    if (!userName) {
      throw new Error("Username is required for authentication");
    }

    // Create passkey server client
    const passkeyClient = createPasskeyServerClient(chainId);

    // Fetch credentials from Pimlico server
    const credentials = await passkeyClient.getCredentials({
      context: { userName },
    });

    if (credentials.length === 0) {
      throw new Error("No passkey found for this account. Please create a new account.");
    }

    // Use first credential
    const credential = credentials[0];

    // Prompt biometric authentication
    // Convert credential ID to BufferSource for WebAuthn
    let credentialIdBytes: Uint8Array;
    try {
      // Base64URL decode
      let base64 = credential.id.replace(/-/g, "+").replace(/_/g, "/");
      const padding = base64.length % 4;
      if (padding === 2) base64 += "==";
      else if (padding === 3) base64 += "=";

      const decodedData = atob(base64);
      credentialIdBytes = new Uint8Array(decodedData.length);
      for (let i = 0; i < decodedData.length; i++) {
        credentialIdBytes[i] = decodedData.charCodeAt(i);
      }
    } catch {
      // Try hex decoding as fallback
      const hex = credential.id.replace(/^0x/, "");
      const bytes = hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || [];
      if (bytes.some((b) => isNaN(b))) {
        throw new Error("Invalid credential ID format");
      }
      credentialIdBytes = new Uint8Array(bytes);
    }

    // Prompt WebAuthn authentication (biometric)
    const authResponse = await window.navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: window.location.hostname,
        userVerification: "required",
        allowCredentials: [
          {
            id: credentialIdBytes as BufferSource,
            type: "public-key",
          },
        ],
        timeout: 60000,
      },
    });

    if (!authResponse) {
      throw new Error("Passkey authentication was cancelled");
    }

    // Store username for session restore
    setStoredUsername(userName);

    // Build smart account with the credential from server
    const { client, address } = await buildSmartAccountFromCredential(credential, chainId);

    return {
      credential,
      smartAccountClient: client,
      smartAccountAddress: address,
      userName,
    };
  }
);

// ============================================================================
// SERVICE: Claim ENS
// ============================================================================

/**
 * Claim ENS subdomain on mainnet
 */
export const claimENSService = fromPromise<void, ClaimENSInput>(async ({ input }) => {
  const { smartAccountClient, name } = input;

  if (!smartAccountClient) {
    throw new Error("Smart account client required for ENS claim");
  }

  const ensRegistrarAddress = import.meta.env.VITE_ENS_REGISTRAR_ADDRESS as Hex | undefined;

  if (
    !ensRegistrarAddress ||
    ensRegistrarAddress === "0x0000000000000000000000000000000000000000"
  ) {
    console.debug("[AuthServices] ENS claiming skipped: VITE_ENS_REGISTRAR_ADDRESS not configured");
    return;
  }

  // ENSRegistrar ABI
  const ensRegistrarABI = [
    {
      inputs: [
        { name: "name", type: "string" },
        { name: "owner", type: "address" },
      ],
      name: "register",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
  ] as const;

  const data = encodeFunctionData({
    abi: ensRegistrarABI,
    functionName: "register",
    args: [name, smartAccountClient.account!.address],
  });

  await smartAccountClient.sendTransaction({
    account: smartAccountClient.account!,
    to: ensRegistrarAddress,
    data,
    chain: undefined,
  });
});

// ============================================================================
// EXPORT ALL SERVICES
// ============================================================================

export const authServices = {
  restoreSession: restoreSessionService,
  registerPasskey: registerPasskeyService,
  authenticatePasskey: authenticatePasskeyService,
  claimENS: claimENSService,
};
