/**
 * ENS Registration Status Hook
 *
 * Tracks CCIP delivery status for ENS subdomain registrations and releases.
 * Checks the sender, receiver, and forward ENS record before reporting Ready.
 * Delayed requests can recover on refocus or a manual status check.
 *
 * Claims pause polling after 25 minutes; releases and observation errors keep retrying.
 *
 * Return data is fully serializable (no BigInt, no functions) for
 * IndexedDB persistence via the reading cache (QueryPersistenceProvider).
 *
 * @module hooks/ens/useENSRegistrationStatus
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { type Address, keccak256, toBytes, zeroAddress } from "viem";

import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { logger } from "../../modules/app/logger";
import type { ENSRegistrationData } from "../../types/domain";
import {
  createClients,
  GreenGoodsENSABI,
  getNetworkContracts,
} from "../../utils/blockchain/contracts";
import { STALE_TIME_MEDIUM } from "../../config/query-keys/constants";
import { ensKeys } from "../../config/query-keys/identity";
import { createENSL1Client, getENSL1ChainId, readENSL1ReceiverAddress } from "./availability";

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

/** Delay threshold for CCIP delivery; it never overrides confirmed completion. */
const TIMEOUT_MS = 25 * 60_000; // 25 minutes

export function useENSRegistrationStatus(slug: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery<ENSRegistrationData>({
    queryKey: ensKeys.registrationStatus(slug ?? ""),
    queryFn: async (): Promise<ENSRegistrationData> => {
      if (!slug) return { status: "available" };

      const contracts = getNetworkContracts(DEFAULT_CHAIN_ID);
      const ensAddress = contracts.greenGoodsENS;
      if (!ensAddress || ensAddress === zeroAddress) {
        return { status: "available" };
      }

      const { publicClient } = createClients(DEFAULT_CHAIN_ID);
      // Mutations cancel older reads before seeding the next operation.
      const previousData = queryClient.getQueryData<ENSRegistrationData>(
        ensKeys.registrationStatus(slug)
      );
      let { submittedAt, ccipMessageId, release } = previousData ?? {};

      // Check L2 cache first — if slug has an owner on L2, it's at least pending
      const slugHash = keccak256(toBytes(slug));
      const l2Owner = (await publicClient.readContract({
        address: ensAddress,
        abi: GreenGoodsENSABI,
        functionName: "slugOwner",
        args: [slugHash],
      })) as Address;

      // A sender cache may be empty after a migration or briefly lag a receipt.
      // Only both chains agreeing on absence can clear a previously active name.
      let hasRegistration = l2Owner !== zeroAddress;
      let receiverChecked = false;

      // Slug claimed on L2 — check L1 for CCIP delivery confirmation
      const l1ChainId = getENSL1ChainId(DEFAULT_CHAIN_ID);
      if (l1ChainId) {
        try {
          const l1ReceiverAddress = await readENSL1ReceiverAddress({ ensAddress, publicClient });

          if (l1ReceiverAddress && l1ReceiverAddress !== zeroAddress) {
            // Use same client if L1 == L2 (testnet), otherwise create L1 client
            const l1Client =
              l1ChainId === DEFAULT_CHAIN_ID ? publicClient : createENSL1Client(l1ChainId);

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

            receiverChecked = true;
            const receiverRegisteredAfterRelease =
              submittedAt !== undefined &&
              registration.owner !== zeroAddress &&
              registration.registeredAt > BigInt(Math.floor(submittedAt / 1000));
            const receiverHasDifferentOwner =
              release &&
              registration.owner !== zeroAddress &&
              registration.owner.toLowerCase() !== release.owner.toLowerCase();
            if (
              release &&
              (receiverRegisteredAfterRelease ||
                (previousData?.status === "available" && receiverHasDifferentOwner))
            ) {
              // A stale sender read cannot undo a confirmed release. Only the
              // receiver can prove that a later registration replaced it.
              if (receiverHasDifferentOwner) {
                const oldOwnerNameKey = ensKeys.protocolName(release.owner.toLowerCase());
                queryClient.setQueryData(oldOwnerNameKey, null);
                void queryClient.invalidateQueries({ queryKey: oldOwnerNameKey });
              }
              release = undefined;
              submittedAt = undefined;
              ccipMessageId = undefined;
            }
            if (release) {
              const owner = release.owner.toLowerCase();
              // A receiver-only name normally indicates a migrated record. An
              // explicit outgoing release waits for both chains and the ENS
              // forward record to clear. Receiver cleanup can succeed even
              // when its separate ENS record cleanup fails.
              const chainsCleared =
                l2Owner.toLowerCase() !== owner && registration.owner.toLowerCase() !== owner;
              const shouldCheckForward = previousData?.status === "available" || chainsCleared;
              const forwardOwner = shouldCheckForward
                ? await l1Client.getEnsAddress({ name: `${slug}.greengoods.eth` })
                : null;
              const completed =
                shouldCheckForward && (!forwardOwner || forwardOwner.toLowerCase() !== owner);
              const delayed = submittedAt !== undefined && Date.now() - submittedAt > TIMEOUT_MS;
              return {
                status: completed ? "available" : delayed ? "timed_out" : "pending",
                release,
                submittedAt,
                ccipMessageId,
              };
            }
            hasRegistration ||= registration.owner !== zeroAddress;
            const ownerMatchesSender =
              l2Owner === zeroAddress || l2Owner.toLowerCase() === registration.owner.toLowerCase();
            // Delivery can succeed even if resolver setup failed. Verify the name
            // actually points to its owner before showing it as ready to use.
            const resolvedOwner =
              registration.owner !== zeroAddress && ownerMatchesSender
                ? await l1Client.getEnsAddress({ name: `${slug}.greengoods.eth` })
                : null;
            if (resolvedOwner && resolvedOwner.toLowerCase() === registration.owner.toLowerCase()) {
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
          // A failed observation is not a lifecycle transition. React Query
          // retains the last confirmed data and exposes the retryable error.
          throw error;
        }
      }

      const awaitingSubmittedClaim = submittedAt && previousData?.status !== "active";
      if (receiverChecked && !hasRegistration && !awaitingSubmittedClaim) {
        return { status: "available" };
      }
      // Age is a fallback only after checking completion, never a terminal failure.
      const delayed = submittedAt !== undefined && Date.now() - submittedAt > TIMEOUT_MS;
      return { status: delayed ? "timed_out" : "pending", submittedAt, ccipMessageId, release };
    },
    enabled: Boolean(slug),
    staleTime: STALE_TIME_MEDIUM, // 30s
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: (query) => {
      const data = query.state.data;
      if (query.state.status === "error") return 30_000;
      if (!data) return false;

      // Keep a release observable until its receiver record clears, even when delayed.
      const isPollable = data.status === "pending" || (data.release && data.status === "timed_out");
      if (!isPollable) return false;

      // Adaptive polling: 60s for first 10 min, then 30s.
      const elapsed = Date.now() - (data.submittedAt ?? Date.now());

      return elapsed < 10 * 60_000 ? 60_000 : 30_000;
    },
  });

  const releasedOwner = query.data?.status === "available" ? query.data.release?.owner : undefined;
  useEffect(() => {
    if (!releasedOwner) return;
    // The account lookup can still hold the receiver's pre-release name.
    void queryClient.invalidateQueries({
      queryKey: ensKeys.protocolName(releasedOwner.toLowerCase()),
    });
  }, [queryClient, releasedOwner]);

  return query;
}
