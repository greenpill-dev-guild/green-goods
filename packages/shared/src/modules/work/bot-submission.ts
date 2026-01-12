import { type PublicClient, type WalletClient } from "viem";
import type { WorkApprovalDraft, WorkDraft } from "../../types/domain";
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
  gardenAddress: string,
  actionUID: number,
  actionTitle: string,
  chainId: number,
  images: File[] | Blob[] | Buffer[] // Bot might pass Buffers
): Promise<`0x${string}`> {
  // 1. Encode work data (uploads to IPFS internally)
  // Note: encodeWorkData needs to handle the image types correctly.
  // If encodeWorkData expects browser Files, we might need to adjust it or mock it.
  // For now assuming encodeWorkData can handle what we pass or we'll fix it.

  const attestationData = await encodeWorkData(
    {
      ...draft,
      title: `${actionTitle} - ${new Date().toISOString()}`,
      actionUID,
      media: images as any, // Cast for now, will verify encodeWorkData
    },
    chainId
  );

  // 2. Prepare EAS attestation transaction
  const easConfig = getEASConfig(chainId);
  const txParams = buildWorkAttestTx(easConfig, gardenAddress as `0x${string}`, attestationData);

  // 3. Send transaction
  const hash = await client.sendTransaction({
    ...txParams,
    chain: client.chain,
    account: client.account!,
  });

  return hash;
}

/**
 * Submit approval using a provided WalletClient (Node.js compatible)
 */
export async function submitApprovalBot(
  client: WalletClient,
  draft: WorkApprovalDraft,
  gardenerAddress: string,
  chainId: number
): Promise<`0x${string}`> {
  const attestationData = encodeWorkApprovalData(draft, chainId);

  const easConfig = getEASConfig(chainId);
  const txParams = buildApprovalAttestTx(
    easConfig,
    gardenerAddress as `0x${string}`,
    attestationData
  );

  const hash = await client.sendTransaction({
    ...txParams,
    chain: client.chain,
    account: client.account!,
  });

  return hash;
}
