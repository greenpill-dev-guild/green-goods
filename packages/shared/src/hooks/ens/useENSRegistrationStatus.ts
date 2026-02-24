/**
 * ENS Registration Status Hook
 *
 * Tracks CCIP delivery status for ENS subdomain registrations.
 * Checks L2 cache for registration intent, then queries L1 receiver
 * for authoritative confirmation of CCIP delivery.
 *
 * Uses adaptive polling: 60s for first 10 min, 30s after, stops at 25 min.
 *
 * Return data is fully serializable (no BigInt, no functions) for
 * IndexedDB persistence via PersistQueryClientProvider.
 *
 * @module hooks/ens/useENSRegistrationStatus
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type Address, createPublicClient, http, keccak256, toBytes, zeroAddress } from "viem";
import { mainnet, sepolia } from "viem/chains";

import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { logger } from "../../modules/app/logger";
import type { ENSRegistrationData } from "../../types/domain";
import { getRpcUrl } from "../../utils/blockchain/chain-registry";
import { queryKeys, STALE_TIME_MEDIUM } from "../query-keys";
import {
  createClients,
  GreenGoodsENSABI,
  getNetworkContracts,
} from "../../utils/blockchain/contracts";

/**
 * Minimal ABI for querying the L1 ENSReceiver's getRegistration view.
 * Avoids coupling to the ENSReceiver build artifacts (different chain deployment).
 */
const ENS_RECEIVER_VIEW_ABI = [
  {
    name: "getRegistration",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "slug", type: "string" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "owner", type: "address" },
          { name: "nameType", type: "uint8" },
          { name: "registeredAt", type: "uint256" },
        ],
      },
    ],
  },
] as const;

/**
 * Map L2 chain ID to the L1 chain where the ENS receiver lives.
 * Returns null if the chain doesn't support ENS via CCIP.
 */
function getENSL1ChainId(l2ChainId: number): number | null {
  switch (l2ChainId) {
    case 42161: // Arbitrum → Ethereum Mainnet
      return 1;
    case 11155111: // Sepolia testnet → same chain (both contracts on Sepolia)
      return 11155111;
    case 31337: // Local dev → same chain
      return 31337;
    default:
      return null;
  }
}

/** Create an L1 public client for cross-chain ENS verification */
function createL1Client(l1ChainId: number) {
  const chain = l1ChainId === 1 ? mainnet : sepolia;
  const alchemyKey =
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_ALCHEMY_API_KEY) ||
    "demo";
  const rpcUrl = getRpcUrl(l1ChainId, alchemyKey);

  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
}

/** Timeout threshold after which we consider CCIP delivery timed out */
const TIMEOUT_MS = 25 * 60_000; // 25 minutes

export function useENSRegistrationStatus(slug: string | undefined) {
  const queryClient = useQueryClient();

  return useQuery<ENSRegistrationData>({
    queryKey: queryKeys.ens.registrationStatus(slug ?? ""),
    queryFn: async (): Promise<ENSRegistrationData> => {
      if (!slug) return { status: "available" };

      const contracts = getNetworkContracts(DEFAULT_CHAIN_ID);
      const ensAddress = contracts.greenGoodsENS as Address;
      if (!ensAddress || ensAddress === zeroAddress) {
        return { status: "available" };
      }

      const { publicClient } = createClients(DEFAULT_CHAIN_ID);

      // Check L2 cache first — if slug has an owner on L2, it's at least pending
      const slugHash = keccak256(toBytes(slug));
      const l2Owner = (await publicClient.readContract({
        address: ensAddress,
        abi: GreenGoodsENSABI,
        functionName: "slugOwner",
        args: [slugHash],
      })) as Address;

      if (l2Owner === zeroAddress) {
        return { status: "available" };
      }

      // Preserve submittedAt and ccipMessageId from cache-seeded data (set by useENSClaim)
      const previousData = queryClient.getQueryData<ENSRegistrationData>(
        queryKeys.ens.registrationStatus(slug)
      );
      const submittedAt = previousData?.submittedAt;
      const ccipMessageId = previousData?.ccipMessageId;

      // Check if registration has timed out (>25 min since submission)
      if (submittedAt && Date.now() - submittedAt > TIMEOUT_MS) {
        return { status: "timed_out", submittedAt, ccipMessageId };
      }

      // Slug claimed on L2 — check L1 for CCIP delivery confirmation
      const l1ChainId = getENSL1ChainId(DEFAULT_CHAIN_ID);
      if (l1ChainId) {
        try {
          // Read L1 receiver address from L2 contract
          const l1ReceiverAddress = (await publicClient.readContract({
            address: ensAddress,
            abi: GreenGoodsENSABI,
            functionName: "l1Receiver",
          })) as Address;

          if (l1ReceiverAddress && l1ReceiverAddress !== zeroAddress) {
            // Use same client if L1 == L2 (testnet), otherwise create L1 client
            const l1Client =
              l1ChainId === DEFAULT_CHAIN_ID ? publicClient : createL1Client(l1ChainId);

            const result = await l1Client.readContract({
              address: l1ReceiverAddress,
              abi: ENS_RECEIVER_VIEW_ABI,
              functionName: "getRegistration",
              args: [slug],
            });

            // Viem returns struct as object: { owner, nameType, registeredAt }
            const registration = result as unknown as {
              owner: Address;
              nameType: number;
              registeredAt: bigint;
            };

            if (registration.owner !== zeroAddress) {
              return {
                status: "active",
                submittedAt,
                ccipMessageId,
                registration: {
                  owner: registration.owner,
                  nameType: Number(registration.nameType),
                  registeredAt: String(registration.registeredAt), // Serialize bigint for IndexedDB
                },
              };
            }
          }
        } catch (error) {
          logger.warn("L1 ENS receiver query failed, will retry", { error, slug, l1ChainId });
          // Fall through to return "pending" — the adaptive polling will retry
        }
      }

      return { status: "pending", submittedAt, ccipMessageId };
    },
    enabled: Boolean(slug),
    staleTime: STALE_TIME_MEDIUM, // 30s
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;

      // Poll while status is pending or submitted; stop on terminal states
      const isPollable = data.status === "pending";
      if (!isPollable) return false;

      // Adaptive polling: 60s for first 10 min, then 30s, stop after 25 min
      const elapsed = Date.now() - (data.submittedAt ?? Date.now());
      if (elapsed > TIMEOUT_MS) return false;
      return elapsed < 10 * 60_000 ? 60_000 : 30_000;
    },
  });
}
