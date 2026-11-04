/**
 * Edit Reward, for a group or a single promise nobody has kept yet (PRD-1022 D14).
 *
 * The steward names the copies nobody has taken and the new G$ amount; this
 * sends one `setDeclaredConsideration` per copy through
 * `modules/commitment-pooling/reward-edit`, in one approval where the wallet
 * or passkey can do that, and says where each copy stands. A group past a
 * passkey's ceilings is asked once per copy from then on, and `mode` says so
 * before the next press. The dollars are the caller's: it converts them at the
 * price it read just before calling.
 *
 * @module hooks/admin-ui/pool/useEditReward
 */

import { SETTLEMENT_ENABLED } from "../../../config/app";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { commitmentPoolingKeys } from "../../../config/query-keys/commitment-pooling";
import { logger } from "../../../modules/app/logger";
import type { CreationSendMode } from "../../../modules/commitment-pooling/creation-send";
import {
  goodDollarConsideration,
  type RewardEditProgress,
  rewardEditSendMode,
  sendRewardEdit,
} from "../../../modules/commitment-pooling/reward-edit";
import type { Address } from "../../../types/domain";
import { useTransactionSender } from "../../blockchain/useTransactionSender";
import { resolveCommitmentPoolingModule } from "../../commitment-pooling/useCommitmentPoolMutations";
import { useAsyncEffect } from "../../utils/useAsyncEffect";

export type {
  RewardEditProgress,
  RewardEditStatus,
} from "../../../modules/commitment-pooling/reward-edit";

export interface EditRewardController {
  /** How the wallet is asked: once for the group, or once per copy. */
  mode: CreationSendMode | null;
  isSending: boolean;
  /** Where each copy of the latest change stands; null before one. */
  copies: readonly RewardEditProgress[] | null;
  /**
   * Give these copies the new G$ amount (zero for no reward). `left`: some
   * weren't changed, and trying again with those is safe. `blocked`: nothing
   * could be sent from here.
   */
  change: (
    commitmentIds: readonly bigint[],
    amount: bigint
  ) => Promise<"changed" | "left" | "blocked">;
  /** Forget the latest change, for a dialog opened again. */
  reset: () => void;
}

export function useEditReward(input: { chainId: number }): EditRewardController {
  const { chainId } = input;
  const sender = useTransactionSender();
  const queryClient = useQueryClient();
  const [probed, setProbed] = useState<CreationSendMode | null>(null);
  const [pastCeilings, setPastCeilings] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [copies, setCopies] = useState<readonly RewardEditProgress[] | null>(null);
  const mode = probed === "bundle" && pastCeilings ? "one-by-one" : probed;

  useAsyncEffect(
    async ({ isMounted }) => {
      const next = await rewardEditSendMode(sender, chainId);
      if (isMounted()) setProbed(next);
    },
    [sender, chainId]
  );

  const change: EditRewardController["change"] = async (commitmentIds, amount) => {
    if (!SETTLEMENT_ENABLED) return "blocked";
    if (!sender || commitmentIds.length === 0) return "blocked";
    let moduleAddress: Address;
    try {
      moduleAddress = resolveCommitmentPoolingModule(chainId);
    } catch (error) {
      logger.warn("[useEditReward] no module to change rewards on", {
        chainId,
        error: error instanceof Error ? error.message : String(error),
      });
      return "blocked";
    }
    const latest = new Map<bigint, RewardEditProgress>(
      commitmentIds.map((commitmentId) => [
        commitmentId,
        { commitmentId, status: "waiting", txHash: null },
      ])
    );
    setCopies([...latest.values()]);
    setIsSending(true);
    try {
      const ended = await sendRewardEdit({
        sender,
        chainId,
        moduleAddress,
        commitmentIds,
        consideration: goodDollarConsideration(amount),
        onCopy: (progress) => {
          latest.set(progress.commitmentId, progress);
          setCopies([...latest.values()]);
        },
        oneByOne: pastCeilings,
      });
      if (ended.some((copy) => copy.miss === "over-ceilings")) setPastCeilings(true);
      return ended.some((copy) => copy.status !== "changed") ? "left" : "changed";
    } finally {
      setIsSending(false);
      await queryClient.invalidateQueries({ queryKey: commitmentPoolingKeys.all(chainId) });
    }
  };

  const reset = useCallback(() => {
    setCopies(null);
    setPastCeilings(false);
  }, []);
  return { mode, isSending, copies, change, reset };
}
