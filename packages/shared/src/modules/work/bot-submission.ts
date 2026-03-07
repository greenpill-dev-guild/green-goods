import { type PublicClient, type WalletClient } from "viem";
import type { Address, WorkApprovalDraft, WorkDraft } from "../../types/domain";
import { getEASConfig } from "../../config/blockchain";
import { encodeWorkApprovalData, encodeWorkData } from "../../utils/eas/encoders";
import { buildApprovalAttestTx, buildWorkAttestTx } from "../../utils/eas/transaction-builder";

/**
 * Submit work using a provided WalletClient (Node.js compatible)
 */
export async function submitWorkBot(
  client: WalletClient,
  publicClient: PublicClient,
  draft: WorkDraft,
  gardenAddress: Address,
  actionUID: number,
  actionTitle: string,
  chainId: number,
  images: File[] | Blob[] | Buffer[]
): Promise<`0x${string}`> {
  // encodeWorkData normalizes Blob -> File internally (encoders.ts).
  // Convert Buffer -> Blob here so encodeWorkData receives a type it can handle.
  const mediaFiles = images.map((img) => {
    if (typeof Buffer !== "undefined" && img instanceof Buffer) {
      return new Blob([new Uint8Array(img)], { type: "application/octet-stream" });
    }
    return img;
  }) as File[];

  const attestationData = await encodeWorkData(
    {
      ...draft,
      title: `${actionTitle} - ${new Date().toISOString()}`,
      actionUID,
      media: mediaFiles,
    },
    chainId
  );

  const easConfig = getEASConfig(chainId);
  const txParams = buildWorkAttestTx(easConfig, gardenAddress as `0x${string}`, attestationData);

  // 3. Send transaction
  if (!client.account) {
    throw new Error(
      "Bot wallet client has no account configured. Provide a wallet client with an account."
    );
  }
  const hash = await client.sendTransaction({
    ...txParams,
    chain: client.chain,
    account: client.account,
  });

  return hash;
}

/**
 * Submit approval using a provided WalletClient (Node.js compatible)
 */
export async function submitApprovalBot(
  client: WalletClient,
  draft: WorkApprovalDraft,
  gardenerAddress: Address,
  chainId: number
): Promise<`0x${string}`> {
  const attestationData = encodeWorkApprovalData(draft, chainId);

  const easConfig = getEASConfig(chainId);
  const txParams = buildApprovalAttestTx(
    easConfig,
    gardenerAddress as `0x${string}`,
    attestationData
  );

  if (!client.account) {
    throw new Error(
      "Bot wallet client has no account configured. Provide a wallet client with an account."
    );
  }
  const hash = await client.sendTransaction({
    ...txParams,
    chain: client.chain,
    account: client.account,
  });

  return hash;
}
