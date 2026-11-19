/**
 * Edit Confirmers, for a group or a single promise nobody has taken yet.
 *
 * The steward names the copies nobody has taken and the confirmer rule they
 * should carry; this sends one `setConfirmerRule` per copy through
 * `modules/commitment-pooling/confirmer-edit`, and says where each copy
 * stands. `mode` says up front whether the wallet asks once or once per copy.
 *
 * @module hooks/admin-ui/pool/useEditConfirmers
 */

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { commitmentPoolingKeys } from "../../../config/query-keys/commitment-pooling";
import { logger } from "../../../modules/app/logger";
import {
  type ConfirmerEditCopy,
  type ConfirmerEditProgress,
  type ConfirmerRule,
  confirmerEditSendMode,
  confirmerRuleError,
  sendConfirmerEdit,
} from "../../../modules/commitment-pooling/confirmer-edit";
import type { CreationSendMode } from "../../../modules/commitment-pooling/creation-send";
import type { Address } from "../../../types/domain";
import { useTransactionSender } from "../../blockchain/useTransactionSender";
import { resolveCommitmentPoolingModule } from "../../commitment-pooling/useCommitmentPoolMutations";
import { useAsyncEffect } from "../../utils/useAsyncEffect";

export type { ConfirmerEditProgress } from "../../../modules/commitment-pooling/confirmer-edit";

export interface EditConfirmersController {
  /** How the wallet is asked: once for the group, or once per copy. */
  mode: CreationSendMode | null;
  isSending: boolean;
  /** Where each copy of the latest change stands; null before one. */
  copies: readonly ConfirmerEditProgress[] | null;
  /**
   * Give these copies the rule. `left`: some weren't changed, and trying again
   * with those is safe. `blocked`: nothing could be sent from here.
   */
  change: (
    copies: readonly ConfirmerEditCopy[],
    rule: ConfirmerRule
  ) => Promise<"changed" | "left" | "blocked">;
  /** Forget the latest change, for a dialog opened again. */
  reset: () => void;
}

export function useEditConfirmers(input: { chainId: number }): EditConfirmersController {
  const { chainId } = input;
  const sender = useTransactionSender();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<CreationSendMode | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [copies, setCopies] = useState<readonly ConfirmerEditProgress[] | null>(null);

  useAsyncEffect(
    async ({ isMounted }) => {
      const next = await confirmerEditSendMode(sender, chainId);
      if (isMounted()) setMode(next);
    },
    [sender, chainId]
  );

  const change: EditConfirmersController["change"] = async (targets, rule) => {
    if (!sender || targets.length === 0 || confirmerRuleError(rule)) return "blocked";
    let moduleAddress: Address;
    try {
      moduleAddress = resolveCommitmentPoolingModule(chainId);
    } catch (error) {
      logger.warn("[useEditConfirmers] no module to change confirmers on", {
        chainId,
        error: error instanceof Error ? error.message : String(error),
      });
      return "blocked";
    }
    const latest = new Map<bigint, ConfirmerEditProgress>(
      targets.map(({ commitmentId }) => [
        commitmentId,
        { commitmentId, status: "waiting", txHash: null },
      ])
    );
    setCopies([...latest.values()]);
    setIsSending(true);
    try {
      const ended = await sendConfirmerEdit({
        sender,
        chainId,
        moduleAddress,
        copies: targets,
        rule,
        onCopy: (progress) => {
          latest.set(progress.commitmentId, progress);
          setCopies([...latest.values()]);
        },
      });
      return ended.some((copy) => copy.status !== "changed") ? "left" : "changed";
    } finally {
      setIsSending(false);
      await queryClient.invalidateQueries({ queryKey: commitmentPoolingKeys.all(chainId) });
    }
  };

  const reset = useCallback(() => setCopies(null), []);
  return { mode, isSending, copies, change, reset };
}
