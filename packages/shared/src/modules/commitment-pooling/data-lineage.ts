import type { Address } from "../../types/domain";
import { greenGoodsIndexer } from "../data/graphql-client";
import { getCommitmentExchangeId, getCommitmentId, getNeedCommitmentIndexId } from "./ids";
import type {
  CommitmentExchangeRecord,
  CommitmentExchangeView,
  CommitmentFundingRecord,
  CommitmentHypercertBundle,
  CommitmentHypercertRecord,
  HypercertContributorAllocationRecord,
  NeedCommitmentLineage,
} from "./types";
import {
  COMMITMENT_FIELDS,
  CYCLE_FIELDS,
  type RawRow,
  address,
  integer,
  integers,
  mapCycle,
  number,
  optionalInteger,
  optionalNumber,
  queryRows,
  string,
  strings,
} from "./data-core";
import { mapCommitmentsWithCycleState, rowsByIds } from "./data-commitments";

export async function getNeedCommitments(
  chainId: number,
  needUID: string
): Promise<NeedCommitmentLineage | null> {
  const id = getNeedCommitmentIndexId(chainId, needUID);
  const query = `query NeedCommitmentIndex($id: String!) {
    NeedCommitmentIndex(where: { id: { _eq: $id } }, limit: 1) {
      needUID commitmentEntityIds fulfilledCommitmentEntityIds cycleEntityIds hypercertEntityIds updatedAt
    }
  }`;
  const index = (
    await queryRows(query, { id }, "NeedCommitmentIndex", "getNeedCommitmentIndex")
  )[0];
  if (!index) return null;
  const commitmentIds = strings(index.commitmentEntityIds);
  const fulfilledIds = strings(index.fulfilledCommitmentEntityIds);
  const cycleIds = strings(index.cycleEntityIds);
  const [commitments, fulfilledCommitments, cycles] = await Promise.all([
    rowsByIds("Commitment", COMMITMENT_FIELDS, commitmentIds),
    rowsByIds("Commitment", COMMITMENT_FIELDS, fulfilledIds),
    rowsByIds("CommitmentCycle", CYCLE_FIELDS, cycleIds),
  ]);
  const [mappedCommitments, mappedFulfilledCommitments] = await Promise.all([
    mapCommitmentsWithCycleState(commitments),
    mapCommitmentsWithCycleState(fulfilledCommitments),
  ]);
  return {
    needUID: String(index.needUID),
    commitments: mappedCommitments.filter((row) => row.creationSeen),
    fulfilledCommitments: mappedFulfilledCommitments.filter(
      (row) => row.creationSeen && row.state === "FULFILLED"
    ),
    cycles: cycles.filter((row) => row.seedSeen === true).map(mapCycle),
    hypercertEntityIds: strings(index.hypercertEntityIds),
    updatedAt: number(index.updatedAt),
  };
}

export async function getCommitmentExchange(
  chainId: number,
  poolId: bigint,
  commitmentIdA: bigint,
  commitmentIdB: bigint
): Promise<CommitmentExchangeView> {
  const id = getCommitmentExchangeId(chainId, poolId, commitmentIdA, commitmentIdB);
  const commitmentIds = [
    getCommitmentId(chainId, commitmentIdA),
    getCommitmentId(chainId, commitmentIdB),
  ];
  const query = `query CommitmentExchange($id: String!, $commitmentIds: [String!]!) {
    CommitmentExchange(where: { id: { _eq: $id } }, limit: 1) {
      id chainId poolId poolEntityId commitmentIdA commitmentEntityIdA commitmentIdB commitmentEntityIdB
      acceptorA acceptorB txHash acceptedAt
    }
    Commitment(where: { id: { _in: $commitmentIds }, creationSeen: { _eq: true } }) { ${COMMITMENT_FIELDS} }
  }`;
  const result = await greenGoodsIndexer.query<Record<string, RawRow[]>>(
    query,
    { id, commitmentIds },
    "getCommitmentExchange"
  );
  if (result.error) throw result.error;
  const exchangeRow = result.data?.CommitmentExchange?.[0];
  const commitments = (await mapCommitmentsWithCycleState(result.data?.Commitment ?? [])).filter(
    (row) => row.creationSeen
  );
  const commitmentA = commitments.find((row) => row.commitmentId === commitmentIdA) ?? null;
  const commitmentB = commitments.find((row) => row.commitmentId === commitmentIdB) ?? null;
  const exchange = exchangeRow ? mapExchange(exchangeRow) : null;
  const lapsedStates = new Set(["CANCELLED", "EXPIRED"]);
  return {
    exchange,
    commitmentA,
    commitmentB,
    status: exchange
      ? "matched"
      : !commitmentA || !commitmentB
        ? "unavailable"
        : lapsedStates.has(commitmentA.state) || lapsedStates.has(commitmentB.state)
          ? "counterpart-lapsed"
          : "proposed",
  };
}

function mapExchange(row: RawRow): CommitmentExchangeRecord {
  return {
    id: String(row.id),
    chainId: number(row.chainId),
    poolId: integer(row.poolId),
    poolEntityId: String(row.poolEntityId),
    commitmentIdA: integer(row.commitmentIdA),
    commitmentEntityIdA: String(row.commitmentEntityIdA),
    commitmentIdB: integer(row.commitmentIdB),
    commitmentEntityIdB: String(row.commitmentEntityIdB),
    acceptorA: address(row.acceptorA)!,
    acceptorB: address(row.acceptorB)!,
    txHash: String(row.txHash).toLowerCase() as `0x${string}`,
    acceptedAt: number(row.acceptedAt),
  };
}

export async function getCommitmentHypercertBundle(
  chainId: number,
  hypercertId: bigint
): Promise<CommitmentHypercertBundle> {
  const id = `${chainId}-${hypercertId}`;
  const query = `query CommitmentHypercertBundle($id: String!, $chainId: Int!, $hypercertId: numeric!) {
    Hypercert(where: { id: { _eq: $id } }, limit: 1) {
      id chainId tokenId garden metadataUri mintedAt mintedBy txHash totalUnits claimedUnits
      attestationCount attestationUIDs bundleKind metadataReconciliationRequired commitmentIds
      commitmentEntityIds needUIDs status createdAt updatedAt
    }
    HypercertCommitmentContributorAllocation(where: { chainId: { _eq: $chainId }, hypercertId: { _eq: $hypercertId } }, order_by: { id: asc }) {
      id chainId hypercertId hypercertEntityId commitmentId commitmentEntityId contributor contributorEntityId
      recognitionWeightBps commitmentGardenersClassUnits recognitionUnits createdAt updatedAt
    }
  }`;
  const result = await greenGoodsIndexer.query<Record<string, RawRow[]>>(
    query,
    { id, chainId, hypercertId: hypercertId.toString() },
    "getCommitmentHypercertBundle"
  );
  if (result.error) throw result.error;
  const row = result.data?.Hypercert?.[0];
  if (!row) return { status: "not-found" };
  const hypercert = mapHypercert(row);
  if (hypercert.metadataReconciliationRequired) return { status: "metadata-pending", hypercert };
  return {
    status: "ready",
    bundleKind: hypercert.bundleKind === "COMMITMENT" ? "COMMITMENT" : "WORK_LEGACY",
    hypercert,
    allocations: (result.data?.HypercertCommitmentContributorAllocation ?? []).map(
      mapHypercertAllocation
    ),
  };
}

function mapHypercert(row: RawRow): CommitmentHypercertRecord {
  return {
    id: String(row.id),
    chainId: number(row.chainId),
    tokenId: integer(row.tokenId),
    garden: address(row.garden)!,
    metadataUri: String(row.metadataUri),
    mintedAt: number(row.mintedAt),
    mintedBy: address(row.mintedBy)!,
    txHash: String(row.txHash).toLowerCase() as `0x${string}`,
    totalUnits: integer(row.totalUnits),
    claimedUnits: integer(row.claimedUnits),
    attestationCount: number(row.attestationCount),
    attestationUIDs: strings(row.attestationUIDs),
    bundleKind: row.bundleKind === "COMMITMENT" ? "COMMITMENT" : "WORK_LEGACY",
    metadataReconciliationRequired: row.metadataReconciliationRequired === true,
    commitmentIds: integers(row.commitmentIds),
    commitmentEntityIds: strings(row.commitmentEntityIds),
    needUIDs: strings(row.needUIDs),
    status: String(row.status),
    createdAt: number(row.createdAt),
    updatedAt: number(row.updatedAt),
  };
}

function mapHypercertAllocation(row: RawRow): HypercertContributorAllocationRecord {
  return {
    id: String(row.id),
    chainId: number(row.chainId),
    hypercertId: integer(row.hypercertId),
    hypercertEntityId: String(row.hypercertEntityId),
    commitmentId: integer(row.commitmentId),
    commitmentEntityId: String(row.commitmentEntityId),
    contributor: address(row.contributor)!,
    contributorEntityId: String(row.contributorEntityId),
    recognitionWeightBps: number(row.recognitionWeightBps),
    commitmentGardenersClassUnits: integer(row.commitmentGardenersClassUnits),
    recognitionUnits: integer(row.recognitionUnits),
    createdAt: number(row.createdAt),
    updatedAt: number(row.updatedAt),
  };
}

export async function getCommitmentFunding(
  chainId: number,
  commitmentId: bigint,
  funder?: Address
): Promise<CommitmentFundingRecord[]> {
  const clauses = ["chainId: { _eq: $chainId }", "commitmentId: { _eq: $commitmentId }"];
  const variables: Record<string, unknown> = { chainId, commitmentId: commitmentId.toString() };
  const declarations = ["$chainId: Int!", "$commitmentId: numeric!"];
  if (funder) {
    declarations.push("$funder: String!");
    clauses.push("funder: { _eq: $funder }");
    variables.funder = funder.toLowerCase();
  }
  const indexQuery = `query CommitmentFundingIndex(${declarations.join(", ")}) {
    CommitmentFundingIndex(where: { ${clauses.join(", ")} }) { fundingEntityId }
  }`;
  const indices = await queryRows(
    indexQuery,
    variables,
    "CommitmentFundingIndex",
    "getCommitmentFundingIndex"
  );
  const ids = indices
    .map((row) => string(row.fundingEntityId))
    .filter((value): value is string => Boolean(value));
  const rows = await rowsByIds(
    "CommitmentFunding",
    "id chainId fundingId pledgeSeen commitmentId commitmentEntityId funder garden gardenId refundAccount expectedAmount depositedAmount depositReference state refundDisbursementId refundDisbursementEntityId pledgedAt depositRecordedAt consumedAt withdrawnAt closedAt updatedAt",
    ids
  );
  return rows.map(mapFunding);
}

function mapFunding(row: RawRow): CommitmentFundingRecord {
  return {
    id: String(row.id),
    chainId: number(row.chainId),
    fundingId: integer(row.fundingId),
    pledgeSeen: row.pledgeSeen === true,
    commitmentId: optionalInteger(row.commitmentId),
    commitmentEntityId: string(row.commitmentEntityId),
    funder: address(row.funder),
    garden: address(row.garden),
    gardenId: string(row.gardenId),
    refundAccount: address(row.refundAccount),
    expectedAmount: optionalInteger(row.expectedAmount),
    depositedAmount: integer(row.depositedAmount),
    depositReference: string(row.depositReference) as `0x${string}` | null,
    state: String(row.state) as CommitmentFundingRecord["state"],
    refundDisbursementId: optionalInteger(row.refundDisbursementId),
    refundDisbursementEntityId: string(row.refundDisbursementEntityId),
    pledgedAt: optionalNumber(row.pledgedAt),
    depositRecordedAt: optionalNumber(row.depositRecordedAt),
    consumedAt: optionalNumber(row.consumedAt),
    withdrawnAt: optionalNumber(row.withdrawnAt),
    closedAt: optionalNumber(row.closedAt),
    updatedAt: number(row.updatedAt),
  };
}
