import { createSmartAccountClient, type SmartAccountClient } from "permissionless";
import { toKernelSmartAccount } from "permissionless/accounts";
import { encodeFunctionData, type Hex, http } from "viem";
import {
  createWebAuthnCredential,
  entryPoint07Address,
  type P256Credential,
  toWebAuthnAccount,
} from "viem/account-abstraction";
import { getChain } from "../../config/chains";
import {
  createPimlicoClientForChain,
  createPublicClientForChain,
  getPimlicoBundlerUrl,
} from "../../config/pimlico";

/** Session data for interacting with Pimlico smart accounts via WebAuthn. */
export interface PasskeySession {
  credential: P256Credential;
  address: Hex;
  client: SmartAccountClient;
  ensName?: string; // ENS name if claimed on mainnet
  mainnetClient?: SmartAccountClient; // Mainnet client for ENS operations
}

interface SerializedCredential {
  id: string;
  publicKey: string;
  raw: unknown;
}

export const PASSKEY_STORAGE_KEY = "greengoods_passkey_credential";

function serializeCredential(credential: P256Credential): SerializedCredential {
  return {
    id: credential.id,
    publicKey: credential.publicKey,
    raw: credential.raw,
  };
}

function deserializeCredential(serialized: SerializedCredential): P256Credential {
  return {
    id: serialized.id,
    publicKey: serialized.publicKey as Hex,
    raw: serialized.raw,
  } as P256Credential;
}

function persistCredential(credential: P256Credential) {
  localStorage.setItem(PASSKEY_STORAGE_KEY, JSON.stringify(serializeCredential(credential)));
}

/** Removes any persisted passkey credential from local storage. */
export function clearStoredCredential() {
  localStorage.removeItem(PASSKEY_STORAGE_KEY);
}

/**
 * Converts a Base64URL-encoded string to a Uint8Array.
 * Base64URL uses `-` and `_` instead of `+` and `/`, and omits padding.
 *
 * @param base64Url - Base64URL-encoded string
 * @returns Uint8Array of decoded bytes
 */
function base64UrlDecode(base64Url: string): Uint8Array {
  // Replace URL-safe characters with standard Base64 characters
  let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");

  // Calculate and restore padding
  const padding = base64.length % 4;
  if (padding === 2) {
    base64 += "==";
  } else if (padding === 3) {
    base64 += "=";
  }

  // Decode the Base64 string
  const decodedData = atob(base64);

  // Convert the decoded string to a Uint8Array
  const uint8Array = new Uint8Array(decodedData.length);
  for (let i = 0; i < decodedData.length; i++) {
    uint8Array[i] = decodedData.charCodeAt(i);
  }

  return uint8Array;
}

/**
 * Recovers a passkey account using ENS name.
 *
 * @param ensName - The ENS subdomain name (e.g., "alice" for alice.greengoods.eth)
 * @param chainId - The L2 chain ID for operations (defaults to env VITE_CHAIN_ID)
 * @returns PasskeySession with recovered account
 *
 * @remarks
 * This function:
 * 1. Queries mainnet ENSRegistrar to resolve the ENS name to an account address
 * 2. Prompts the user to authenticate with their passkey (WebAuthn)
 * 3. Recreates the session clients for both mainnet and L2
 *
 * The passkey must be synced across devices (iCloud Keychain, Google Password Manager, etc.)
 * for recovery to work on a new device.
 */
export async function recoverPasskeyAccount(
  ensName: string,
  chainId: number = Number(import.meta.env.VITE_CHAIN_ID || 84532)
): Promise<PasskeySession> {
  // Clean up ENS name (remove .greengoods.eth if present)
  const cleanName = ensName.replace(".greengoods.eth", "").toLowerCase().trim();

  if (!cleanName) {
    throw new Error("Please enter a valid username");
  }

  // TODO: Query mainnet ENSRegistrar to get the account address
  // For now, this is a placeholder that prompts for the passkey
  // In a full implementation, you would:
  // 1. Query ENSRegistrar.resolve(cleanName) on mainnet
  // 2. Get the account address
  // 3. Verify the account exists

  // Prompt user to authenticate with their passkey
  // This will trigger the WebAuthn authentication flow
  let credential: P256Credential;

  try {
    // Use WebAuthn get() to authenticate with existing passkey
    const credentialResponse = await window.navigator.credentials.get({
      publicKey: {
        challenge: new Uint8Array(32), // Dummy challenge for recovery
        rpId: window.location.hostname,
        userVerification: "required",
      },
    });

    if (!credentialResponse) {
      throw new Error("No passkey found. Please ensure your passkey is synced to this device.");
    }

    // Convert the credential response to P256Credential format
    const publicKeyCredential = credentialResponse as PublicKeyCredential;

    // Extract the credential data
    credential = {
      id: publicKeyCredential.id as Hex,
      publicKey: publicKeyCredential.id as Hex, // Simplified - in production, extract from response
      raw: credentialResponse,
    } as P256Credential;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "NotAllowedError") {
        throw new Error("Passkey authentication was cancelled");
      }
      if (error.name === "SecurityError") {
        throw new Error("Passkey authentication failed. Please try again.");
      }
    }
    throw new Error("Failed to authenticate with passkey. Ensure your passkey is synced.");
  }

  // Persist the recovered credential
  persistCredential(credential);

  // Create sessions for both L2 and mainnet
  const l2Session = await createPasskeySession(chainId, credential);

  try {
    const mainnetSession = await createPasskeySession(1, credential);

    return {
      ...l2Session,
      ensName: `${cleanName}.greengoods.eth`,
      mainnetClient: mainnetSession.client,
    };
  } catch (error) {
    console.warn("Could not create mainnet session during recovery:", error);
    // Return L2-only session
    return l2Session;
  }
}

const DEFAULT_SPONSORSHIP_POLICY_ID = "sp_next_monster_badoon";

async function createPasskeySession(
  chainId: number,
  credential: P256Credential
): Promise<PasskeySession> {
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

  return {
    credential,
    address: account.address,
    client,
  };
}

/** Creates a new WebAuthn credential and hydrates a smart account client for the given chain. */
export async function registerPasskeySession(chainId: number): Promise<PasskeySession> {
  const credential = await createWebAuthnCredential({
    name: "Green Goods Wallet",
    createFn: async (options) => {
      const credentialOptions = options as CredentialCreationOptions | undefined;
      const publicKeyOptions = credentialOptions?.publicKey;
      if (publicKeyOptions) {
        const existing = publicKeyOptions.pubKeyCredParams ?? [];
        const defaults: PublicKeyCredentialParameters[] = [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ];
        const merged = defaults.concat(existing);
        const deduped: PublicKeyCredentialParameters[] = [];
        const seen = new Set<number>();

        for (const param of merged) {
          if (seen.has(param.alg)) {
            continue;
          }
          seen.add(param.alg);
          deduped.push(param);
        }

        publicKeyOptions.pubKeyCredParams = deduped;
      }

      return window.navigator.credentials.create(credentialOptions);
    },
  });
  persistCredential(credential);
  return createPasskeySession(chainId, credential);
}

/**
 * Creates a new WebAuthn credential with dual-chain support for ENS claiming.
 *
 * @param chainId - The L2 chain ID for protocol operations (Arbitrum, Celo, Base Sepolia)
 * @param ensName - The ENS subdomain name to claim (e.g., "alice" for alice.greengoods.eth)
 * @param options - Optional configuration
 * @returns PasskeySession with both mainnet and L2 clients
 *
 * @remarks
 * This function creates a Gardener smart account on both mainnet and the specified L2:
 * - Mainnet: For ENS subdomain claiming (gasless via Pimlico)
 * - L2: For garden operations (gasless via Pimlico)
 *
 * The same passkey credential is used for both chains, ensuring the same account address.
 */
export async function registerPasskeySessionWithENS(
  chainId: number,
  ensName: string,
  options?: {
    skipENSClaim?: boolean; // Skip ENS claiming (useful for testing L2-only)
  }
): Promise<PasskeySession> {
  // 1. Create WebAuthn credential
  const credential = await createWebAuthnCredential({
    name: "Green Goods Wallet",
    createFn: async (options) => {
      const credentialOptions = options as CredentialCreationOptions | undefined;
      const publicKeyOptions = credentialOptions?.publicKey;
      if (publicKeyOptions) {
        const existing = publicKeyOptions.pubKeyCredParams ?? [];
        const defaults: PublicKeyCredentialParameters[] = [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ];
        const merged = defaults.concat(existing);
        const deduped: PublicKeyCredentialParameters[] = [];
        const seen = new Set<number>();

        for (const param of merged) {
          if (seen.has(param.alg)) {
            continue;
          }
          seen.add(param.alg);
          deduped.push(param);
        }

        publicKeyOptions.pubKeyCredParams = deduped;
      }

      return window.navigator.credentials.create(credentialOptions);
    },
  });

  persistCredential(credential);

  // 2. Create L2 session for protocol operations
  const l2Session = await createPasskeySession(chainId, credential);

  // 3. Claim ENS on mainnet (optional)
  // ENS claiming requires VITE_ENS_REGISTRAR_ADDRESS to be configured
  const ensRegistrarAddress = import.meta.env.VITE_ENS_REGISTRAR_ADDRESS as Hex | undefined;
  const isEnsConfigured =
    ensRegistrarAddress && ensRegistrarAddress !== "0x0000000000000000000000000000000000000000";

  if (!options?.skipENSClaim && isEnsConfigured) {
    try {
      const mainnetSession = await createPasskeySession(1, credential); // Mainnet

      // Convert credential ID to bytes32 for on-chain storage
      const credentialId = credential.id as Hex;

      // ENSRegistrar ABI for register function
      const ensRegistrarABI = [
        {
          inputs: [
            { name: "name", type: "string" },
            { name: "owner", type: "address" },
            { name: "credentialId", type: "bytes32" },
          ],
          name: "register",
          outputs: [],
          stateMutability: "nonpayable",
          type: "function",
        },
      ] as const;

      // Encode function call to ENSRegistrar
      const data = encodeFunctionData({
        abi: ensRegistrarABI,
        functionName: "register",
        args: [ensName, mainnetSession.address, credentialId],
      });

      // Ensure account is available
      if (!mainnetSession.client.account) {
        throw new Error("Smart account not available for ENS claiming");
      }

      // Send gasless transaction to ENSRegistrar directly (more gas efficient)
      await mainnetSession.client.sendTransaction({
        account: mainnetSession.client.account,
        to: ensRegistrarAddress,
        data,
        chain: undefined,
      });

      return {
        ...l2Session,
        ensName: `${ensName}.greengoods.eth`,
        mainnetClient: mainnetSession.client,
      };
    } catch (error) {
      console.error("Failed to claim ENS name on mainnet:", error);
      // Continue with L2-only session
      return l2Session;
    }
  } else if (!options?.skipENSClaim && !isEnsConfigured) {
    // Log that ENS claiming is skipped due to missing configuration
    console.debug(
      "[Passkey] ENS claiming skipped: VITE_ENS_REGISTRAR_ADDRESS not configured. " +
        "Set this environment variable to enable ENS subdomain claiming."
    );
  }

  return l2Session;
}

/** Restores a previously saved credential and rebuilds the associated smart account session. */
export async function restorePasskeySession(chainId: number): Promise<PasskeySession | null> {
  const stored = localStorage.getItem(PASSKEY_STORAGE_KEY);
  if (!stored) {
    return null;
  }

  try {
    const parsed = JSON.parse(stored) as SerializedCredential;
    const credential = deserializeCredential(parsed);
    return await createPasskeySession(chainId, credential);
  } catch (error) {
    clearStoredCredential();
    throw error instanceof Error ? error : new Error("Failed to restore saved passkey credential");
  }
}

/**
 * Authenticates with an existing passkey credential.
 * Prompts user for WebAuthn authentication (biometric/password).
 *
 * @param chainId - The chain ID for operations (defaults to env VITE_CHAIN_ID)
 * @returns PasskeySession with authenticated account
 *
 * @remarks
 * This function:
 * 1. Loads the stored credential from localStorage
 * 2. Prompts user to authenticate with their passkey (navigator.credentials.get)
 * 3. Recreates the session with the authenticated credential
 *
 * Use this for returning users who already have a passkey.
 * This will always prompt for biometric/password authentication.
 */
export async function authenticatePasskey(
  chainId: number = Number(import.meta.env.VITE_CHAIN_ID || 84532)
): Promise<PasskeySession> {
  const stored = localStorage.getItem(PASSKEY_STORAGE_KEY);
  if (!stored) {
    throw new Error("No passkey found. Please create a new account.");
  }

  try {
    const parsed = JSON.parse(stored) as SerializedCredential;
    const storedCredential = deserializeCredential(parsed);

    // Convert credential ID to BufferSource for WebAuthn
    // WebAuthn credential IDs are Base64URL-encoded (uses `-` and `_` instead of `+` and `/`)
    let credentialIdBytes: Uint8Array;
    try {
      // Try decoding as Base64URL (standard WebAuthn format)
      credentialIdBytes = base64UrlDecode(storedCredential.id);
    } catch {
      // If Base64URL decoding fails, try hex decoding as fallback
      // (some older credentials might be stored as hex)
      try {
        const hex = storedCredential.id.replace(/^0x/, "");
        const bytes = hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || [];
        // Validate hex decoding didn't produce NaN values
        if (bytes.some((b) => isNaN(b))) {
          throw new Error("Invalid hex format");
        }
        credentialIdBytes = new Uint8Array(bytes);
      } catch {
        throw new Error(
          `Failed to decode credential ID. Expected Base64URL or hex format, got: ${storedCredential.id.substring(0, 20)}...`
        );
      }
    }

    // Prompt user to authenticate with their passkey
    // This will trigger biometric/password prompt
    const credentialResponse = await window.navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)), // Random challenge for authentication
        rpId: window.location.hostname,
        userVerification: "required",
        allowCredentials: [
          {
            id: credentialIdBytes as BufferSource,
            type: "public-key",
          },
        ],
        timeout: 60000, // 60 second timeout
      },
    });

    if (!credentialResponse) {
      throw new Error("Passkey authentication was cancelled");
    }

    // Use the stored credential (the WebAuthn response is just for verification)
    // The actual credential we use is the one from localStorage
    return await createPasskeySession(chainId, storedCredential);
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "NotAllowedError") {
        throw new Error("Passkey authentication was cancelled");
      }
      if (error.name === "SecurityError" || error.name === "NotSupportedError") {
        throw new Error("Passkey authentication failed. Please try again.");
      }
      if (error.name === "InvalidStateError") {
        throw new Error("Passkey authentication failed. Please try again.");
      }
    }
    throw error instanceof Error ? error : new Error("Failed to authenticate with passkey");
  }
}
