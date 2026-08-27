import type { Address } from "../../types/domain";
import type { GraphQLReader } from "../data/graphql-client";
import { number, type RawRow } from "./data-core";

const PAGE_SIZE = 200;

export interface FundingPage {
  Commitment: RawRow[];
  CommitmentPayoutPlan: RawRow[];
  CommitmentFunding: RawRow[];
  Disbursement: RawRow[];
}

export async function queryPoolFundingHeader(
  reader: GraphQLReader,
  sourceChainId: number,
  garden: Address
): Promise<{
  SettlementAccount: RawRow[];
  SettlementGardenRoute: RawRow[];
  SettlementConfiguration: RawRow[];
}> {
  const query = `query PoolFundingHeader($sourceChainId: Int!, $accountId: String!, $garden: String!) {
    SettlementAccount(where: { id: { _eq: $accountId } }, limit: 1) {
      id chainId garden gardenId accountChainId account active recoveryOwners rolesModifier roleKey allowanceKey permissionsConfigHash recoveryConfigHash recoveryThreshold updatedAt
    }
    SettlementGardenRoute(where: { sourceChainId: { _eq: $sourceChainId }, garden: { _eq: $garden } }, limit: 1) {
      id chainId sourceChainId garden gardenId settlementAccountId safe rolesModifier roleKey allowanceKey permissionsConfigHash active configuredAt updatedAt
    }
    SettlementConfiguration(where: { chainId: { _eq: $sourceChainId }, role: { _eq: "SOURCE" } }, limit: 1) {
      id chainId role gardenerDeliveryEnabled protocolGarden gDollarToken hatsModule commitmentPoolingModule localContract localRouter localChainSelector remoteChainSelector remoteEvmChainId destinationGasLimit activePeer previousPeer previousPeerExpiresAt protocolVersion dispatcher batchSizeLimit maxTransferAmount maxBatchAmount maxFeeBps maxFeeAmount periodDuration maxPeriodAmount feeReserveMinimum nativeFeeBalance feeReserveLow peerConfigured paused updatedAt
    }
  }`;
  const normalizedGarden = garden.toLowerCase();
  const result = await reader.query<{
    SettlementAccount: RawRow[];
    SettlementGardenRoute: RawRow[];
    SettlementConfiguration: RawRow[];
  }>(
    query,
    {
      sourceChainId,
      accountId: `${sourceChainId}-${normalizedGarden}`,
      garden: normalizedGarden,
    },
    "getPoolFundingHeader"
  );
  if (result.error) throw result.error;
  return result.data;
}

export async function queryExecutorConfiguration(
  reader: GraphQLReader,
  chainId: number
): Promise<RawRow | null> {
  const query = `query PoolFundingExecutorConfiguration($chainId: Int!) {
    SettlementConfiguration(where: { chainId: { _eq: $chainId }, role: { _eq: "EXECUTOR" } }, limit: 1) {
      id chainId role gardenerDeliveryEnabled protocolGarden gDollarToken hatsModule commitmentPoolingModule localContract localRouter localChainSelector remoteChainSelector remoteEvmChainId destinationGasLimit activePeer previousPeer previousPeerExpiresAt protocolVersion dispatcher batchSizeLimit maxTransferAmount maxBatchAmount maxFeeBps maxFeeAmount periodDuration maxPeriodAmount feeReserveMinimum nativeFeeBalance feeReserveLow peerConfigured paused updatedAt
    }
  }`;
  const result = await reader.query<{ SettlementConfiguration: RawRow[] }>(
    query,
    { chainId },
    "getPoolFundingExecutorConfiguration"
  );
  if (result.error) throw result.error;
  return result.data.SettlementConfiguration?.[0] ?? null;
}

export async function queryCaughtUpAt(
  reader: GraphQLReader,
  chainIds: number[]
): Promise<number | null> {
  const required = [...new Set(chainIds)];
  const query = `query PoolFundingFreshness($chainIds: [Int!]!) {
    chain_metadata(where: { chain_id: { _in: $chainIds } }, order_by: { chain_id: asc }, limit: 2) {
      chain_id timestamp_caught_up_to_head_or_endblock
    }
  }`;
  const result = await reader.query<{ chain_metadata: RawRow[] }>(
    query,
    { chainIds: required },
    "getPoolFundingFreshness"
  );
  if (result.error) return null;
  const byChain = new Map(
    (result.data.chain_metadata ?? []).map((row) => [
      number(row.chain_id),
      parseTimestamp(row.timestamp_caught_up_to_head_or_endblock),
    ])
  );
  const timestamps = required.map((chainId) => byChain.get(chainId) ?? null);
  return timestamps.every((value): value is number => value !== null)
    ? Math.min(...timestamps)
    : null;
}

export async function queryFundingPages(
  reader: GraphQLReader,
  sourceChainId: number,
  garden: Address,
  safe: Address
): Promise<FundingPage> {
  const collected: FundingPage = {
    Commitment: [],
    CommitmentPayoutPlan: [],
    CommitmentFunding: [],
    Disbursement: [],
  };
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const query = `query PoolFundingPage($sourceChainId: Int!, $garden: String!, $safe: String!, $limit: Int!, $offset: Int!) {
      Commitment(where: { chainId: { _eq: $sourceChainId }, payerGarden: { _eq: $garden } }, order_by: { id: asc }, limit: $limit, offset: $offset) {
        id commitmentId state considerationRail considerationAmount considerationPaid consumedFundingId
      }
      CommitmentPayoutPlan(where: { chainId: { _eq: $sourceChainId }, payerGarden: { _eq: $garden } }, order_by: { id: asc }, limit: $limit, offset: $offset) {
        id payoutPlanId commitmentId finalized declaredAmount gardenRetainedAmount contributorPayoutTotal beneficiaryRecipient beneficiaryAmount beneficiaryDisbursementId payablePayoutCount contributorPayoutEntityIds
      }
      CommitmentFunding(where: { chainId: { _eq: $sourceChainId }, garden: { _eq: $garden } }, order_by: { id: asc }, limit: $limit, offset: $offset) {
        id fundingId commitmentId depositedAmount state
      }
      Disbursement(where: { chainId: { _eq: $sourceChainId }, _or: [{ source: { _eq: $safe } }, { recipient: { _eq: $safe } }] }, order_by: { id: asc }, limit: $limit, offset: $offset) {
        id disbursementId commitmentId payoutPlanId fundingId batchId kind source recipient amount state executionKey
      }
    }`;
    const result = await reader.query<FundingPage>(
      query,
      {
        sourceChainId,
        garden: garden.toLowerCase(),
        safe: safe.toLowerCase(),
        limit: PAGE_SIZE,
        offset,
      },
      "getPoolFundingLedgerPage"
    );
    if (result.error) throw result.error;
    const page = result.data;
    for (const key of Object.keys(collected) as Array<keyof FundingPage>) {
      collected[key].push(...(page[key] ?? []));
    }
    if (
      (Object.keys(collected) as Array<keyof FundingPage>).every(
        (key) => (page[key]?.length ?? 0) < PAGE_SIZE
      )
    ) {
      break;
    }
  }
  return collected;
}

export async function queryPayoutRows(reader: GraphQLReader, ids: string[]): Promise<RawRow[]> {
  if (ids.length === 0) return [];
  const rows: RawRow[] = [];
  for (let start = 0; start < ids.length; start += PAGE_SIZE) {
    const query = `query PoolFundingPayoutRows($ids: [String!]!, $limit: Int!, $offset: Int!) {
      ContributorPayout(where: { payoutPlanEntityId: { _in: $ids } }, order_by: { id: asc }, limit: $limit, offset: $offset) {
        id payoutPlanId commitmentId recipient amount disbursementId
      }
    }`;
    const batch = ids.slice(start, start + PAGE_SIZE);
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const result = await reader.query<{ ContributorPayout: RawRow[] }>(
        query,
        { ids: batch, limit: PAGE_SIZE, offset },
        "getPoolFundingPayoutRows"
      );
      if (result.error) throw result.error;
      rows.push(...(result.data.ContributorPayout ?? []));
      if ((result.data.ContributorPayout?.length ?? 0) < PAGE_SIZE) break;
    }
  }
  return rows;
}

export async function queryExecutions(
  reader: GraphQLReader,
  executorChainId: number,
  executionKeys: string[]
): Promise<RawRow[]> {
  const keys = [...new Set(executionKeys)];
  if (keys.length === 0) return [];
  const rows: RawRow[] = [];
  for (let start = 0; start < keys.length; start += PAGE_SIZE) {
    const query = `query PoolFundingExecutions($executorChainId: Int!, $executionKeys: [String!]!, $limit: Int!, $offset: Int!) {
      SettlementExecution(where: { chainId: { _eq: $executorChainId }, executionKey: { _in: $executionKeys } }, order_by: { id: asc }, limit: $limit, offset: $offset) {
        id executionKey status createdAt acknowledgmentSent
      }
    }`;
    const batch = keys.slice(start, start + PAGE_SIZE);
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const result = await reader.query<{ SettlementExecution: RawRow[] }>(
        query,
        { executorChainId, executionKeys: batch, limit: PAGE_SIZE, offset },
        "getPoolFundingExecutions"
      );
      if (result.error) throw result.error;
      rows.push(...(result.data.SettlementExecution ?? []));
      if ((result.data.SettlementExecution?.length ?? 0) < PAGE_SIZE) break;
    }
  }
  return rows;
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value === "number") {
    return value > 1_000_000_000_000 ? Math.floor(value / 1_000) : value;
  }
  if (typeof value !== "string" || value.length === 0) return null;
  if (/^\d+$/.test(value)) return parseTimestamp(Number(value));
  const milliseconds = Date.parse(value);
  return Number.isNaN(milliseconds) ? null : Math.floor(milliseconds / 1_000);
}
