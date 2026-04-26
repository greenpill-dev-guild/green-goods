import { type Address, type PublicClient, createPublicClient, http, zeroAddress } from "viem";
import { mainnet, sepolia } from "viem/chains";

import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { getRpcUrl } from "../../utils/blockchain/chain-registry";
import { GreenGoodsENSABI } from "../../utils/blockchain/contracts";

export const ENS_RECEIVER_AVAILABILITY_ABI = [
  {
    name: "available",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "slug", type: "string" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const ENS_RECEIVER_OWNER_TO_SLUG_ABI = [
  {
    name: "ownerToSlug",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

export function getENSL1ChainId(l2ChainId: number): number | null {
  switch (l2ChainId) {
    case 42161:
      return 1;
    case 11155111:
      return 11155111;
    case 31337:
      return 31337;
    default:
      return null;
  }
}

export function createENSL1Client(l1ChainId: number) {
  const chain = l1ChainId === 1 ? mainnet : sepolia;
  const alchemyKey =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_ALCHEMY_API_KEY) || "demo";
  const rpcUrl = getRpcUrl(l1ChainId, alchemyKey);

  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
}

export async function readENSL1ReceiverAddress({
  ensAddress,
  publicClient,
}: {
  ensAddress: Address;
  publicClient: PublicClient;
}): Promise<Address | null> {
  const l1ReceiverAddress = (await publicClient.readContract({
    address: ensAddress,
    abi: GreenGoodsENSABI,
    functionName: "l1Receiver",
  })) as Address;

  if (!l1ReceiverAddress || l1ReceiverAddress === zeroAddress) return null;
  return l1ReceiverAddress;
}

export async function isSlugAvailableAcrossChains({
  slug,
  ensAddress,
  publicClient,
  chainId = DEFAULT_CHAIN_ID,
}: {
  slug: string;
  ensAddress: Address;
  publicClient: PublicClient;
  chainId?: number;
}): Promise<boolean> {
  const l2Available = (await publicClient.readContract({
    address: ensAddress,
    abi: GreenGoodsENSABI,
    functionName: "available",
    args: [slug],
  })) as boolean;

  if (!l2Available) return false;

  const l1ChainId = getENSL1ChainId(chainId);
  if (!l1ChainId) return l2Available;

  const l1ReceiverAddress = await readENSL1ReceiverAddress({ ensAddress, publicClient });
  if (!l1ReceiverAddress) return false;

  const l1Client = l1ChainId === chainId ? publicClient : createENSL1Client(l1ChainId);
  return (await l1Client.readContract({
    address: l1ReceiverAddress,
    abi: ENS_RECEIVER_AVAILABILITY_ABI,
    functionName: "available",
    args: [slug],
  })) as boolean;
}
