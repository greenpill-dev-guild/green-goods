/**
 * Authentication Services for XState Machine
 *
 * These services handle the async operations for the auth machine:
 * - restoreSession: Check for existing session on app start
 * - registerPasskey: Create new passkey (new user)
 * - authenticatePasskey: Login with existing passkey (returning user)
 * - claimENS: Claim ENS subdomain on mainnet
 *
 * Note: During migration, these services support both:
 * - Legacy: localStorage credential storage
 * - Future: Pimlico server credential storage
 */

import { createSmartAccountClient, type SmartAccountClient } from "permissionless";
import { toKernelSmartAccount } from "permissionless/accounts";
import { fromPromise } from "xstate";
import { encodeFunctionData, type Hex, http } from "viem";
import {
  createWebAuthnCredential,
  entryPoint07Address,
  type P256Credential,
  toWebAuthnAccount,
} from "viem/account-abstraction";

import { getChain } from "../config/chains";
import { type PasskeyServerClient, createPasskeyCredential } from "../config/passkeyServer";
import {
  createPimlicoClientForChain,
  createPublicClientForChain,
  getPimlicoBundlerUrl,
} from "../config/pimlico";
import {
  getStoredUsername,
  setStoredUsername,
  clearStoredUsername,
  hasStoredPasskey,
  PASSKEY_STORAGE_KEY,
} from "../modules/auth/session";

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
// HELPER: Legacy localStorage Credential
// ============================================================================

interface SerializedCredential {
  id: string;
  publicKey: string;
  raw: unknown;
}

function deserializeCredential(serialized: SerializedCredential): P256Credential {
  return {
    id: serialized.id,
    publicKey: serialized.publicKey as Hex,
    raw: serialized.raw,
  } as P256Credential;
}

function persistCredential(credential: P256Credential): void {
  localStorage.setItem(
    PASSKEY_STORAGE_KEY,
    JSON.stringify({
      id: credential.id,
      publicKey: credential.publicKey,
      raw: credential.raw,
    })
  );
}

// ============================================================================
// SERVICE: Restore Session
// ============================================================================

/**
 * Restore session from stored credentials
 *
 * Checks:
 * 1. Pimlico server (if userName stored) - FUTURE
 * 2. Legacy localStorage credential - CURRENT
 */
export const restoreSessionService = fromPromise<RestoreSessionResult | null, RestoreInput>(
  async ({ input }) => {
    const { chainId } = input;

    // Check for stored username (Pimlico server approach)
    const storedUsername = getStoredUsername();

    // Check for legacy localStorage credential
    const storedCredential = localStorage.getItem(PASSKEY_STORAGE_KEY);

    if (!storedUsername && !storedCredential) {
      // No stored session
      return null;
    }

    // For now, use legacy localStorage approach
    // TODO: Once Pimlico server is fully integrated, check server first
    if (storedCredential) {
      try {
        const parsed = JSON.parse(storedCredential) as SerializedCredential;
        const credential = deserializeCredential(parsed);
        const { client, address } = await buildSmartAccountFromCredential(credential, chainId);

        return {
          credential,
          smartAccountClient: client,
          smartAccountAddress: address,
          userName: storedUsername || "user", // Fallback for legacy
        };
      } catch (error) {
        console.error("[AuthServices] Failed to restore legacy session:", error);
        // Clear invalid credential
        localStorage.removeItem(PASSKEY_STORAGE_KEY);
        clearStoredUsername();
        return null;
      }
    }

    return null;
  }
);

// ============================================================================
// SERVICE: Register Passkey (New User)
// ============================================================================

/**
 * Register a new passkey for a new user
 *
 * Flow:
 * 1. Create WebAuthn credential (prompts biometric)
 * 2. Store credential (localStorage for now, server later)
 * 3. Build smart account client
 */
export const registerPasskeyService = fromPromise<PasskeySessionResult, RegisterInput>(
  async ({ input }) => {
    const { userName, chainId } = input;

    if (!userName) {
      throw new Error("Username is required for registration");
    }

    // Create new WebAuthn credential
    const credential = await createWebAuthnCredential({
      name: "Green Goods Wallet",
      createFn: async (options) => {
        const credentialOptions = options as CredentialCreationOptions | undefined;
        const publicKeyOptions = credentialOptions?.publicKey;

        // Ensure algorithm support
        if (publicKeyOptions) {
          const existing = publicKeyOptions.pubKeyCredParams ?? [];
          const defaults: PublicKeyCredentialParameters[] = [
            { type: "public-key", alg: -7 }, // ES256
            { type: "public-key", alg: -257 }, // RS256
          ];
          const merged = defaults.concat(existing);
          const deduped: PublicKeyCredentialParameters[] = [];
          const seen = new Set<number>();

          for (const param of merged) {
            if (seen.has(param.alg)) continue;
            seen.add(param.alg);
            deduped.push(param);
          }

          publicKeyOptions.pubKeyCredParams = deduped;
        }

        return window.navigator.credentials.create(credentialOptions);
      },
    });

    // Store credential (legacy localStorage for now)
    persistCredential(credential);

    // Store username for session restore
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
 * Authenticate with existing passkey
 *
 * Flow:
 * 1. Get stored credential (localStorage for now, server later)
 * 2. Prompt biometric authentication
 * 3. Build smart account client
 */
export const authenticatePasskeyService = fromPromise<PasskeySessionResult, AuthenticateInput>(
  async ({ input }) => {
    const { userName, chainId } = input;

    // Get stored credential
    const storedCredential = localStorage.getItem(PASSKEY_STORAGE_KEY);
    if (!storedCredential) {
      throw new Error("No passkey found. Please create a new account.");
    }

    const parsed = JSON.parse(storedCredential) as SerializedCredential;
    const credential = deserializeCredential(parsed);

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

    // Prompt WebAuthn authentication
    const credentialResponse = await window.navigator.credentials.get({
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

    if (!credentialResponse) {
      throw new Error("Passkey authentication was cancelled");
    }

    // Store/update username
    if (userName) {
      setStoredUsername(userName);
    }

    // Build smart account
    const { client, address } = await buildSmartAccountFromCredential(credential, chainId);

    return {
      credential,
      smartAccountClient: client,
      smartAccountAddress: address,
      userName: userName || getStoredUsername() || "user",
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
