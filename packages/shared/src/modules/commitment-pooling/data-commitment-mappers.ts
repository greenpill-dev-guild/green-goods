import { greenGoodsIndexer, type GraphQLReader } from "../data/graphql-client";
import {
  address,
  integer,
  mapCommitment,
  number,
  optionalNumber,
  queryRows,
  type RawRow,
  string,
} from "./data-core";
import { getCommitmentCycleId } from "./ids";
import { deriveCommitmentState } from "./selectors";
import type {
  CommitmentClaimRequestRecord,
  CommitmentReadModel,
  CommitmentWorkAttributionRecord,
} from "./types";

export const WORK_ATTRIBUTION_FIELDS =
  "id chainId workUID commitmentId linkSeen contributor requirementIndex operationKey linked creditActive linkedBy linkedAt unlinkedBy unlinkedAt updatedAt";

export async function rowsByIds(
  entity: string,
  fields: string,
  ids: string[],
  reader: GraphQLReader = greenGoodsIndexer
): Promise<RawRow[]> {
  if (ids.length === 0) return [];
  const query = `query ${entity}ByIds($ids: [String!]!) { ${entity}(where: { id: { _in: $ids } }) { ${fields} } }`;
  return queryRows(query, { ids }, entity, `${entity}ByIds`, reader);
}

export async function mapCommitmentsWithCycleState(
  rows: RawRow[],
  reader: GraphQLReader = greenGoodsIndexer
): Promise<CommitmentReadModel[]> {
  const commitments = rows.map(mapCommitment);
  const cycleEntityIds = [
    ...new Set(
      commitments
        .filter(
          (commitment) =>
            commitment.onchainState === "FULFILLED" &&
            commitment.cycleId !== null &&
            commitment.cycleId !== 0n
        )
        .map((commitment) => getCommitmentCycleId(commitment.chainId, commitment.cycleId!))
    ),
  ];
  const cycles = await rowsByIds("CommitmentCycle", "id state", cycleEntityIds, reader);
  const cycleStates = new Map(cycles.map((cycle) => [String(cycle.id), String(cycle.state)]));
  return commitments.map((commitment) => ({
    ...commitment,
    derivedState: deriveCommitmentState(
      commitment,
      commitment.cycleId === null || commitment.cycleId === 0n
        ? null
        : cycleStates.get(getCommitmentCycleId(commitment.chainId, commitment.cycleId))
    ),
  }));
}

export function mapWorkAttribution(row: RawRow): CommitmentWorkAttributionRecord {
  if (row.linkSeen !== true) throw new Error("unseen work attribution placeholder");
  return {
    id: String(row.id),
    chainId: number(row.chainId),
    workUID: String(row.workUID) as CommitmentWorkAttributionRecord["workUID"],
    commitmentId: integer(row.commitmentId),
    linkSeen: true,
    contributor: address(row.contributor)!,
    requirementIndex: number(row.requirementIndex),
    operationKey: string(row.operationKey) as CommitmentWorkAttributionRecord["operationKey"],
    linked: row.linked === true,
    creditActive: row.creditActive === true,
    linkedBy: address(row.linkedBy),
    linkedAt: optionalNumber(row.linkedAt),
    unlinkedBy: address(row.unlinkedBy),
    unlinkedAt: optionalNumber(row.unlinkedAt),
    updatedAt: number(row.updatedAt),
  };
}

export function mapClaim(row: RawRow): CommitmentClaimRequestRecord {
  if (row.requestSeen !== true) throw new Error("unseen claim request placeholder");
  return {
    id: String(row.id),
    chainId: number(row.chainId),
    commitmentId: integer(row.commitmentId),
    claimant: address(row.claimant)!,
    requestSeen: true,
    requestedBy: address(row.requestedBy)!,
    claimType: String(row.claimType ?? "UNKNOWN") as CommitmentClaimRequestRecord["claimType"],
    gardenContext: address(row.gardenContext),
    state: String(row.state) as CommitmentClaimRequestRecord["state"],
    reasonCID: string(row.reasonCID),
    resolutionCode: string(row.resolutionCode),
    requestedAt: number(row.requestedAt),
    resolvedAt: optionalNumber(row.resolvedAt),
    updatedAt: number(row.updatedAt),
  };
}
