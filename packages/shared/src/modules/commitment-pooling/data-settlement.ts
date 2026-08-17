import type { Address } from "../../types/domain";
import { greenGoodsIndexer } from "../data/graphql-client";
import type {
  CommitmentPayoutPlanDetail,
  SettlementAccountDetail,
  SettlementConfigurationRecord,
  SettlementSubjectDetail,
} from "./types";
import { type RawRow, queryRows, strings } from "./data-core";
import { rowsByIds } from "./data-commitments";
import {
  mapCommitmentPayoutPlan,
  mapContributorPayout,
  mapSettlementAccount,
  mapSettlementConfiguration,
  mapSettlementExecution,
  mapSettlementGardenRoute,
  mapSettlementMessage,
  mapSettlementSubject,
} from "./data-settlement-mappers";

export async function getSettlementConfigurations(
  chainId: number
): Promise<SettlementConfigurationRecord[]> {
  const query = `query SettlementConfigurations($chainId: Int!) {
    SettlementConfiguration(where: { chainId: { _eq: $chainId } }, order_by: { role: asc }) {
      id chainId role gardenerDeliveryEnabled protocolGarden gDollarToken hatsModule
      commitmentPoolingModule localContract localRouter localChainSelector remoteChainSelector
      remoteEvmChainId destinationGasLimit activePeer previousPeer previousPeerExpiresAt
      protocolVersion dispatcher batchSizeLimit maxTransferAmount maxBatchAmount maxFeeBps
      maxFeeAmount periodDuration maxPeriodAmount feeReserveMinimum nativeFeeBalance feeReserveLow
      peerConfigured paused updatedAt
    }
  }`;
  return (
    await queryRows(query, { chainId }, "SettlementConfiguration", "getSettlementConfigurations")
  ).map(mapSettlementConfiguration);
}

export async function getSettlementSubject(
  chainId: number,
  isBatch: boolean,
  subjectId: bigint
): Promise<SettlementSubjectDetail | null> {
  const id = `${chainId}-${subjectId}`;
  const entity = isBatch ? "SettlementBatch" : "Disbursement";
  const fields = isBatch
    ? "id chainId batchId executorGarden state attempt executionKey commandMessageId acknowledgmentMessageId dispatchedAt confirmedAt failureCode reasonCID kind fundingRoute source token updatedAt"
    : "id chainId disbursementId executorGarden state attempt executionKey commandMessageId acknowledgmentMessageId dispatchedAt confirmedAt failureCode reasonCID cancelledFromState batchId kind fundingRoute source recipient token amount updatedAt";
  const query = `query SettlementSubject($id: String!) { ${entity}(where: { id: { _eq: $id } }, limit: 1) { ${fields} } }`;
  const row = (await queryRows(query, { id }, entity, "getSettlementSubject"))[0];
  if (!row) return null;
  const subject = mapSettlementSubject(row, isBatch);
  const messageIds = [subject.commandMessageId, subject.acknowledgmentMessageId].filter(
    (value): value is `0x${string}` => Boolean(value)
  );
  const messageQuery = `query SettlementSubjectRelations($sourceChainId: Int!, $messageIds: [String!]!, $executionKey: String!) {
    SettlementMessage(where: { messageId: { _in: $messageIds } }) {
      id chainId messageId executionKey direction status isBatch subjectId attempt destinationPeer
      destinationGasLimit protocolVersion commandPayloadHash sourceChainId destinationChainId fee
      reserveFunded failureCode txHash createdAt updatedAt
    }
    SettlementExecution(where: { sourceChainId: { _eq: $sourceChainId }, executionKey: { _eq: $executionKey } }, limit: 1) {
      id chainId sourceChainId executionKey commandMessageId acknowledgmentReceiver protocolVersion
      executorGarden isBatch settlementId attempt status failureCode txHash acknowledgmentMessageId
      acknowledgmentSent acknowledgmentDeferralCode createdAt updatedAt
    }
  }`;
  const relations = await greenGoodsIndexer.query<Record<string, RawRow[]>>(
    messageQuery,
    {
      sourceChainId: chainId,
      messageIds,
      executionKey: subject.executionKey ?? "0x",
    },
    "getSettlementSubjectRelations"
  );
  if (relations.error) throw relations.error;
  const messages = (relations.data?.SettlementMessage ?? []).map(mapSettlementMessage);
  return {
    subject,
    command: messages.find((message) => message.messageId === subject.commandMessageId) ?? null,
    acknowledgment:
      messages.find((message) => message.messageId === subject.acknowledgmentMessageId) ?? null,
    execution: relations.data?.SettlementExecution?.[0]
      ? mapSettlementExecution(relations.data.SettlementExecution[0])
      : null,
  };
}

export async function getCommitmentPayoutPlan(
  chainId: number,
  payoutPlanId: bigint
): Promise<CommitmentPayoutPlanDetail | null> {
  const id = `${chainId}-${payoutPlanId}`;
  const query = `query CommitmentPayoutPlan($id: String!) {
    CommitmentPayoutPlan(where: { id: { _eq: $id } }, limit: 1) {
      id chainId payoutPlanId commitmentId payerGarden payerGardenId providerGarden providerGardenId
      settlementFlow payoutKind declaredAmount gardenRetainedAmount contributorPayoutTotal
      beneficiaryGarden beneficiaryRecipient beneficiaryAmount beneficiaryDisbursementId
      recognitionSnapshotHash paymentSnapshotHash paymentSnapshotVersion finalized status
      payablePayoutCount preparedPayoutCount confirmedPayoutCount failedPayoutCount cancelledPayoutCount
      contributorPayoutEntityIds disbursementEntityIds createdAt finalizedAt updatedAt
    }
  }`;
  const row = (
    await queryRows(query, { id }, "CommitmentPayoutPlan", "getCommitmentPayoutPlan")
  )[0];
  if (!row) return null;
  const [payoutRows, disbursementRows] = await Promise.all([
    rowsByIds(
      "ContributorPayout",
      "id chainId payoutPlanId commitmentId contributor recipient paymentSnapshotVersion recognitionWeightBps paymentWeightBps amount disbursementId disbursementEntityId latestEditReasonCID editedBy createdAt updatedAt",
      strings(row.contributorPayoutEntityIds)
    ),
    rowsByIds(
      "Disbursement",
      "id chainId disbursementId executorGarden state attempt executionKey commandMessageId acknowledgmentMessageId dispatchedAt confirmedAt failureCode reasonCID cancelledFromState batchId kind fundingRoute source recipient token amount updatedAt",
      strings(row.disbursementEntityIds)
    ),
  ]);
  return {
    plan: mapCommitmentPayoutPlan(row),
    contributorPayouts: payoutRows.map(mapContributorPayout),
    disbursements: disbursementRows.map((child) => mapSettlementSubject(child, false)),
  };
}

export async function getSettlementAccount(
  sourceChainId: number,
  garden: Address
): Promise<SettlementAccountDetail> {
  const normalizedGarden = garden.toLowerCase();
  const accountId = `${sourceChainId}-${normalizedGarden}`;
  const query = `query SettlementAccount($accountId: String!, $sourceChainId: Int!, $garden: String!) {
    SettlementAccount(where: { id: { _eq: $accountId } }, limit: 1) {
      id chainId garden gardenId accountChainId account active recoveryOwners rolesModifier roleKey
      allowanceKey permissionsConfigHash recoveryConfigHash recoveryThreshold updatedAt
    }
    SettlementGardenRoute(where: { sourceChainId: { _eq: $sourceChainId }, garden: { _eq: $garden } }, limit: 1) {
      id chainId sourceChainId garden gardenId settlementAccountId safe rolesModifier roleKey
      allowanceKey permissionsConfigHash active configuredAt updatedAt
    }
  }`;
  const result = await greenGoodsIndexer.query<Record<string, RawRow[]>>(
    query,
    { accountId, sourceChainId, garden: normalizedGarden },
    "getSettlementAccount"
  );
  if (result.error) throw result.error;
  return {
    account: result.data?.SettlementAccount?.[0]
      ? mapSettlementAccount(result.data.SettlementAccount[0])
      : null,
    route: result.data?.SettlementGardenRoute?.[0]
      ? mapSettlementGardenRoute(result.data.SettlementGardenRoute[0])
      : null,
  };
}
