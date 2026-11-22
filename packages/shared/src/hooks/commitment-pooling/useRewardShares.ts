/**
 * useRewardShares Hook
 *
 * The wallet-paid shares of one promise's reward (PRD-1556): what each person
 * the promise pays is owed in each part, whether the reward payer has recorded
 * it as paid, and a way for the steward to pay what is still owed from their own
 * wallet. The shares are computed in `modules/commitment-pooling/reward-payer`,
 * the paid state is read from the payer on its chain, and a payment goes through
 * `reward-pay-send`, which reads again before asking for any signature.
 *
 * @module hooks/commitment-pooling/useRewardShares
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { commitmentPoolingKeys } from "../../config/query-keys/commitment-pooling";
import {
  type RewardPayerShare,
  type RewardShareRecipient,
  readRewardShareTransaction,
  rewardLegShares,
  rewardPayerShareId,
  rewardSharesOwed,
} from "../../modules/commitment-pooling/reward-payer";
import {
  createRewardPayChain,
  type RewardPayOutcome,
  type RewardPayStep,
  sendRewardSharePayment,
} from "../../modules/commitment-pooling/reward-pay-send";
import type { RewardLeg } from "../../modules/commitment-pooling/reward-legs";
import type { Address } from "../../types/domain";
import { isZeroAddress } from "../../utils/blockchain/address";
import { getNetworkContracts, getRewardPayerDeployment } from "../../utils/blockchain/contracts";
import { readPayoutShareRecipients } from "../../modules/commitment-pooling/data-settlement-chain";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useTransactionSender } from "../blockchain/useTransactionSender";

/** One share and who paid it: null while unpaid, undefined until the payer has answered. */
export interface RewardShareState extends RewardPayerShare {
  shareId: `0x${string}`;
  paidBy: Address | null | undefined;
}

interface RewardSharesInput {
  /** The chain the promise and its wallet-paid parts live on (Arbitrum for the pilot). */
  chainId: number;
  commitmentId: bigint;
  legs: readonly RewardLeg[];
  recipients: readonly RewardShareRecipient[];
}

/** The shares and who paid each, read only: no wallet or sign-in is involved. */
function useRewardShareStates(input: RewardSharesInput) {
  const { chainId, commitmentId } = input;
  const contracts = getNetworkContracts(chainId);
  // The payer counts as deployed only once verify has recorded its address and deploy block.
  const payer = getRewardPayerDeployment(chainId)?.address ?? null;
  const shares = input.legs.flatMap((leg) =>
    leg.chainId === chainId
      ? rewardLegShares({
          promiseChainId: chainId,
          promiseModule: contracts.commitmentPoolingModule,
          commitmentId,
          leg,
          recipients: input.recipients,
        })
      : []
  );
  const ids = shares.map(rewardPayerShareId);
  const enabled = Boolean(payer) && ids.length > 0;
  const read = useQuery({
    queryKey: commitmentPoolingKeys.rewardShares(chainId, commitmentId, ids.join(",")),
    queryFn: async () => {
      const chain = createRewardPayChain(chainId);
      return Promise.all(ids.map((id) => chain.paidBy(payer as Address, id)));
    },
    enabled,
  });
  const states: RewardShareState[] = shares.map((share, index) => {
    const who = read.data?.[index];
    return {
      ...share,
      shareId: ids[index] as `0x${string}`,
      paidBy: who === undefined ? undefined : isZeroAddress(who) ? null : who,
    };
  });
  return {
    payer,
    shares: states,
    queryKey: commitmentPoolingKeys.rewardShares(chainId, commitmentId, ids.join(",")),
    isReading: unanswered(enabled, read),
    readFailed: read.isError,
  };
}

/**
 * A read that should answer and hasn't: loading, or paused while offline or
 * waiting to try again, when TanStack reports neither loading nor an error.
 */
function unanswered(enabled: boolean, read: { data: unknown }): boolean {
  return enabled && read.data === undefined;
}

/** A promise's wallet-paid shares, and paying what is owed from the steward's wallet. */
export function useRewardShares(input: RewardSharesInput) {
  const { chainId } = input;
  const { payer, shares: states, queryKey, isReading, readFailed } = useRewardShareStates(input);
  const queryClient = useQueryClient();
  const sender = useTransactionSender();
  const account = usePrimaryAddress();
  const [step, setStep] = useState<RewardPayStep | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  /**
   * Pay every share still owed in one part's token; reads again before any
   * signature. A share of the paying steward's own is left out, since the payer
   * refuses a payment to oneself, and so is one another steward already kept.
   */
  const payOwed = async (token: Address): Promise<RewardPayOutcome> => {
    if (!payer || !sender || !account) {
      return { status: "refused-before-asking", refusal: "no-shares" };
    }
    const owed = rewardSharesOwed(
      states.filter((share) => share.token.toLowerCase() === token.toLowerCase()),
      account
    );
    setIsPaying(true);
    try {
      return await sendRewardSharePayment({
        sender,
        chain: createRewardPayChain(chainId),
        chainId,
        payer,
        account,
        shares: owed,
        onStep: setStep,
      });
    } finally {
      setIsPaying(false);
      setStep(null);
      await queryClient.invalidateQueries({ queryKey });
    }
  };

  return {
    /** Null until the payer is deployed on this chain: nothing can be paid or read. */
    payer,
    shares: states,
    isReading,
    readFailed,
    payOwed,
    isPaying,
    step,
  };
}

/**
 * A promise's wallet-paid shares for anyone reading the reward, a gardener
 * included: it reads who the G$ payout plan pays, splits each part the same way
 * the steward's Hub does and reads which shares the payer has recorded. Before
 * the plan is finalized there is no split, so no shares.
 */
export function usePromiseRewardShares(input: {
  chainId: number;
  commitmentId: bigint;
  legs: readonly RewardLeg[];
  enabled?: boolean;
}) {
  const payerDeployed = getRewardPayerDeployment(input.chainId) !== null;
  const recipientsEnabled = (input.enabled ?? true) && payerDeployed && input.legs.length > 0;
  const recipientsRead = useQuery({
    queryKey: commitmentPoolingKeys.rewardShareRecipients(input.chainId, input.commitmentId),
    queryFn: () =>
      readPayoutShareRecipients({ chainId: input.chainId, commitmentId: input.commitmentId }),
    enabled: recipientsEnabled,
  });
  const plan = recipientsRead.data ?? null;
  const read = useRewardShareStates({
    chainId: input.chainId,
    commitmentId: input.commitmentId,
    legs: input.legs,
    recipients: plan?.finalized ? plan.recipients : [],
  });
  return {
    ...read,
    splitFixed: plan?.finalized === true,
    /** Either read still to answer: no part's state can be told yet. */
    isReading: unanswered(recipientsEnabled, recipientsRead) || read.isReading,
    readFailed: recipientsRead.isError || read.readFailed,
  };
}

/** The transaction that paid one share, once the payer has recorded it as paid. */
export function useRewardShareTransaction(input: {
  chainId: number;
  shareId: `0x${string}` | null;
}) {
  const deployment = getRewardPayerDeployment(input.chainId);
  return useQuery({
    queryKey: commitmentPoolingKeys.rewardShareTransaction(input.chainId, input.shareId ?? ""),
    queryFn: async () => {
      const { createPublicClientForChain } = await import("../../config/pimlico");
      return readRewardShareTransaction({
        client: createPublicClientForChain(input.chainId),
        payer: (deployment as NonNullable<typeof deployment>).address,
        fromBlock: (deployment as NonNullable<typeof deployment>).deployBlock,
        shareId: input.shareId as `0x${string}`,
      });
    },
    enabled: deployment !== null && input.shareId !== null,
    staleTime: Number.POSITIVE_INFINITY,
    // The scan can run many log reads; a failed one isn't repeated whole.
    retry: false,
  });
}
