import { createSmartAccountClient, type SmartAccountClient } from "permissionless";
import { toKernelSmartAccount } from "permissionless/accounts";
import { type Hex, http } from "viem";
import {
  createWebAuthnCredential,
  type P256Credential,
  toWebAuthnAccount,
  entryPoint07Address,
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

async function createPasskeySession(chainId: number, credential: P256Credential): Promise<PasskeySession> {
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

  const client = createSmartAccountClient({
    account,
    chain,
    bundlerTransport: http(bundlerUrl),
    paymaster: pimlicoClient,
  });

  return {
    credential,
    address: account.address,
    client,
  };
}

export async function registerPasskeySession(chainId: number): Promise<PasskeySession> {
  const credential = await createWebAuthnCredential({ name: "Green Goods Wallet" });
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
    throw error instanceof Error
      ? error
      : new Error("Failed to restore saved passkey credential");
  }
}
