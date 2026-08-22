import type { Address } from "../../types/domain";
import { greenGoodsIndexer } from "../data/graphql-client";
import {
  address,
  CLAIM_FIELDS,
  COMMITMENT_FIELDS,
  integer,
  mapCommitment,
  number,
  optionalNumber,
  queryRows,
  type RawRow,
  string,
  strings,
} from "./data-core";
import { getCommitmentCycleId, getCommitmentId } from "./ids";
import { deriveCommitmentState } from "./selectors";
import type {
  CommitmentClaimRequestRecord,
  CommitmentContributorRecord,
  CommitmentDetail,
  CommitmentReadModel,
  CommitmentRequirementRecord,
  CommitmentWorkAttributionRecord,
  FallbackConfirmationCandidate,
  PoolClaimRequestRow,
} from "./types";

export async function getCommitments(input: {
  chainId: number;
  poolId?: bigint;
  cycleId?: bigint;
  seriesId?: bigint;
  state?: string;
  account?: Address;
}): Promise<CommitmentReadModel[]> {
  const clauses = ["chainId: { _eq: $chainId }", "creationSeen: { _eq: true }"];
  const declarations = ["$chainId: Int!"];
  const variables: Record<string, unknown> = { chainId: input.chainId };
  for (const [field, value] of [
    ["poolId", input.poolId],
    ["cycleId", input.cycleId],
    ["commitmentSeriesId", input.seriesId],
  ] as const) {
    if (value !== undefined) {
      declarations.push(`$${field}: numeric!`);
      clauses.push(`${field}: { _eq: $${field} }`);
      variables[field] = value.toString();
    }
  }
  if (input.state) {
    declarations.push("$state: CommitmentOnchainState!");
    clauses.push("state: { _eq: $state }");
    variables.state = input.state;
  }
  if (input.account) {
    // Everything this account is a party to, not only what it is rostered on.
    // The roster is seeded at acceptance and never holds the confirmer
    // (AcceptanceLib.sol:183-187), so a roster-only filter loses a commitment
    // nobody has taken up yet, one waiting on this person as counterparty, and
    // one waiting on them as a named confirmer.
    const account = input.account.toLowerCase();
    const contributorQuery = `query CommitmentMembership($chainId: Int!, $account: String!) { CommitmentContributor(where: { chainId: { _eq: $chainId }, contributor: { _eq: $account }, additionSeen: { _eq: true }, active: { _eq: true } }) { commitmentEntityId } }`;
    const rosteredIds = (
      await queryRows(
        contributorQuery,
        { chainId: input.chainId, account },
        "CommitmentContributor",
        "getCommitmentMembership"
      )
    ).map((row) => String(row.commitmentEntityId));
    declarations.push("$account: String!");
    variables.account = account;
    const partyClauses = [
      "{ creator: { _eq: $account } }",
      "{ leadProvider: { _eq: $account } }",
      "{ counterparty: { _eq: $account } }",
      // Named confirmers are a party too. selectCommitmentSeat seats them, so
      // without this their own commitment never reaches the sheet that exists
      // to tell them something is waiting, and they could only find it by
      // browsing the garden it lives in.
      "{ confirmers: { _contains: [$account] } }",
    ];
    // An empty roster is not an empty result — the party clauses stand alone.
    if (rosteredIds.length > 0) {
      declarations.push("$ids: [String!]!");
      variables.ids = rosteredIds;
      partyClauses.push("{ id: { _in: $ids } }");
    }
    clauses.push(`_or: [${partyClauses.join(", ")}]`);
  }
  const query = `query Commitments(${declarations.join(", ")}) { Commitment(where: { ${clauses.join(", ")} }, order_by: { commitmentId: desc }) { ${COMMITMENT_FIELDS} } }`;
  return (
    await mapCommitmentsWithCycleState(
      await queryRows(query, variables, "Commitment", "getCommitments")
    )
  ).filter((row) => row.creationSeen);
}

export async function rowsByIds(entity: string, fields: string, ids: string[]): Promise<RawRow[]> {
  if (ids.length === 0) return [];
  const query = `query ${entity}ByIds($ids: [String!]!) { ${entity}(where: { id: { _in: $ids } }) { ${fields} } }`;
  return queryRows(query, { ids }, entity, `${entity}ByIds`);
}

export async function mapCommitmentsWithCycleState(rows: RawRow[]): Promise<CommitmentReadModel[]> {
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
  const cycles = await rowsByIds("CommitmentCycle", "id state", cycleEntityIds);
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

export async function getCommitmentDetail(
  chainId: number,
  commitmentId: bigint
): Promise<CommitmentDetail | null> {
  const id = getCommitmentId(chainId, commitmentId);
  const query = `query CommitmentDetailIndex($id: String!, $chainId: Int!, $commitmentId: numeric!) {
    Commitment(where: { id: { _eq: $id }, creationSeen: { _eq: true } }, limit: 1) { ${COMMITMENT_FIELDS} }
    CommitmentRequirement(where: { chainId: { _eq: $chainId }, commitmentId: { _eq: $commitmentId }, creationSeen: { _eq: true } }, order_by: { requirementIndex: asc }) { id chainId commitmentId requirementIndex creationSeen domain actionUID requiredCount approvedCount createdAt updatedAt }
    CommitmentContributorIndex(where: { id: { _eq: $id } }, limit: 1) { contributorEntityIds }
    CommitmentContributorRequirementIndex(where: { id: { _eq: $id } }, limit: 1) { assignmentEntityIds }
    CommitmentEvidenceAttributionIndex(where: { id: { _eq: $id } }, limit: 1) { attributionEntityIds }
    CommitmentClaimRequestIndex(where: { id: { _eq: $id } }, limit: 1) { requestIds }
    CommitmentCounterIndex(where: { id: { _eq: $id } }, limit: 1) { referencingCommitmentEntityIds }
    CommitmentWorkAttribution(where: { chainId: { _eq: $chainId }, commitmentId: { _eq: $commitmentId }, linkSeen: { _eq: true } }, order_by: { workUID: asc }) { ${WORK_ATTRIBUTION_FIELDS} }
  }`;
  const result = await greenGoodsIndexer.query<Record<string, RawRow[]>>(
    query,
    { id, chainId, commitmentId: commitmentId.toString() },
    "getCommitmentDetail"
  );
  if (result.error) throw result.error;
  const commitmentRow = result.data?.Commitment?.[0];
  if (!commitmentRow) return null;
  const contributorIds = strings(
    result.data?.CommitmentContributorIndex?.[0]?.contributorEntityIds
  );
  const assignmentIds = strings(
    result.data?.CommitmentContributorRequirementIndex?.[0]?.assignmentEntityIds
  );
  const evidenceIds = strings(
    result.data?.CommitmentEvidenceAttributionIndex?.[0]?.attributionEntityIds
  );
  const requestIds = strings(result.data?.CommitmentClaimRequestIndex?.[0]?.requestIds);
  const counterIndexIds = strings(
    result.data?.CommitmentCounterIndex?.[0]?.referencingCommitmentEntityIds
  );
  const directCounterId = string(commitmentRow.counterCommitmentEntityId);
  const [contributors, assignments, evidence, claims, counterparts] = await Promise.all([
    rowsByIds(
      "CommitmentContributor",
      "id chainId commitmentId contributor additionSeen active isLead approvedWorkCredits evidenceCredits uncountedLinkedWorkCount requirementIndexes recognitionWeightBps addedBy addedAt removedBy removedAt updatedAt",
      contributorIds
    ),
    rowsByIds(
      "CommitmentContributorRequirementAssignment",
      "id chainId commitmentId contributor requirementIndex assigned lifecycleBlockNumber lifecycleLogIndex updatedAt",
      assignmentIds
    ),
    rowsByIds(
      "CommitmentEvidenceAttribution",
      "id chainId commitmentId cid contributor attacher confirmed createdAt updatedAt",
      evidenceIds
    ),
    rowsByIds("CommitmentClaimRequest", CLAIM_FIELDS, requestIds),
    rowsByIds("Commitment", COMMITMENT_FIELDS, [
      ...counterIndexIds,
      ...(directCounterId ? [directCounterId] : []),
    ]),
  ]);
  const mappedCommitments = await mapCommitmentsWithCycleState([commitmentRow, ...counterparts]);
  return {
    commitment: mappedCommitments[0],
    requirements: (result.data?.CommitmentRequirement ?? []).map(
      (row): CommitmentRequirementRecord => ({
        id: String(row.id),
        chainId: number(row.chainId),
        commitmentId: integer(row.commitmentId),
        requirementIndex: number(row.requirementIndex),
        creationSeen: true,
        domain: optionalNumber(row.domain),
        actionUID: integer(row.actionUID),
        requiredCount: number(row.requiredCount),
        approvedCount: number(row.approvedCount),
        createdAt: number(row.createdAt),
        updatedAt: number(row.updatedAt),
      })
    ),
    contributors: contributors
      .filter((row) => row.additionSeen === true)
      .map(
        (row): CommitmentContributorRecord => ({
          id: String(row.id),
          chainId: number(row.chainId),
          commitmentId: integer(row.commitmentId),
          contributor: address(row.contributor)!,
          additionSeen: true,
          active: row.active === true,
          isLead: row.isLead === true,
          approvedWorkCredits: number(row.approvedWorkCredits),
          evidenceCredits: number(row.evidenceCredits),
          uncountedLinkedWorkCount: number(row.uncountedLinkedWorkCount),
          requirementIndexes: Array.isArray(row.requirementIndexes)
            ? row.requirementIndexes.map(number)
            : [],
          recognitionWeightBps: optionalNumber(row.recognitionWeightBps),
          addedBy: address(row.addedBy),
          addedAt: optionalNumber(row.addedAt),
          removedBy: address(row.removedBy),
          removedAt: optionalNumber(row.removedAt),
          updatedAt: number(row.updatedAt),
        })
      ),
    assignments,
    workAttributions: (result.data?.CommitmentWorkAttribution ?? [])
      .filter((row) => row.linkSeen === true)
      .map(mapWorkAttribution),
    evidenceAttributions: evidence,
    claimRequests: claims.filter((row) => row.requestSeen === true).map(mapClaim),
    counterpartCommitments: mappedCommitments.slice(1).filter((row) => row.creationSeen),
  };
}

const WORK_ATTRIBUTION_FIELDS =
  "id chainId workUID commitmentId linkSeen contributor requirementIndex operationKey linked creditActive linkedBy linkedAt unlinkedBy unlinkedAt updatedAt";

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

/**
 * The commitment a work fulfils, read from the work's side. The same entity
 * the detail reads commitment → work, with the other column as the key.
 */
export async function getCommitmentWorkAttributionsByWork(
  chainId: number,
  workUID: string
): Promise<CommitmentWorkAttributionRecord[]> {
  const query = `query CommitmentWorkAttributionsByWork($chainId: Int!, $workUID: String!) { CommitmentWorkAttribution(where: { chainId: { _eq: $chainId }, workUID: { _eq: $workUID }, linkSeen: { _eq: true } }, order_by: [{ updatedAt: desc }, { id: asc }]) { ${WORK_ATTRIBUTION_FIELDS} } }`;
  return (
    await queryRows(
      query,
      { chainId, workUID },
      "CommitmentWorkAttribution",
      "getCommitmentWorkAttributionsByWork"
    )
  )
    .filter((row) => row.linkSeen === true)
    .map(mapWorkAttribution);
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

export async function getCommitmentClaimRequests(
  chainId: number,
  commitmentId: bigint,
  state?: string
): Promise<CommitmentClaimRequestRecord[]> {
  const declarations = ["$chainId: Int!", "$commitmentId: numeric!"];
  const clauses = [
    "chainId: { _eq: $chainId }",
    "commitmentId: { _eq: $commitmentId }",
    "requestSeen: { _eq: true }",
  ];
  const variables: Record<string, unknown> = { chainId, commitmentId: commitmentId.toString() };
  if (state) {
    declarations.push("$state: CommitmentClaimRequestState!");
    clauses.push("state: { _eq: $state }");
    variables.state = state;
  }
  const query = `query CommitmentClaimRequests(${declarations.join(", ")}) { CommitmentClaimRequest(where: { ${clauses.join(", ")} }, order_by: [{ updatedAt: desc }, { id: asc }]) { ${CLAIM_FIELDS} } }`;
  return (
    await queryRows(query, variables, "CommitmentClaimRequest", "getCommitmentClaimRequests")
  ).map(mapClaim);
}

/**
 * Every claim across a pool, in one state. The claim entity carries no pool
 * field, so this is a join through the pool's commitments: pending claims sit
 * only on commitments nobody has accepted yet, which keeps the first leg
 * bounded; any other state reads the pool's whole history.
 */
export async function getPoolClaimRequests(input: {
  chainId: number;
  poolId: bigint;
  state?: string;
}): Promise<PoolClaimRequestRow[]> {
  const stateClause = input.state === "PENDING" ? ", state: { _in: [OFFERED, REQUESTED] }" : "";
  const commitmentQuery = `query PoolClaimCommitments($chainId: Int!, $poolId: numeric!) { Commitment(where: { chainId: { _eq: $chainId }, poolId: { _eq: $poolId }, creationSeen: { _eq: true }${stateClause} }, order_by: { commitmentId: desc }) { ${COMMITMENT_FIELDS} } }`;
  const commitments = await mapCommitmentsWithCycleState(
    await queryRows(
      commitmentQuery,
      { chainId: input.chainId, poolId: input.poolId.toString() },
      "Commitment",
      "getPoolClaimCommitments"
    )
  );
  if (commitments.length === 0) return [];
  const byId = new Map(commitments.map((commitment) => [commitment.id, commitment]));
  const declarations = ["$ids: [String!]!"];
  const clauses = ["commitmentEntityId: { _in: $ids }", "requestSeen: { _eq: true }"];
  const variables: Record<string, unknown> = { ids: [...byId.keys()] };
  if (input.state) {
    declarations.push("$state: CommitmentClaimRequestState!");
    clauses.push("state: { _eq: $state }");
    variables.state = input.state;
  }
  const claimQuery = `query PoolClaimRequests(${declarations.join(", ")}) { CommitmentClaimRequest(where: { ${clauses.join(", ")} }, order_by: [{ requestedAt: desc }, { id: asc }]) { ${CLAIM_FIELDS} } }`;
  const rows = await queryRows(
    claimQuery,
    variables,
    "CommitmentClaimRequest",
    "getPoolClaimRequests"
  );
  const result: PoolClaimRequestRow[] = [];
  for (const row of rows) {
    const claim = mapClaim(row);
    const commitment = byId.get(getCommitmentId(claim.chainId, claim.commitmentId));
    if (!commitment) continue;
    result.push({ claim, commitment });
  }
  return result;
}

/**
 * Commitments waiting for confirmation, each with its active roster, scoped
 * to a pool, to a garden (its pool's garden), or, for the protocol stewards,
 * to every opted-in commitment on the chain. The Confirm stage needs the
 * roster to tell whether the ordinary path can still reach threshold
 * (`selectOrdinaryConfirmationReachable`), and one query for every roster
 * beats one per row.
 */
export async function getFallbackConfirmationCandidates(input: {
  chainId: number;
  poolId?: bigint;
  garden?: Address;
  protocolFallbackEnabled?: boolean;
}): Promise<FallbackConfirmationCandidate[]> {
  const declarations = ["$chainId: Int!", "$state: CommitmentOnchainState!"];
  const clauses = [
    "chainId: { _eq: $chainId }",
    "creationSeen: { _eq: true }",
    "state: { _eq: $state }",
  ];
  const variables: Record<string, unknown> = {
    chainId: input.chainId,
    state: "READY_FOR_CONFIRMATION",
  };
  if (input.poolId !== undefined) {
    declarations.push("$poolId: numeric!");
    clauses.push("poolId: { _eq: $poolId }");
    variables.poolId = input.poolId.toString();
  }
  if (input.garden !== undefined) {
    declarations.push("$garden: String!");
    clauses.push("garden: { _eq: $garden }");
    variables.garden = input.garden.toLowerCase();
  }
  if (input.protocolFallbackEnabled !== undefined) {
    clauses.push(`protocolFallbackEnabled: { _eq: ${input.protocolFallbackEnabled} }`);
  }
  const query = `query FallbackCandidates(${declarations.join(", ")}) { Commitment(where: { ${clauses.join(", ")} }, order_by: { commitmentId: desc }) { ${COMMITMENT_FIELDS} } }`;
  const commitments = (
    await mapCommitmentsWithCycleState(
      await queryRows(query, variables, "Commitment", "getFallbackCandidates")
    )
  ).filter((row) => row.creationSeen);
  if (commitments.length === 0) return [];
  const ids = commitments.map((commitment) => commitment.id);
  const rosterQuery = `query FallbackRosters($ids: [String!]!) { CommitmentContributor(where: { commitmentEntityId: { _in: $ids }, additionSeen: { _eq: true }, active: { _eq: true } }) { commitmentEntityId contributor } }`;
  const rosters = await queryRows(
    rosterQuery,
    { ids },
    "CommitmentContributor",
    "getFallbackRosters"
  );
  const byCommitment = new Map<string, Address[]>();
  for (const row of rosters) {
    const contributor = address(row.contributor);
    if (!contributor) continue;
    const key = String(row.commitmentEntityId);
    byCommitment.set(key, [...(byCommitment.get(key) ?? []), contributor]);
  }
  return commitments.map((commitment) => ({
    commitment,
    activeContributors: byCommitment.get(commitment.id) ?? [],
  }));
}
