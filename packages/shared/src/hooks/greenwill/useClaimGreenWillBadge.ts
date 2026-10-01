import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useIntl } from "react-intl";
import {
  type Address,
  BaseError,
  ContractFunctionRevertedError,
  encodeAbiParameters,
  type Hex,
} from "viem";
import { toastService } from "../../components/toast";
import { createPublicClientForChain } from "../../config/pimlico";
import { INDEXER_LAG_SCHEDULE_MS } from "../../config/query-keys/constants";
import { greenWillKeys } from "../../config/query-keys/greenwill";
import { logger } from "../../modules/app/logger";
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
import { parseContractError } from "../../utils/errors/contract-errors";
import { extractErrorMessage } from "../../utils/errors/extract-message";
import { isCancelledTxError } from "../../utils/errors/tx-error-classifier";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";

/** How a failed claim reads to the person who tried it. */
export interface BadgeClaimFailure {
  /** A wallet prompt they turned down is not an error. */
  kind: "cancelled" | "failed";
  /** The i18n id of the sentence that says what happened. */
  messageId: string;
}

/** The badge contract's own refusals (GreenWill.sol), by error name. */
const BADGE_REFUSAL_IDS: Record<string, string> = {
  BadgeAlreadyOwned: "app.profile.badges.claim.error.alreadyOwned",
  NotHatWearer: "app.profile.badges.claim.error.notEligible",
  BadgeClassNotConfigured: "app.profile.badges.claim.error.notOpen",
  BadgeInactive: "app.profile.badges.claim.error.notOpen",
  BadgeNotClaimable: "app.profile.badges.claim.error.notOpen",
  BadgeRuleNotConfigured: "app.profile.badges.claim.error.notOpen",
  UnsupportedBadgeRule: "app.profile.badges.claim.error.notOpen",
  InvalidClaimData: "app.profile.badges.claim.error.recordUnverified",
  AttestationNotFound: "app.profile.badges.claim.error.recordUnverified",
  AttestationRevoked: "app.profile.badges.claim.error.recordUnverified",
  InvalidAttestationSchema: "app.profile.badges.claim.error.recordUnverified",
  InvalidAttester: "app.profile.badges.claim.error.recordUnverified",
  VaultNotFound: "app.profile.badges.claim.error.supportMissing",
  NoVaultShares: "app.profile.badges.claim.error.supportMissing",
};

/** The general failures `parseContractError` names, by name. */
const GENERAL_FAILURE_IDS: Record<string, string> = {
  // A revert with no reason: the badge contract refused without saying why.
  ExecutionReverted: "app.profile.badges.claim.error.refused",
  NetworkError: "app.profile.badges.claim.error.network",
  TimeoutError: "app.profile.badges.claim.error.network",
  Offline: "app.profile.badges.claim.error.network",
};

/**
 * The GreenWill error a claim failed with. viem decodes it from the ABI; a
 * wallet's own error may only name it in its message.
 */
function badgeRefusalName(error: unknown): string | undefined {
  const revert =
    error instanceof BaseError
      ? error.walk((cause) => cause instanceof ContractFunctionRevertedError)
      : null;
  const decoded =
    revert instanceof ContractFunctionRevertedError ? revert.data?.errorName : undefined;
  if (decoded && decoded in BADGE_REFUSAL_IDS) return decoded;
  const message = extractErrorMessage(error);
  return Object.keys(BADGE_REFUSAL_IDS).find((name) => message.includes(name));
}

/**
 * What a failed badge claim tells the person: cancelled in the wallet, one of
 * the badge contract's own refusals, or a plain failure. The same sentence
 * shows in the toast and in the badge's dialog, so coming back from the wallet
 * finds it still there.
 */
export function describeBadgeClaimError(error: unknown): BadgeClaimFailure {
  if (isCancelledTxError(error)) {
    return { kind: "cancelled", messageId: "app.profile.badges.claim.cancelledMessage" };
  }
  const refusal = badgeRefusalName(error);
  if (refusal) return { kind: "failed", messageId: BADGE_REFUSAL_IDS[refusal] };
  if (isContractRefusal(error)) {
    return { kind: "failed", messageId: "app.profile.badges.claim.error.refused" };
  }
  return {
    kind: "failed",
    messageId:
      GENERAL_FAILURE_IDS[parseContractError(error).name] ??
      "app.profile.badges.claim.error.unknown",
  };
}

/** Whether the chain itself turned the call down, as opposed to not being reachable. */
function isContractRefusal(error: unknown): boolean {
  return (
    error instanceof BaseError &&
    error.walk((cause) => cause instanceof ContractFunctionRevertedError) !== null
  );
}

function useClaimGreenWillBadge(
  badgeId: GreenWillBadgeId,
  titleId: string,
  buildClaimData: (variables?: unknown) => Hex
) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const sender = useTransactionSender();
  const { primaryAddress } = useUser();
  const chainId = useCurrentChain();
  const greenWillAddress = getNetworkContracts(chainId).greenWill;
  const invalidate = useCallback(() => {
    if (!primaryAddress) return;
    void queryClient.invalidateQueries({ queryKey: greenWillKeys.all });
    void queryClient.invalidateQueries({
      queryKey: greenWillKeys.ownership(normalizeAddress(primaryAddress), chainId),
    });
  }, [chainId, primaryAddress, queryClient]);
  const { start: scheduleFollowUp } = useProgressiveInvalidation(
    invalidate,
    INDEXER_LAG_SCHEDULE_MS
  );
  const badge = formatMessage({ id: titleId });
  // Tracking only: the person reads the badge's own sentence, below.
  const trackError = createMutationErrorHandler({
    source: "useClaimGreenWillBadge",
    toastContext: "badge claim",
  });

  // The toasts belong to the mutation, not the dialog, so a claim that lands
  // after the person closed the dialog or left the page still says so.
  const mutation = useMutation({
    mutationFn: async (variables?: unknown) => {
      if (!sender) throw new Error("TransactionSender not available — auth not initialized");
      if (!primaryAddress) throw new Error("Connected account required");
      if (!greenWillAddress || greenWillAddress === ZERO_ADDRESS) {
        throw new Error("GreenWill not configured for this network");
      }
      const args = [badgeId, buildClaimData(variables)] as const;

      // Ask the chain first, so a claim the badge contract turns down says so
      // here rather than after a trip to the wallet. Only a refusal stops the
      // claim; a read that cannot reach the chain leaves the decision to the
      // wallet.
      try {
        await createPublicClientForChain(chainId).simulateContract({
          address: greenWillAddress as Address,
          abi: GreenWillABI,
          functionName: "claimBadge",
          args,
          account: primaryAddress as Address,
        });
      } catch (error) {
        if (isContractRefusal(error)) throw error;
        logger.warn("[useClaimGreenWillBadge] Claim check could not reach the chain", {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      const result = await sender.sendContractCall({
        address: greenWillAddress,
        abi: GreenWillABI,
        functionName: "claimBadge",
        args: [...args],
      });

      return result.hash;
    },
    onMutate: () => {
      const toastId = toastService.loading({
        id: `greenwill-claim-${badgeId}`,
        title: formatMessage({ id: "app.profile.badges.claim.pendingTitle" }, { badge }),
        message: formatMessage({ id: "app.profile.badges.claim.pendingMessage" }),
      });
      return { toastId };
    },
    onSuccess: (_hash, _variables, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      toastService.success({
        title: formatMessage({ id: "app.profile.badges.claim.successTitle" }, { badge }),
        message: formatMessage({ id: "app.profile.badges.claim.successMessage" }),
      });
      invalidate();
      scheduleFollowUp();
    },
    onError: (error, _variables, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      const failure = describeBadgeClaimError(error);
      if (failure.kind === "failed") {
        trackError(error, { showToast: false, metadata: { badgeId } });
        toastService.error({
          title: formatMessage({ id: "app.profile.badges.claim.failedTitle" }, { badge }),
          message: formatMessage({ id: failure.messageId }),
          error,
        });
      } else {
        toastService.info({
          title: formatMessage({ id: "app.profile.badges.claim.cancelledTitle" }),
          message: formatMessage({ id: failure.messageId }),
        });
      }
      // A claim that failed after it was sent may still have landed; read again.
      invalidate();
    },
  });

  return useSafeMutation(mutation);
}

export function useClaimGenesisBadge() {
  return useClaimGreenWillBadge(
    GREENWILL_BADGE_IDS.GENESIS,
    "app.profile.badges.genesis.title",
    () => "0x"
  );
}

export function useClaimFirstWorkBadge() {
  return useClaimGreenWillBadge(
    GREENWILL_BADGE_IDS.FIRST_WORK,
    "app.profile.badges.firstWork.title",
    (variables) => {
      const uid = (variables as { uid: `0x${string}` } | undefined)?.uid;
      if (!uid) {
        throw new Error("Work attestation uid is required");
      }

      return encodeAbiParameters([{ type: "bytes32" }], [uid]);
    }
  );
}

export function useClaimFirstSupportBadge() {
  return useClaimGreenWillBadge(
    GREENWILL_BADGE_IDS.FIRST_SUPPORT,
    "app.profile.badges.firstSupport.title",
    (variables) => {
      const { gardenAddress, assetAddress } =
        (variables as GreenWillSupportClaimParams | undefined) ?? {};
      if (!gardenAddress || !assetAddress) {
        throw new Error("Garden and asset addresses are required");
      }

      return encodeAbiParameters(
        [{ type: "address" }, { type: "address" }],
        [gardenAddress, assetAddress]
      );
    }
  );
}
