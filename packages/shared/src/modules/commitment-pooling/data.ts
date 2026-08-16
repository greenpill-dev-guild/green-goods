import type { Address } from "../../types/domain";
import { greenGoodsIndexer } from "../data/graphql-client";
import {
  getCommitmentCycleId,
  getCommitmentExchangeId,
  getCommitmentId,
  getCommitmentPoolId,
  getCommitmentSeriesId,
  getNeedCommitmentIndexId,
} from "./ids";
import type {
  CommitmentClaimRequestRecord,
  CommitmentCycleDetail,
  CommitmentContributorRecord,
  CommitmentCycleRecord,
  CommitmentDetail,
  CommitmentEventRecord,
  CommitmentExchangeRecord,
  CommitmentExchangeView,
  CommitmentFundingRecord,
  CommitmentHypercertBundle,
  CommitmentHypercertRecord,
  CommitmentPoolDetail,
  CommitmentPoolRecord,
  CommitmentProviderExposureRecord,
  CommitmentReadModel,
  CommitmentRequirementRecord,
  CommitmentSeriesCycleSummaryRecord,
  CommitmentSeriesRecord,
  CommitmentUnitSummaryRecord,
  HypercertContributorAllocationRecord,
  NeedCommitmentLineage,
  CommitmentPayoutPlanRecord,
  CommitmentPayoutPlanDetail,
  ContributorPayoutRecord,
  SettlementAccountDetail,
  SettlementAccountRecord,
  SettlementConfigurationRecord,
  SettlementExecutionRecord,
  SettlementMessageRecord,
  SettlementSubjectDetail,
  SettlementSubjectRecord,
  SettlementGardenRouteRecord,
  PoolMemberHistory,
} from "./types";

type RawRow = Record<string, unknown>;

const POOL_FIELDS = /* GraphQL */ `
  id chainId poolId registrationSeen garden gardenId poolType state charterCID
  openSeasonCycleId openSeasonCycleEntityId openCampaignIds openCampaignEntityIds
  providerOpenCommitmentCap liveCommitmentCount nonTerminalCycleCount
  commitmentsOffered commitmentsRequested commitmentsAccepted commitmentsReadyForConfirmation
  commitmentsFulfilled commitmentsCancelled commitmentsExpired commitmentsDisputed
  workLinkedCount workApprovedCount openCommitmentCount commitmentsDue createdAt updatedAt
`;

const CYCLE_FIELDS = /* GraphQL */ `
  id chainId cycleId seedSeen poolId poolEntityId garden gardenId cycleType state
  startTime endTime metadataCID gardenersBps treasuryBps operatorBps evaluatorBps communityBps
  funderBps equalParticipationBps verifiedContributionBps liveCommitmentCount
  commitmentsAccepted commitmentsReadyForConfirmation commitmentsFulfilled commitmentsCancelled
  commitmentsExpired commitmentsDisputed commitmentsDue openCommitmentCount createdAt updatedAt
`;

const COMMITMENT_FIELDS = /* GraphQL */ `
  id chainId commitmentId creationSeen poolId cycleId commitmentSeriesId creator recordedBy
  counterparty leadProvider providerGarden payerGarden counterpartyKind direction commitmentType
  state claimType claimMode contributorPolicy domains requirementCount contributorCount
  contributorsFrozen frozenContributorCount unitLabel targetUnits approvedUnits confirmationThreshold
  confirmationCount confirmers protocolFallbackEnabled requiresAssessment assessmentUID needUID
  counterCommitmentId counterCommitmentEntityId declaredUnitValue declaredValueBasis payoutPlanId
  metadataCID workUIDs evidenceCIDs evidenceCount dueDate considerationRail considerationSource
  considerationRecipient considerationToken considerationAmount considerationPaid
  considerationPayoutRef considerationRecordedBy readyOverridden fulfilledBy confirmationPath
  fallbackReason fulfilledByFallback preDisputeState acceptanceAt cancelledAt expiredAt
  disputeReasonCID cancelReasonCID createdAt updatedAt
`;

const SERIES_FIELDS = /* GraphQL */ `
  id chainId seriesId creationSeen poolId poolEntityId createdBy currentHolder state metadataCID
  instanceCount offeredCount acceptedCount readyCount fulfilledCount cancelledCount expiredCount
  disputedCount fulfilledCycleIds createdAt updatedAt
`;

const UNIT_SUMMARY_FIELDS = /* GraphQL */ `
  id chainId scope scopeId poolId cycleId unitLabel unitLabelHash expectedUnits approvedUnits
  fulfilledUnits openUnits updatedAt
`;

const CLAIM_FIELDS = /* GraphQL */ `
  id chainId commitmentId claimant requestSeen requestedBy claimType gardenContext state reasonCID
  resolutionCode requestedAt resolvedAt updatedAt
`;

const EVENT_FIELDS = /* GraphQL */ `
  id chainId poolId cycleId commitmentId eventType actor configurationKey previousValue newValue
  units data txHash timestamp
`;

function integer(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string" && value.length > 0) return BigInt(value);
  return 0n;
}

function optionalInteger(value: unknown): bigint | null {
  return value === null || value === undefined || value === "" ? null : integer(value);
}

function number(value: unknown): number {
  return typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
}

function optionalNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : number(value);
}

function address(value: unknown): Address | null {
  return typeof value === "string" && value !== "" ? (value.toLowerCase() as Address) : null;
}

function string(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function hexString(value: unknown): `0x${string}` | null {
  const candidate = string(value);
  return candidate ? (candidate.toLowerCase() as `0x${string}`) : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function integers(value: unknown): bigint[] {
  return Array.isArray(value) ? value.map(integer) : [];
}

async function queryRows(
  query: string,
  variables: Record<string, unknown>,
  field: string,
  operationName: string
): Promise<RawRow[]> {
  const result = await greenGoodsIndexer.query<Record<string, RawRow[]>>(
    query,
    variables,
    operationName
  );
  if (result.error) throw result.error;
  return result.data?.[field] ?? [];
}

function mapPool(row: RawRow): CommitmentPoolRecord {
  if (row.registrationSeen !== true) throw new Error("unseen commitment pool placeholder");
  return {
    id: String(row.id),
    chainId: number(row.chainId),
    poolId: integer(row.poolId),
    registrationSeen: true,
    garden: address(row.garden),
    gardenId: string(row.gardenId),
    poolType: row.poolType as CommitmentPoolRecord["poolType"],
    state: row.state as CommitmentPoolRecord["state"],
    charterCID: string(row.charterCID),
    openSeasonCycleId: optionalInteger(row.openSeasonCycleId),
    openSeasonCycleEntityId: string(row.openSeasonCycleEntityId),
    openCampaignIds: integers(row.openCampaignIds),
    openCampaignEntityIds: strings(row.openCampaignEntityIds),
    providerOpenCommitmentCap: integer(row.providerOpenCommitmentCap),
    liveCommitmentCount: integer(row.liveCommitmentCount),
    nonTerminalCycleCount: integer(row.nonTerminalCycleCount),
    commitmentsOffered: integer(row.commitmentsOffered),
    commitmentsRequested: integer(row.commitmentsRequested),
    commitmentsAccepted: integer(row.commitmentsAccepted),
    commitmentsReadyForConfirmation: integer(row.commitmentsReadyForConfirmation),
    commitmentsFulfilled: integer(row.commitmentsFulfilled),
    commitmentsCancelled: integer(row.commitmentsCancelled),
    commitmentsExpired: integer(row.commitmentsExpired),
    commitmentsDisputed: integer(row.commitmentsDisputed),
    workLinkedCount: integer(row.workLinkedCount),
    workApprovedCount: integer(row.workApprovedCount),
    openCommitmentCount: integer(row.openCommitmentCount),
    commitmentsDue: integer(row.commitmentsDue),
    createdAt: optionalNumber(row.createdAt),
    updatedAt: number(row.updatedAt),
  };
}

function mapCycle(row: RawRow): CommitmentCycleRecord {
  if (row.seedSeen !== true) throw new Error("unseen commitment cycle placeholder");
  return {
    id: String(row.id),
    chainId: number(row.chainId),
    cycleId: integer(row.cycleId),
    seedSeen: true,
    poolId: integer(row.poolId),
    poolEntityId: String(row.poolEntityId),
    garden: address(row.garden),
    gardenId: string(row.gardenId),
    cycleType: row.cycleType as CommitmentCycleRecord["cycleType"],
    state: row.state as CommitmentCycleRecord["state"],
    startTime: optionalInteger(row.startTime),
    endTime: optionalInteger(row.endTime),
    metadataCID: string(row.metadataCID),
    gardenersBps: number(row.gardenersBps),
    treasuryBps: number(row.treasuryBps),
    operatorBps: number(row.operatorBps),
    evaluatorBps: number(row.evaluatorBps),
    communityBps: number(row.communityBps),
    funderBps: number(row.funderBps),
    equalParticipationBps: number(row.equalParticipationBps),
    verifiedContributionBps: number(row.verifiedContributionBps),
    liveCommitmentCount: integer(row.liveCommitmentCount),
    commitmentsAccepted: integer(row.commitmentsAccepted),
    commitmentsReadyForConfirmation: integer(row.commitmentsReadyForConfirmation),
    commitmentsFulfilled: integer(row.commitmentsFulfilled),
    commitmentsCancelled: integer(row.commitmentsCancelled),
    commitmentsExpired: integer(row.commitmentsExpired),
    commitmentsDisputed: integer(row.commitmentsDisputed),
    commitmentsDue: integer(row.commitmentsDue),
    openCommitmentCount: integer(row.openCommitmentCount),
    createdAt: optionalNumber(row.createdAt),
    updatedAt: number(row.updatedAt),
  };
}

function mapCommitment(row: RawRow): CommitmentReadModel {
  return {
    ...row,
    id: String(row.id),
    chainId: number(row.chainId),
    commitmentId: integer(row.commitmentId),
    creationSeen: row.creationSeen === true,
    state: String(row.state ?? "UNKNOWN") as CommitmentReadModel["state"],
    approvedUnits: integer(row.approvedUnits),
    evidenceCount: number(row.evidenceCount),
    cycleId: optionalInteger(row.cycleId),
    poolId: optionalInteger(row.poolId),
    commitmentSeriesId: optionalInteger(row.commitmentSeriesId),
    creator: address(row.creator),
    leadProvider: address(row.leadProvider),
    unitLabel: string(row.unitLabel),
    targetUnits: integer(row.targetUnits),
    needUID: string(row.needUID),
    counterCommitmentId: optionalInteger(row.counterCommitmentId),
    declaredUnitValue: optionalInteger(row.declaredUnitValue),
    declaredValueBasis: string(row.declaredValueBasis),
    considerationRail: row.considerationRail as CommitmentReadModel["considerationRail"],
    considerationPaid: row.considerationPaid === true,
  };
}

function mapSeries(row: RawRow): CommitmentSeriesRecord {
  if (row.creationSeen !== true) throw new Error("unseen commitment series placeholder");
  return {
    id: String(row.id),
    chainId: number(row.chainId),
    seriesId: integer(row.seriesId),
    creationSeen: true,
    poolId: integer(row.poolId),
    poolEntityId: String(row.poolEntityId),
    createdBy: address(row.createdBy)!,
    currentHolder: address(row.currentHolder)!,
    state: String(row.state ?? "UNKNOWN") as CommitmentSeriesRecord["state"],
    metadataCID: String(row.metadataCID ?? ""),
    instanceCount: integer(row.instanceCount),
    offeredCount: integer(row.offeredCount),
    acceptedCount: integer(row.acceptedCount),
    readyCount: integer(row.readyCount),
    fulfilledCount: integer(row.fulfilledCount),
    cancelledCount: integer(row.cancelledCount),
    expiredCount: integer(row.expiredCount),
    disputedCount: integer(row.disputedCount),
    fulfilledCycleIds: strings(row.fulfilledCycleIds),
    createdAt: number(row.createdAt),
    updatedAt: number(row.updatedAt),
  };
}

function mapUnitSummary(row: RawRow): CommitmentUnitSummaryRecord {
  return {
    id: String(row.id),
    chainId: number(row.chainId),
    scope: row.scope as "POOL" | "CYCLE",
    scopeId: integer(row.scopeId),
    poolId: integer(row.poolId),
    cycleId: optionalInteger(row.cycleId),
    unitLabel: String(row.unitLabel),
    unitLabelHash: String(row.unitLabelHash).toLowerCase() as `0x${string}`,
    expectedUnits: integer(row.expectedUnits),
    approvedUnits: integer(row.approvedUnits),
    fulfilledUnits: integer(row.fulfilledUnits),
    openUnits: integer(row.openUnits),
    updatedAt: number(row.updatedAt),
  };
}

export async function getCommitmentPools(
  chainId: number,
  garden?: Address
): Promise<CommitmentPoolRecord[]> {
  const gardenClause = garden ? ", garden: { _eq: $garden }" : "";
  const query = `query CommitmentPools($chainId: Int!${garden ? ", $garden: String!" : ""}) {
    CommitmentPool(where: { chainId: { _eq: $chainId }, registrationSeen: { _eq: true }${gardenClause} }, order_by: { poolId: asc }) { ${POOL_FIELDS} }
  }`;
  const rows = await queryRows(
    query,
    { chainId, ...(garden ? { garden: garden.toLowerCase() } : {}) },
    "CommitmentPool",
    "getCommitmentPools"
  );
  return rows.map(mapPool);
}

export async function getCommitmentPoolDetail(
  chainId: number,
  poolId: bigint
): Promise<CommitmentPoolDetail | null> {
  const id = getCommitmentPoolId(chainId, poolId);
  const query = `query CommitmentPoolDetail($chainId: Int!, $id: String!, $poolId: numeric!) {
    CommitmentPool(where: { id: { _eq: $id }, registrationSeen: { _eq: true } }, limit: 1) { ${POOL_FIELDS} }
    CommitmentUnitSummary(where: { chainId: { _eq: $chainId }, scope: { _eq: POOL }, scopeId: { _eq: $poolId } }, order_by: { unitLabelHash: asc }) { ${UNIT_SUMMARY_FIELDS} }
    CommitmentProviderExposure(where: { chainId: { _eq: $chainId }, poolId: { _eq: $poolId } }, order_by: { provider: asc }) { id chainId poolId provider openCommitmentCount updatedAt }
  }`;
  const result = await greenGoodsIndexer.query<Record<string, RawRow[]>>(
    query,
    { chainId, id, poolId: poolId.toString() },
    "getCommitmentPoolDetail"
  );
  if (result.error) throw result.error;
  const pool = result.data?.CommitmentPool?.[0];
  if (!pool) return null;
  return {
    pool: mapPool(pool),
    unitSummaries: (result.data?.CommitmentUnitSummary ?? []).map(mapUnitSummary),
    providerExposures: (result.data?.CommitmentProviderExposure ?? []).map(
      (row): CommitmentProviderExposureRecord => ({
        id: String(row.id),
        chainId: number(row.chainId),
        poolId: integer(row.poolId),
        provider: address(row.provider)!,
        openCommitmentCount: integer(row.openCommitmentCount),
        updatedAt: number(row.updatedAt),
      })
    ),
  };
}

export async function getCommitmentCycles(input: {
  chainId: number;
  poolId: bigint;
  cycleType?: string;
  state?: string;
}): Promise<CommitmentCycleRecord[]> {
  const clauses = [
    "chainId: { _eq: $chainId }",
    "poolId: { _eq: $poolId }",
    "seedSeen: { _eq: true }",
  ];
  const declarations = ["$chainId: Int!", "$poolId: numeric!"];
  const variables: Record<string, unknown> = {
    chainId: input.chainId,
    poolId: input.poolId.toString(),
  };
  if (input.cycleType) {
    declarations.push("$cycleType: CommitmentCycleType!");
    clauses.push("cycleType: { _eq: $cycleType }");
    variables.cycleType = input.cycleType;
  }
  if (input.state) {
    declarations.push("$state: CommitmentCycleState!");
    clauses.push("state: { _eq: $state }");
    variables.state = input.state;
  }
  const query = `query CommitmentCycles(${declarations.join(", ")}) { CommitmentCycle(where: { ${clauses.join(", ")} }, order_by: { cycleId: desc }) { ${CYCLE_FIELDS} } }`;
  return (await queryRows(query, variables, "CommitmentCycle", "getCommitmentCycles")).map(
    mapCycle
  );
}

export async function getCommitmentCycleDetail(
  chainId: number,
  cycleId: bigint
): Promise<CommitmentCycleDetail | null> {
  const id = getCommitmentCycleId(chainId, cycleId);
  const query = `query CommitmentCycleDetail($id: String!, $chainId: Int!, $cycleId: numeric!) {
    CommitmentCycle(where: { id: { _eq: $id }, seedSeen: { _eq: true } }, limit: 1) { ${CYCLE_FIELDS} }
    CommitmentUnitSummary(where: { chainId: { _eq: $chainId }, scope: { _eq: CYCLE }, scopeId: { _eq: $cycleId } }, order_by: { unitLabelHash: asc }) { ${UNIT_SUMMARY_FIELDS} }
    CommitmentSeriesCycleSummary(where: { chainId: { _eq: $chainId }, cycleId: { _eq: $cycleId } }, order_by: { seriesId: asc }) {
      id chainId seriesId seriesEntityId cycleId cycleEntityId poolId poolEntityId instanceCount
      offeredCount acceptedCount readyCount fulfilledCount cancelledCount expiredCount disputedCount updatedAt
    }
  }`;
  const result = await greenGoodsIndexer.query<Record<string, RawRow[]>>(
    query,
    { id, chainId, cycleId: cycleId.toString() },
    "getCommitmentCycleDetail"
  );
  if (result.error) throw result.error;
  const cycle = result.data?.CommitmentCycle?.[0];
  if (!cycle) return null;
  return {
    cycle: mapCycle(cycle),
    unitSummaries: (result.data?.CommitmentUnitSummary ?? []).map(mapUnitSummary),
    seriesSummaries: (result.data?.CommitmentSeriesCycleSummary ?? []).map(mapSeriesCycleSummary),
  };
}

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
  let allowedIds: string[] | undefined;
  if (input.account) {
    const contributorQuery = `query CommitmentMembership($chainId: Int!, $account: String!) { CommitmentContributor(where: { chainId: { _eq: $chainId }, contributor: { _eq: $account }, additionSeen: { _eq: true }, active: { _eq: true } }) { commitmentEntityId } }`;
    allowedIds = (
      await queryRows(
        contributorQuery,
        { chainId: input.chainId, account: input.account.toLowerCase() },
        "CommitmentContributor",
        "getCommitmentMembership"
      )
    ).map((row) => String(row.commitmentEntityId));
    if (allowedIds.length === 0) return [];
    declarations.push("$ids: [String!]!");
    clauses.push("id: { _in: $ids }");
    variables.ids = allowedIds;
  }
  const query = `query Commitments(${declarations.join(", ")}) { Commitment(where: { ${clauses.join(", ")} }, order_by: { commitmentId: desc }) { ${COMMITMENT_FIELDS} } }`;
  return (await queryRows(query, variables, "Commitment", "getCommitments"))
    .map(mapCommitment)
    .filter((row) => row.creationSeen);
}

async function rowsByIds(entity: string, fields: string, ids: string[]): Promise<RawRow[]> {
  if (ids.length === 0) return [];
  const query = `query ${entity}ByIds($ids: [String!]!) { ${entity}(where: { id: { _in: $ids } }) { ${fields} } }`;
  return queryRows(query, { ids }, entity, `${entity}ByIds`);
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
    CommitmentWorkAttribution(where: { chainId: { _eq: $chainId }, commitmentId: { _eq: $commitmentId }, linkSeen: { _eq: true } }, order_by: { workUID: asc }) { id chainId workUID commitmentId linkSeen contributor requirementIndex operationKey linked creditActive latestDecisionSequence latestDecisionUID linkedBy linkedAt unlinkedBy unlinkedAt updatedAt }
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
  return {
    commitment: mapCommitment(commitmentRow),
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
    workAttributions: (result.data?.CommitmentWorkAttribution ?? []).filter(
      (row) => row.linkSeen === true
    ),
    evidenceAttributions: evidence,
    claimRequests: claims.filter((row) => row.requestSeen === true).map(mapClaim),
    counterpartCommitments: counterparts.map(mapCommitment).filter((row) => row.creationSeen),
  };
}

function mapClaim(row: RawRow): CommitmentClaimRequestRecord {
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
  const query = `query CommitmentClaimRequests(${declarations.join(", ")}) { CommitmentClaimRequest(where: { ${clauses.join(", ")} }, order_by: { updatedAt: desc }) { ${CLAIM_FIELDS} } }`;
  return (
    await queryRows(query, variables, "CommitmentClaimRequest", "getCommitmentClaimRequests")
  ).map(mapClaim);
}

export async function getCommitmentSeries(input: {
  chainId: number;
  poolId?: bigint;
  holder?: Address;
  state?: string;
}): Promise<CommitmentSeriesRecord[]> {
  const declarations = ["$chainId: Int!"];
  const clauses = ["chainId: { _eq: $chainId }", "creationSeen: { _eq: true }"];
  const variables: Record<string, unknown> = { chainId: input.chainId };
  if (input.poolId !== undefined) {
    declarations.push("$poolId: numeric!");
    clauses.push("poolId: { _eq: $poolId }");
    variables.poolId = input.poolId.toString();
  }
  if (input.holder) {
    declarations.push("$holder: String!");
    clauses.push("currentHolder: { _eq: $holder }");
    variables.holder = input.holder.toLowerCase();
  }
  if (input.state) {
    declarations.push("$state: CommitmentSeriesState!");
    clauses.push("state: { _eq: $state }");
    variables.state = input.state;
  }
  const query = `query CommitmentSeriesList(${declarations.join(", ")}) { CommitmentSeries(where: { ${clauses.join(", ")} }, order_by: { seriesId: desc }) { ${SERIES_FIELDS} } }`;
  return (await queryRows(query, variables, "CommitmentSeries", "getCommitmentSeries")).map(
    mapSeries
  );
}

export async function getCommitmentSeriesDetail(
  chainId: number,
  seriesId: bigint
): Promise<{
  series: CommitmentSeriesRecord;
  cycleSummaries: CommitmentSeriesCycleSummaryRecord[];
} | null> {
  const id = getCommitmentSeriesId(chainId, seriesId);
  const query = `query CommitmentSeriesDetail($id: String!, $chainId: Int!, $seriesId: numeric!) {
    CommitmentSeries(where: { id: { _eq: $id }, creationSeen: { _eq: true } }, limit: 1) { ${SERIES_FIELDS} }
    CommitmentSeriesCycleSummary(where: { chainId: { _eq: $chainId }, seriesId: { _eq: $seriesId } }, order_by: { cycleId: desc }) {
      id chainId seriesId seriesEntityId cycleId cycleEntityId poolId poolEntityId instanceCount
      offeredCount acceptedCount readyCount fulfilledCount cancelledCount expiredCount disputedCount updatedAt
    }
  }`;
  const result = await greenGoodsIndexer.query<Record<string, RawRow[]>>(
    query,
    { id, chainId, seriesId: seriesId.toString() },
    "getCommitmentSeriesDetail"
  );
  if (result.error) throw result.error;
  const series = result.data?.CommitmentSeries?.[0];
  return series
    ? {
        series: mapSeries(series),
        cycleSummaries: (result.data?.CommitmentSeriesCycleSummary ?? []).map(
          mapSeriesCycleSummary
        ),
      }
    : null;
}

function mapSeriesCycleSummary(row: RawRow): CommitmentSeriesCycleSummaryRecord {
  return {
    id: String(row.id),
    chainId: number(row.chainId),
    seriesId: integer(row.seriesId),
    seriesEntityId: String(row.seriesEntityId),
    cycleId: integer(row.cycleId),
    cycleEntityId: String(row.cycleEntityId),
    poolId: integer(row.poolId),
    poolEntityId: String(row.poolEntityId),
    instanceCount: integer(row.instanceCount),
    offeredCount: integer(row.offeredCount),
    acceptedCount: integer(row.acceptedCount),
    readyCount: integer(row.readyCount),
    fulfilledCount: integer(row.fulfilledCount),
    cancelledCount: integer(row.cancelledCount),
    expiredCount: integer(row.expiredCount),
    disputedCount: integer(row.disputedCount),
    updatedAt: number(row.updatedAt),
  };
}

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
  return {
    needUID: String(index.needUID),
    commitments: commitments.map(mapCommitment).filter((row) => row.creationSeen),
    fulfilledCommitments: fulfilledCommitments
      .map(mapCommitment)
      .filter((row) => row.creationSeen && row.state === "FULFILLED"),
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
  const commitments = (result.data?.Commitment ?? [])
    .map(mapCommitment)
    .filter((row) => row.creationSeen);
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

function mapSettlementConfiguration(row: RawRow): SettlementConfigurationRecord {
  return {
    id: String(row.id),
    chainId: number(row.chainId),
    role: String(row.role),
    gardenerDeliveryEnabled:
      row.gardenerDeliveryEnabled === null || row.gardenerDeliveryEnabled === undefined
        ? null
        : row.gardenerDeliveryEnabled === true,
    protocolGarden: address(row.protocolGarden),
    gDollarToken: address(row.gDollarToken)!,
    hatsModule: address(row.hatsModule),
    commitmentPoolingModule: address(row.commitmentPoolingModule),
    localContract: address(row.localContract)!,
    localRouter: address(row.localRouter)!,
    localChainSelector: integer(row.localChainSelector),
    remoteChainSelector: optionalInteger(row.remoteChainSelector),
    remoteEvmChainId: optionalNumber(row.remoteEvmChainId),
    destinationGasLimit: optionalNumber(row.destinationGasLimit),
    activePeer: address(row.activePeer),
    previousPeer: address(row.previousPeer),
    previousPeerExpiresAt: optionalInteger(row.previousPeerExpiresAt),
    protocolVersion: number(row.protocolVersion),
    dispatcher: address(row.dispatcher),
    batchSizeLimit: number(row.batchSizeLimit),
    maxTransferAmount: optionalInteger(row.maxTransferAmount),
    maxBatchAmount: optionalInteger(row.maxBatchAmount),
    maxFeeBps: optionalNumber(row.maxFeeBps),
    maxFeeAmount: optionalInteger(row.maxFeeAmount),
    periodDuration: optionalNumber(row.periodDuration),
    maxPeriodAmount: optionalInteger(row.maxPeriodAmount),
    feeReserveMinimum: integer(row.feeReserveMinimum),
    nativeFeeBalance: integer(row.nativeFeeBalance),
    feeReserveLow: row.feeReserveLow === true,
    peerConfigured: row.peerConfigured === true,
    paused: row.paused === true,
    updatedAt: number(row.updatedAt),
  };
}

function mapSettlementSubject(row: RawRow, isBatch: boolean): SettlementSubjectRecord {
  return {
    id: String(row.id),
    chainId: number(row.chainId),
    isBatch,
    subjectId: integer(isBatch ? row.batchId : row.disbursementId),
    executorGarden: address(row.executorGarden)!,
    state: String(row.state ?? "UNKNOWN") as SettlementSubjectRecord["state"],
    attempt: number(row.attempt),
    executionKey: hexString(row.executionKey),
    commandMessageId: hexString(row.commandMessageId),
    acknowledgmentMessageId: hexString(row.acknowledgmentMessageId),
    dispatchedAt: optionalNumber(row.dispatchedAt),
    confirmedAt: optionalNumber(row.confirmedAt),
    failureCode: optionalNumber(row.failureCode),
    reasonCID: string(row.reasonCID),
    cancelledFromState:
      row.cancelledFromState === "FAILED" || row.cancelledFromState === "QUEUED"
        ? row.cancelledFromState
        : null,
    batchId: isBatch ? integer(row.batchId) : optionalInteger(row.batchId),
    kind: string(row.kind),
    fundingRoute: string(row.fundingRoute),
    source: address(row.source),
    recipient: address(row.recipient),
    token: address(row.token),
    amount: optionalInteger(row.amount),
    updatedAt: number(row.updatedAt),
  };
}

function mapSettlementMessage(row: RawRow): SettlementMessageRecord {
  return {
    id: String(row.id),
    chainId: number(row.chainId),
    messageId: String(row.messageId).toLowerCase() as `0x${string}`,
    executionKey: String(row.executionKey).toLowerCase() as `0x${string}`,
    direction: row.direction as "COMMAND" | "ACKNOWLEDGMENT",
    status: String(row.status),
    isBatch: row.isBatch === true,
    subjectId: integer(row.subjectId),
    attempt: optionalNumber(row.attempt),
    destinationPeer: address(row.destinationPeer),
    destinationGasLimit: optionalNumber(row.destinationGasLimit),
    protocolVersion: number(row.protocolVersion),
    commandPayloadHash: hexString(row.commandPayloadHash),
    sourceChainId: number(row.sourceChainId),
    destinationChainId: number(row.destinationChainId),
    fee: optionalInteger(row.fee),
    reserveFunded:
      row.reserveFunded === null || row.reserveFunded === undefined
        ? null
        : row.reserveFunded === true,
    failureCode: optionalNumber(row.failureCode),
    txHash: String(row.txHash).toLowerCase() as `0x${string}`,
    createdAt: number(row.createdAt),
    updatedAt: number(row.updatedAt),
  };
}

function mapSettlementExecution(row: RawRow): SettlementExecutionRecord {
  return {
    id: String(row.id),
    chainId: number(row.chainId),
    sourceChainId: number(row.sourceChainId),
    executionKey: String(row.executionKey).toLowerCase() as `0x${string}`,
    commandMessageId: String(row.commandMessageId).toLowerCase() as `0x${string}`,
    acknowledgmentReceiver: address(row.acknowledgmentReceiver)!,
    protocolVersion: number(row.protocolVersion),
    executorGarden: address(row.executorGarden)!,
    isBatch: row.isBatch === true,
    settlementId: integer(row.settlementId),
    attempt: number(row.attempt),
    status: String(row.status),
    failureCode: number(row.failureCode),
    txHash: String(row.txHash).toLowerCase() as `0x${string}`,
    acknowledgmentMessageId: hexString(row.acknowledgmentMessageId),
    acknowledgmentSent: row.acknowledgmentSent === true,
    acknowledgmentDeferralCode: String(row.acknowledgmentDeferralCode),
    createdAt: number(row.createdAt),
    updatedAt: number(row.updatedAt),
  };
}

function mapCommitmentPayoutPlan(row: RawRow): CommitmentPayoutPlanRecord {
  return {
    id: String(row.id),
    chainId: number(row.chainId),
    payoutPlanId: integer(row.payoutPlanId),
    commitmentId: integer(row.commitmentId),
    payerGarden: address(row.payerGarden)!,
    payerGardenId: String(row.payerGardenId),
    providerGarden: address(row.providerGarden)!,
    providerGardenId: String(row.providerGardenId),
    settlementFlow: String(row.settlementFlow) as CommitmentPayoutPlanRecord["settlementFlow"],
    payoutKind: String(row.payoutKind) as CommitmentPayoutPlanRecord["payoutKind"],
    declaredAmount: integer(row.declaredAmount),
    gardenRetainedAmount: integer(row.gardenRetainedAmount),
    contributorPayoutTotal: integer(row.contributorPayoutTotal),
    beneficiaryGarden: address(row.beneficiaryGarden),
    beneficiaryRecipient: address(row.beneficiaryRecipient),
    beneficiaryAmount: integer(row.beneficiaryAmount),
    beneficiaryDisbursementId: optionalInteger(row.beneficiaryDisbursementId),
    recognitionSnapshotHash: String(row.recognitionSnapshotHash).toLowerCase() as `0x${string}`,
    paymentSnapshotHash: String(row.paymentSnapshotHash).toLowerCase() as `0x${string}`,
    paymentSnapshotVersion: number(row.paymentSnapshotVersion),
    finalized: row.finalized === true,
    status: String(row.status),
    payablePayoutCount: number(row.payablePayoutCount),
    preparedPayoutCount: number(row.preparedPayoutCount),
    confirmedPayoutCount: number(row.confirmedPayoutCount),
    failedPayoutCount: number(row.failedPayoutCount),
    cancelledPayoutCount: number(row.cancelledPayoutCount),
    createdAt: number(row.createdAt),
    finalizedAt: optionalNumber(row.finalizedAt),
    updatedAt: number(row.updatedAt),
  };
}

function mapContributorPayout(row: RawRow): ContributorPayoutRecord {
  return {
    id: String(row.id),
    chainId: number(row.chainId),
    payoutPlanId: integer(row.payoutPlanId),
    commitmentId: integer(row.commitmentId),
    contributor: address(row.contributor)!,
    recipient: address(row.recipient)!,
    paymentSnapshotVersion: number(row.paymentSnapshotVersion),
    recognitionWeightBps: number(row.recognitionWeightBps),
    paymentWeightBps: number(row.paymentWeightBps),
    amount: integer(row.amount),
    disbursementId: optionalInteger(row.disbursementId),
    disbursementEntityId: string(row.disbursementEntityId),
    latestEditReasonCID: string(row.latestEditReasonCID),
    editedBy: address(row.editedBy)!,
    createdAt: number(row.createdAt),
    updatedAt: number(row.updatedAt),
  };
}

function mapSettlementAccount(row: RawRow): SettlementAccountRecord {
  return {
    id: String(row.id),
    chainId: number(row.chainId),
    garden: address(row.garden)!,
    gardenId: String(row.gardenId),
    accountChainId: integer(row.accountChainId),
    account: address(row.account)!,
    active: row.active === true,
    recoveryOwners: strings(row.recoveryOwners).map((value) => value.toLowerCase() as Address),
    rolesModifier: address(row.rolesModifier)!,
    roleKey: String(row.roleKey).toLowerCase() as `0x${string}`,
    allowanceKey: String(row.allowanceKey).toLowerCase() as `0x${string}`,
    permissionsConfigHash: String(row.permissionsConfigHash).toLowerCase() as `0x${string}`,
    recoveryConfigHash: String(row.recoveryConfigHash).toLowerCase() as `0x${string}`,
    recoveryThreshold: number(row.recoveryThreshold),
    updatedAt: number(row.updatedAt),
  };
}

function mapSettlementGardenRoute(row: RawRow): SettlementGardenRouteRecord {
  return {
    id: String(row.id),
    chainId: number(row.chainId),
    sourceChainId: number(row.sourceChainId),
    garden: address(row.garden)!,
    gardenId: String(row.gardenId),
    settlementAccountId: String(row.settlementAccountId),
    safe: address(row.safe)!,
    rolesModifier: address(row.rolesModifier)!,
    roleKey: String(row.roleKey).toLowerCase() as `0x${string}`,
    allowanceKey: String(row.allowanceKey).toLowerCase() as `0x${string}`,
    permissionsConfigHash: String(row.permissionsConfigHash).toLowerCase() as `0x${string}`,
    active: row.active === true,
    configuredAt: number(row.configuredAt),
    updatedAt: number(row.updatedAt),
  };
}

export async function getPoolMemberHistory(
  chainId: number,
  poolId: bigint,
  accountValue: Address
): Promise<PoolMemberHistory | null> {
  const id = `${chainId}-${poolId}-${accountValue.toLowerCase()}`;
  const query = `query PoolMemberHistory($id: String!) { PoolMemberHistory(where: { id: { _eq: $id } }, limit: 1) { id chainId poolId account leadAccepted leadFulfilled leadCancelled leadExpired contributorFulfilled receivedFulfilled confirmationsGiven disputesRaised updatedAt } }`;
  const row = (await queryRows(query, { id }, "PoolMemberHistory", "getPoolMemberHistory"))[0];
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

export async function getCommitmentActivity(input: {
  chainId: number;
  poolId?: bigint;
  cycleId?: bigint;
  commitmentId?: bigint;
  limit?: number;
  offset?: number;
}): Promise<CommitmentEventRecord[]> {
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
  return (await queryRows(query, variables, "CommitmentEvent", "getCommitmentActivity")).map(
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
