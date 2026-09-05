import type { Address } from "../../types/domain";
import { greenGoodsIndexer, type GraphQLReader } from "../data/graphql-client";
import { rowsByIds } from "./data-commitments";
import { queryRows, string } from "./data-core";
import { mapContributorPayout, mapSettlementSubject } from "./data-settlement-mappers";
import { deriveSettlementDeliveryState, isSuccessfulSettlementExecution } from "./settlement";
import type { GardenerSettlementReceipt } from "./types-settlement";

/** Payout receipts follow authenticated source settlement state, never raw token transfers. */
export async function getGardenerSettlementHistory(
  sourceChainId: number,
  contributor: Address,
  {
    reader = greenGoodsIndexer,
    now = Math.floor(Date.now() / 1000),
  }: {
    reader?: GraphQLReader;
    now?: number;
  } = {}
): Promise<GardenerSettlementReceipt[]> {
  const payoutRows = await queryRows(
    `query GardenerContributorPayouts($chainId: Int!, $account: String!) {
    ContributorPayout(where: { chainId: { _eq: $chainId }, contributor: { _eq: $account } }, order_by: [{ createdAt: desc }, { id: asc }]) {
      id chainId payoutPlanId commitmentId contributor recipient paymentSnapshotVersion recognitionWeightBps
      paymentWeightBps amount disbursementId disbursementEntityId latestEditReasonCID editedBy createdAt updatedAt
    }
  }`,
    { chainId: sourceChainId, account: contributor.toLowerCase() },
    "ContributorPayout",
    "getGardenerContributorPayouts",
    reader
  );
  const payouts = payoutRows.map(mapContributorPayout);
  if (!payouts.length) return [];

  const unique = (values: string[]) => [...new Set(values)];
  const [plans, commitmentsResult, disbursements] = await Promise.all([
    rowsByIds(
      "CommitmentPayoutPlan",
      "id chainId payoutPlanId commitmentId finalized status paymentSnapshotVersion updatedAt",
      unique(payouts.map((payout) => `${sourceChainId}-${payout.payoutPlanId}`)),
      reader
    ),
    // Missing words must never hide a financial receipt or change its delivery state.
    rowsByIds(
      "Commitment",
      "id metadataCID",
      unique(payouts.map((payout) => `${sourceChainId}-${payout.commitmentId}`)),
      reader
    ).then(
      (rows) => ({ rows, failed: false }),
      () => ({ rows: [], failed: true })
    ),
    rowsByIds(
      "Disbursement",
      "id chainId disbursementId executorGarden state attempt executionKey commandMessageId acknowledgmentMessageId dispatchedAt confirmedAt failureCode reasonCID cancelledFromState batchId kind fundingRoute source recipient token amount updatedAt",
      unique(
        payouts.flatMap((payout) =>
          payout.disbursementEntityId ? [payout.disbursementEntityId] : []
        )
      ),
      reader
    ),
  ]);
  const subjects = disbursements.map((row) => mapSettlementSubject(row, false));
  const executionKeys = unique(
    subjects.flatMap((subject) => (subject.executionKey ? [subject.executionKey] : []))
  );
  const executions = executionKeys.length
    ? await queryRows(
        `query GardenerSettlementExecutions($sourceChainId: Int!, $executionKeys: [String!]!) {
    SettlementExecution(where: { sourceChainId: { _eq: $sourceChainId }, chainId: { _eq: 42220 }, executionKey: { _in: $executionKeys } }) {
      executionKey status acknowledgmentSent
    }
  }`,
        { sourceChainId, executionKeys },
        "SettlementExecution",
        "getGardenerSettlementExecutions",
        reader
      )
    : [];

  const plansById = new Map(plans.map((plan) => [String(plan.id), plan]));
  const commitmentsById = new Map(commitmentsResult.rows.map((row) => [String(row.id), row]));
  const subjectsById = new Map(subjects.map((subject) => [subject.id, subject]));
  const executionsByKey = new Map(
    executions.map((execution) => [String(execution.executionKey).toLowerCase(), execution])
  );
  return payouts
    .map((payout): GardenerSettlementReceipt => {
      const subject = payout.disbursementEntityId
        ? subjectsById.get(payout.disbursementEntityId)
        : undefined;
      const execution = subject?.executionKey
        ? executionsByKey.get(subject.executionKey)
        : undefined;
      const commitment = commitmentsById.get(`${sourceChainId}-${payout.commitmentId}`);
      const plan = plansById.get(`${sourceChainId}-${payout.payoutPlanId}`);
      const executed = isSuccessfulSettlementExecution(string(execution?.status));
      return {
        id: payout.id,
        sourceChainId,
        chainId: 42220,
        payoutPlanId: payout.payoutPlanId,
        commitmentId: payout.commitmentId,
        contributor: payout.contributor,
        recipient: payout.recipient,
        amount: payout.amount,
        createdAt: payout.createdAt,
        updatedAt: Math.max(
          payout.updatedAt,
          subject?.updatedAt ?? 0,
          Number(plan?.updatedAt ?? 0)
        ),
        metadataCID: string(commitment?.metadataCID),
        title: null,
        metadataUnavailable: commitmentsResult.failed || !commitment,
        delivery: deriveSettlementDeliveryState({
          state: subject?.state ?? null,
          cancelledFromState: subject?.cancelledFromState,
          ...(subject?.failureCode === null || subject?.failureCode === undefined
            ? {}
            : { failureCode: subject.failureCode }),
          executed,
          // Sending the acknowledgment does not prove Arbitrum has authenticated it.
          // Keep successful Celo execution pending until the source subject confirms.
          acknowledgmentPending: executed,
          deliveryDelayed: Boolean(subject?.dispatchedAt && now - subject.dispatchedAt > 30 * 60),
          // Receipt visibility and historical state are independent of today's send gate.
          gardenerDeliveryEnabled: true,
        }),
      };
    })
    .sort((left, right) => right.createdAt - left.createdAt || left.id.localeCompare(right.id));
}
