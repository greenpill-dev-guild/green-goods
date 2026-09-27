import type { Address } from "../../types/domain";
import { greenGoodsIndexer, type GraphQLReader } from "../data/graphql-client";
import type { CommitmentEventRecord, PoolMemberHistory } from "./types";
import {
  EVENT_FIELDS,
  address,
  integer,
  number,
  optionalInteger,
  optionalNumber,
  queryRows,
  string,
} from "./data-core";

export async function getPoolMemberHistory(
  chainId: number,
  poolId: bigint,
  accountValue: Address,
  reader: GraphQLReader = greenGoodsIndexer
): Promise<PoolMemberHistory | null> {
  const id = `${chainId}-${poolId}-${accountValue.toLowerCase()}`;
  const query = `query PoolMemberHistory($id: String!) { PoolMemberHistory(where: { id: { _eq: $id } }, limit: 1) { id chainId poolId account leadAccepted leadFulfilled leadCancelled leadExpired contributorFulfilled receivedFulfilled confirmationsGiven disputesRaised updatedAt } }`;
  const row = (
    await queryRows(query, { id }, "PoolMemberHistory", "getPoolMemberHistory", reader)
  )[0];
  return row
    ? {
        id: String(row.id),
        chainId: number(row.chainId),
        poolId: integer(row.poolId),
        account: address(row.account)!,
        leadAccepted: number(row.leadAccepted),
        leadFulfilled: number(row.leadFulfilled),
        leadCancelled: number(row.leadCancelled),
        leadExpired: number(row.leadExpired),
        contributorFulfilled: number(row.contributorFulfilled),
        receivedFulfilled: number(row.receivedFulfilled),
        confirmationsGiven: number(row.confirmationsGiven),
        disputesRaised: number(row.disputesRaised),
        updatedAt: number(row.updatedAt),
      }
    : null;
}

export async function getCommitmentActivity(
  input: {
    chainId: number;
    poolId?: bigint;
    cycleId?: bigint;
    commitmentId?: bigint;
    limit?: number;
    offset?: number;
  },
  reader: GraphQLReader = greenGoodsIndexer
): Promise<CommitmentEventRecord[]> {
  const declarations = ["$chainId: Int!", "$limit: Int!", "$offset: Int!"];
  const clauses = ["chainId: { _eq: $chainId }"];
  const variables: Record<string, unknown> = {
    chainId: input.chainId,
    limit: input.limit ?? 50,
    offset: Number.isSafeInteger(input.offset) && (input.offset ?? 0) >= 0 ? input.offset : 0,
  };
  for (const [field, value] of [
    ["poolId", input.poolId],
    ["cycleId", input.cycleId],
    ["commitmentId", input.commitmentId],
  ] as const) {
    if (value !== undefined) {
      declarations.push(`$${field}: numeric!`);
      clauses.push(`${field}: { _eq: $${field} }`);
      variables[field] = value.toString();
    }
  }
  const query = `query CommitmentActivity(${declarations.join(", ")}) { CommitmentEvent(where: { ${clauses.join(", ")} }, order_by: [{ timestamp: desc }, { id: desc }], limit: $limit, offset: $offset) { ${EVENT_FIELDS} } }`;
  return (
    await queryRows(query, variables, "CommitmentEvent", "getCommitmentActivity", reader)
  ).map(
    (row): CommitmentEventRecord => ({
      id: String(row.id),
      chainId: number(row.chainId),
      poolId: optionalInteger(row.poolId),
      cycleId: optionalInteger(row.cycleId),
      commitmentId: optionalInteger(row.commitmentId),
      eventType: String(row.eventType),
      actor: address(row.actor),
      configurationKey: optionalNumber(row.configurationKey),
      previousValue: string(row.previousValue),
      newValue: string(row.newValue),
      units: optionalInteger(row.units),
      data: string(row.data),
      txHash: String(row.txHash).toLowerCase() as `0x${string}`,
      timestamp: number(row.timestamp),
    })
  );
}

/** The link an operation key made, as the indexer holds it: who linked, and in which block. */
export interface IndexedWorkLink {
  linkedBy: Address;
  /** The block of the link's WorkLinked event, where the chain names its transaction. */
  blockNumber: bigint;
}

/**
 * The link one caller's operation key made, or null before the indexer holds
 * it. The indexer keeps each work's latest link, so a work relinked under
 * another key no longer answers to this one.
 */
export async function getWorkLinkByOperation(
  chainId: number,
  caller: Address,
  operationKey: string,
  reader: GraphQLReader = greenGoodsIndexer
): Promise<IndexedWorkLink | null> {
  const query = `query WorkLinkByOperation($chainId: Int!, $operationKey: String!) { CommitmentWorkAttribution(where: { chainId: { _eq: $chainId }, operationKey: { _eq: $operationKey }, linkSeen: { _eq: true } }, limit: 10) { linkedBy linkPayloadBlockNumber } }`;
  const rows = await queryRows(
    query,
    { chainId, operationKey: operationKey.toLowerCase() },
    "CommitmentWorkAttribution",
    "getWorkLinkByOperation",
    reader
  );
  const row = rows.find((candidate) => address(candidate.linkedBy) === address(caller));
  const linkedBy = address(row?.linkedBy);
  const blockNumber = optionalInteger(row?.linkPayloadBlockNumber);
  return linkedBy && blockNumber !== null ? { linkedBy, blockNumber } : null;
}
