import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { encodeAbiParameters, type Hex } from "viem";
import { INDEXER_LAG_SCHEDULE_MS, queryKeys } from "../../config/query-keys";
import { useUser } from "../auth/useUser";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { useSafeMutation } from "../utils/useSafeMutation";
import { useProgressiveInvalidation } from "../utils/useTimeout";
import {
  GREENWILL_BADGE_IDS,
  type GreenWillBadgeId,
  type GreenWillSupportClaimParams,
} from "../../types/greenwill";
import { normalizeAddress, ZERO_ADDRESS } from "../../utils/blockchain/address";
import { getNetworkContracts, GreenWillABI } from "../../utils/blockchain/contracts";

function useClaimGreenWillBadge(
  badgeId: GreenWillBadgeId,
  buildClaimData: (variables?: unknown) => Hex
) {
  const queryClient = useQueryClient();
  const sender = useTransactionSender();
  const { primaryAddress } = useUser();
  const chainId = useCurrentChain();
  const greenWillAddress = getNetworkContracts(chainId).greenWill;
  const invalidate = useCallback(() => {
    if (!primaryAddress) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.greenWill.all });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.greenWill.ownership(normalizeAddress(primaryAddress), chainId),
    });
  }, [chainId, primaryAddress, queryClient]);
  const { start: scheduleFollowUp } = useProgressiveInvalidation(
    invalidate,
    INDEXER_LAG_SCHEDULE_MS
  );

  const mutation = useMutation({
    mutationFn: async (variables?: unknown) => {
      if (!sender) throw new Error("TransactionSender not available — auth not initialized");
      if (!primaryAddress) throw new Error("Connected account required");
      if (!greenWillAddress || greenWillAddress === ZERO_ADDRESS) {
        throw new Error("GreenWill not configured for this network");
      }

      const result = await sender.sendContractCall({
        address: greenWillAddress,
        abi: GreenWillABI,
        functionName: "claimBadge",
        args: [badgeId, buildClaimData(variables)],
      });

      return result.hash;
    },
    onSuccess: () => {
      invalidate();
      scheduleFollowUp();
    },
  });

  return useSafeMutation(mutation);
}

export function useClaimGenesisBadge() {
  return useClaimGreenWillBadge(GREENWILL_BADGE_IDS.GENESIS, () => "0x");
}

export function useClaimFirstWorkBadge() {
  return useClaimGreenWillBadge(GREENWILL_BADGE_IDS.FIRST_WORK, (variables) => {
    const uid = (variables as { uid: `0x${string}` } | undefined)?.uid;
    if (!uid) {
      throw new Error("Work attestation uid is required");
    }

    return encodeAbiParameters([{ type: "bytes32" }], [uid]);
  });
}

export function useClaimFirstSupportBadge() {
  return useClaimGreenWillBadge(GREENWILL_BADGE_IDS.FIRST_SUPPORT, (variables) => {
    const { gardenAddress, assetAddress } =
      (variables as GreenWillSupportClaimParams | undefined) ?? {};
    if (!gardenAddress || !assetAddress) {
      throw new Error("Garden and asset addresses are required");
    }

    return encodeAbiParameters(
      [{ type: "address" }, { type: "address" }],
      [gardenAddress, assetAddress]
    );
  });
}
