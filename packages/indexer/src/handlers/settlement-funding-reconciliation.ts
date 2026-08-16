import type { Commitment, CommitmentFunding, CommitmentPayoutPlan } from "envio";

import { createCommitment, poolingEntityId } from "./commitment-pool-projections";

type EntityStore<T extends { readonly id: string }> = {
  get(id: string): Promise<T | undefined>;
  set(entity: T): void;
};

export type FundingReconciliationContext = {
  Commitment: EntityStore<Commitment>;
  CommitmentFunding: EntityStore<CommitmentFunding>;
  CommitmentPayoutPlan: EntityStore<CommitmentPayoutPlan>;
};

async function getCommitment(
  context: FundingReconciliationContext,
  chainId: number,
  commitmentId: bigint,
  timestamp: number
): Promise<Commitment> {
  return (
    (await context.Commitment.get(poolingEntityId(chainId, commitmentId))) ??
    createCommitment(chainId, commitmentId, timestamp)
  );
}

export async function reconcileConsumedFunding(
  context: FundingReconciliationContext,
  commitment: Commitment
): Promise<void> {
  if (!commitment.payoutPlanEntityId || !commitment.consumedFundingEntityId) return;
  const [plan, funding] = await Promise.all([
    context.CommitmentPayoutPlan.get(commitment.payoutPlanEntityId),
    context.CommitmentFunding.get(commitment.consumedFundingEntityId),
  ]);
  if (!plan || !funding || plan.status !== "COMPLETE" || funding.state !== "CONSUMED") return;
  context.CommitmentFunding.set({
    ...funding,
    state: "CLOSED",
    closedAt: plan.updatedAt,
    updatedAt: Math.max(funding.updatedAt, plan.updatedAt),
  });
}

export async function linkPayoutPlanToCommitment(
  context: FundingReconciliationContext,
  plan: CommitmentPayoutPlan
): Promise<void> {
  const commitment = await getCommitment(context, plan.chainId, plan.commitmentId, plan.updatedAt);
  const linked = {
    ...commitment,
    payoutPlanId: plan.payoutPlanId,
    payoutPlanEntityId: plan.id,
    updatedAt: Math.max(commitment.updatedAt, plan.updatedAt),
  } satisfies Commitment;
  context.Commitment.set(linked);
  await reconcileConsumedFunding(context, linked);
}

export async function linkConsumedFundingToCommitment(
  context: FundingReconciliationContext,
  funding: CommitmentFunding
): Promise<void> {
  if (funding.commitmentId === undefined) return;
  const commitment = await getCommitment(
    context,
    funding.chainId,
    funding.commitmentId,
    funding.updatedAt
  );
  const linked = {
    ...commitment,
    consumedFundingId: funding.fundingId,
    consumedFundingEntityId: funding.id,
    updatedAt: Math.max(commitment.updatedAt, funding.updatedAt),
  } satisfies Commitment;
  context.Commitment.set(linked);
  await reconcileConsumedFunding(context, linked);
}
