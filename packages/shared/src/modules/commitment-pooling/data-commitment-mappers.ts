import { logger } from "../app/logger";
import { greenGoodsIndexer, type GraphQLReader } from "../data/graphql-client";
import {
  address,
  integer,
  indexedConsiderationRail,
  mapCommitment,
  number,
  optionalNumber,
  queryRows,
  type RawRow,
  string,
} from "./data-core";
import { hasKnownDisplayTerms } from "./display-groups";
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

/** Parse indexed unsigned integers without turning missing or malformed terms into zero. */
function projectionInteger(value: unknown): bigint | null {
  if (typeof value === "bigint") return value >= 0n ? value : null;
  if (typeof value === "number")
    return Number.isSafeInteger(value) && value >= 0 ? BigInt(value) : null;
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  return null;
}

const nullableProjectionInteger = (value: unknown) =>
  value === null ? null : (projectionInteger(value) ?? undefined);

const DISPLAY_INTEGER_FIELDS = [
  "poolId",
  "cycleId",
  "commitmentSeriesId",
  "targetUnits",
  "dueDate",
  "counterCommitmentId",
  "declaredUnitValue",
] as const;

/** Attach only complete authoritative action terms; unknown terms keep a list row individual. */
export async function mapCommitmentsWithRequirements(
  rows: RawRow[],
  chainId: number,
  reader: GraphQLReader = greenGoodsIndexer
): Promise<CommitmentReadModel[]> {
  // Keep malformed projections renderable as individual records. Compatibility
  // is checked against the original row below, before any mapper defaults.
  const readableRows = rows.map((row) => ({
    ...row,
    ...Object.fromEntries(
      DISPLAY_INTEGER_FIELDS.map((field) => [field, nullableProjectionInteger(row[field]) ?? null])
    ),
  }));
  const commitments = (await mapCommitmentsWithCycleState(readableRows, reader)).filter(
    (row) => row.creationSeen
  );
  if (commitments.length === 0) return commitments;
  const requiredIds = rows
    .filter(
      (row) => row.creationSeen === true && (projectionInteger(row.requirementCount) ?? 0n) > 0n
    )
    .map((row) => String(row.commitmentId));
  const requiredRows =
    requiredIds.length === 0
      ? []
      : await queryRows(
          `query CommitmentListRequirements($chainId: Int!, $ids: [numeric!]!) {
      CommitmentRequirement(where: { chainId: { _eq: $chainId }, commitmentId: { _in: $ids }, creationSeen: { _eq: true } }, order_by: { requirementIndex: asc }) {
        commitmentId requirementIndex actionUID requiredCount
      }
    }`,
          { chainId: chainId, ids: requiredIds },
          "CommitmentRequirement",
          "getCommitmentListRequirements",
          reader
        ).catch(() => {
          logger.warn(
            "[commitment-pooling] requirement terms could not be read; keeping individual rows"
          );
          return [];
        });
  return commitments.map((commitment) => {
    const raw = rows.find((row) => String(row.id) === commitment.id);
    const count = projectionInteger(raw?.requirementCount);
    const requirements = requiredRows.filter(
      (row) => projectionInteger(row.commitmentId) === commitment.commitmentId
    );
    // A missing count or incomplete projection cannot establish compatibility.
    const complete =
      count !== null &&
      count === BigInt(requirements.length) &&
      requirements.every((row, index) => {
        const actionUID = projectionInteger(row.actionUID);
        const requiredCount = projectionInteger(row.requiredCount);
        return (
          projectionInteger(row.requirementIndex) === BigInt(index) &&
          actionUID !== null &&
          actionUID < 2n ** 256n &&
          requiredCount !== null &&
          requiredCount > 0n &&
          requiredCount < 2n ** 32n
        );
      });
    const terms = complete
      ? requirements.map((row) => ({
          actionUID: integer(row.actionUID),
          requiredCount: number(row.requiredCount),
        }))
      : null;
    const known =
      raw &&
      hasKnownDisplayTerms({
        ...raw,
        onchainState: raw.state,
        considerationRail: indexedConsiderationRail(raw),
        ...Object.fromEntries(
          DISPLAY_INTEGER_FIELDS.map((field) => [field, nullableProjectionInteger(raw[field])])
        ),
        confirmationThreshold:
          projectionInteger(raw.confirmationThreshold) === null
            ? undefined
            : Number(raw.confirmationThreshold),
        requirements: terms,
      });
    return { ...commitment, requirements: known ? terms : null };
  });
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
