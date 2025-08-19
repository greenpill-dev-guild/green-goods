import { http, createPublicClient } from "viem";
import { toKernelSmartAccount } from "permissionless/accounts";
import { createSmartAccountClient, type SmartAccountClient } from "permissionless";
import {
  toWebAuthnAccount,
  entryPoint07Address,
  type SmartAccount,
} from "viem/account-abstraction";
import { getDefaultChain } from "@/config";
import { getPasskeyCredential } from "@/modules/aa/remote";

// NOTE: viem/account-abstraction exposes toWebAuthnAccount in newer versions;
// to keep compatibility, we will use a local wrapper that expects the server
// to verify WebAuthn assertions and the kernel validator to reconstruct the signature format.
// For now, we will rely on sending the WebAuthn assertion as the signature payload
// in userOp.signatures and have the on-chain validator interpret it. This wiring
// depends on the Kernel passkey validator you deploy; adapt accordingly.

export async function buildPasskeyKernelClient(): Promise<SmartAccountClient> {
  const chain = getDefaultChain();
  const publicClient = createPublicClient({ chain, transport: http() });
  const bundlerProxy = `/aa/bundler?chainId=${chain.id}`;

  const credential = await getPasskeyCredential();
  if (!credential) throw new Error("missing_passkey_credential");

  const owner = toWebAuthnAccount({ credentialId: credential.id, publicKey: credential.publicKey });

  const account: SmartAccount = await toKernelSmartAccount({
    owner,
    client: publicClient,
    entryPoint: {
      // EntryPoint v0.7 canonical address
      address: (entryPoint07Address as string) || "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
      version: "0.7",
    },
  });

  const smartAccountClient = createSmartAccountClient({
    account,
    chain,
    bundlerTransport: http(bundlerProxy),
  });

  return smartAccountClient;
}

export async function ensureSmartAccountDeployed(): Promise<`0x${string}`> {
  const client = await buildPasskeyKernelClient();
  // Send a minimal userOp to trigger initCode deployment (no-op call)
  try {
    const hash = await client.sendUserOperation({
      target: client.account?.address as `0x${string}`,
      data: "0x",
      value: 0n,
    });
    return hash as `0x${string}`;
  } catch {
    // If already deployed or bundler rejects no-op, ignore
    return "0x" as `0x${string}`;
  }
}
