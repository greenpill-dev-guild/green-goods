import { createSmartAccountClient, type SmartAccountClient } from "permissionless";
import { toKernelSmartAccount } from "permissionless/accounts";
import { http, type Hex } from "viem";
import {
  createWebAuthnCredential,
  entryPoint07Address,
  toWebAuthnAccount,
  type P256Credential,
} from "viem/account-abstraction";

import {
  createPimlicoClientForChain,
  createPublicClientForChain,
  getChainFromId,
  getPimlicoBundlerUrl,
} from "@/modules/pimlico/config";

export interface PasskeySession {
  credential: P256Credential;
  address: Hex;
  client: SmartAccountClient;
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

export function clearStoredCredential() {
  localStorage.removeItem(PASSKEY_STORAGE_KEY);
}

const DEFAULT_SPONSORSHIP_POLICY_ID = "sp_next_monster_badoon";

async function createPasskeySession(
  chainId: number,
  credential: P256Credential
): Promise<PasskeySession> {
  const chain = getChainFromId(chainId);
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
