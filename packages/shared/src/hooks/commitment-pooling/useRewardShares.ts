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
  readRewardSharesPaidTo,
  rewardLegShares,
  rewardPayerShareId,
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
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useTransactionSender } from "../blockchain/useTransactionSender";

/** One share and who paid it: null while unpaid, undefined until the payer has answered. */
export interface RewardShareState extends RewardPayerShare {
  shareId: `0x${string}`;
  paidBy: Address | null | undefined;
}

export function useRewardShares(input: {
  /** The chain the promise and its wallet-paid parts live on (Arbitrum for the pilot). */
  chainId: number;
  commitmentId: bigint;
  legs: readonly RewardLeg[];
  recipients: readonly RewardShareRecipient[];
}) {
  const { chainId, commitmentId } = input;
  const contracts = getNetworkContracts(chainId);
  const payer =
    contracts.rewardPayer && !isZeroAddress(contracts.rewardPayer) ? contracts.rewardPayer : null;
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
  const read = useQuery({
    queryKey: commitmentPoolingKeys.rewardShares(chainId, commitmentId, ids.join(",")),
    queryFn: async () => {
      const chain = createRewardPayChain(chainId);
      return Promise.all(ids.map((id) => chain.paidBy(payer as Address, id)));
    },
    enabled: Boolean(payer) && ids.length > 0,
  });
  const states: RewardShareState[] = shares.map((share, index) => {
    const who = read.data?.[index];
    return {
      ...share,
      shareId: ids[index] as `0x${string}`,
      paidBy: who === undefined ? undefined : isZeroAddress(who) ? null : who,
    };
  });

  const queryClient = useQueryClient();
  const sender = useTransactionSender();
  const account = usePrimaryAddress();
  const [step, setStep] = useState<RewardPayStep | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  /** Pay every share still owed in one part's token; reads again before any signature. */
  const payOwed = async (token: Address): Promise<RewardPayOutcome> => {
    if (!payer || !sender || !account) {
      return { status: "refused-before-asking", refusal: "no-shares" };
    }
    const owed = states.filter(
      (share) => share.token.toLowerCase() === token.toLowerCase() && share.paidBy === null
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
      await queryClient.invalidateQueries({
        queryKey: commitmentPoolingKeys.rewardShares(chainId, commitmentId, ids.join(",")),
      });
    }
  };

  return {
    /** Null until the payer is deployed on this chain: nothing can be paid or read. */
    payer,
    shares: states,
    isReading: read.isLoading,
    readFailed: read.isError,
    payOwed,
    isPaying,
    step,
  };
}

/**
 * The shares of one promise the reward payer has paid to one gardener, for the
 * gardener's own view of their reward. Empty until the payer is deployed.
 */
export function useRewardSharesPaidTo(input: {
  chainId: number;
  commitmentId: bigint;
  recipient: Address | null | undefined;
  enabled?: boolean;
}) {
  const deployment = getRewardPayerDeployment(input.chainId);
  const recipient = input.recipient ?? null;
  return useQuery({
    queryKey: commitmentPoolingKeys.rewardSharesPaidTo(
      input.chainId,
      input.commitmentId,
      recipient ?? ""
    ),
    queryFn: async () => {
      const { createPublicClientForChain } = await import("../../config/pimlico");
      return readRewardSharesPaidTo({
        client: createPublicClientForChain(input.chainId),
        payer: (deployment as NonNullable<typeof deployment>).address,
        fromBlock: (deployment as NonNullable<typeof deployment>).deployBlock,
        commitmentId: input.commitmentId,
        recipient: recipient as Address,
      });
    },
    enabled: (input.enabled ?? true) && deployment !== null && recipient !== null,
  });
}
