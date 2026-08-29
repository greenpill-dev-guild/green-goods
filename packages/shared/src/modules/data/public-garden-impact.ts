import { isGardenPubliclyVisible } from "../../config/garden-visibility";
import {
  PUBLIC_GARDEN_IMPACT_DOMAINS,
  PUBLIC_GARDEN_IMPACT_MAX_RECENT_LIMIT,
  PUBLIC_GARDEN_IMPACT_VERSION,
  type PublicGardenImpactActionBreakdown,
  type PublicGardenImpactDomain,
  type PublicGardenImpactDomainBreakdown,
  type PublicGardenImpactRecentWork,
  type PublicGardenImpactResponseV1,
  type PublicGardenImpactSource,
} from "../../public-contracts/garden-impact";
import type { Address } from "../../public-contracts/core";
import { buildPublicGardenImpactPath } from "../../public-contracts/routes";
import { getAddress } from "viem";

const PUBLIC_GARDEN_IMPACT_API_URL = "https://agent.greengoods.app";

export interface PublicGardenImpactGardenRecord {
  id: string;
  name: string | null;
  location: string | null;
}

export interface PublicGardenImpactWorkRecord {
  id: string;
  actionUID: number;
  title: string;
  feedback: string;
  media: string[];
  createdAt: number;
}

export interface PublicGardenImpactApprovalRecord {
  id: string;
  workUID: string;
  approved: boolean;
  createdAt: number;
}

export interface PublicGardenImpactActionRecord {
  id: string;
  title: string | null;
  domain: PublicGardenImpactDomain | null;
}

export interface PublicGardenImpactAssessmentRecord {
  id: string;
  createdAt: number;
}

export interface PublicGardenImpactCertificateRecord {
  id: string;
  status: "active" | "claimed" | "sold" | "unknown";
  mintedAt: number;
  updatedAt: number;
}

export interface PublicGardenImpactReaders {
  readGarden(
    chainId: number,
    gardenAddress: Address
  ): Promise<PublicGardenImpactGardenRecord | null>;
  readWorks(chainId: number, gardenAddress: Address): Promise<PublicGardenImpactWorkRecord[]>;
  readApprovals(chainId: number): Promise<PublicGardenImpactApprovalRecord[]>;
  readActions(chainId: number): Promise<PublicGardenImpactActionRecord[]>;
  readAssessments(
    chainId: number,
    gardenAddress: Address
  ): Promise<PublicGardenImpactAssessmentRecord[]>;
  readCertificates(
    chainId: number,
    gardenAddress: Address
  ): Promise<PublicGardenImpactCertificateRecord[]>;
}

export interface PublicGardenImpactLoadInput {
  chainId: number;
  gardenAddress: string;
  recentLimit: number;
}

export class PublicGardenImpactNotFoundError extends Error {
  constructor() {
    super("Public garden not found");
    this.name = "PublicGardenImpactNotFoundError";
  }
}

export class PublicGardenImpactProviderError extends Error {
  constructor() {
    super("Public garden impact providers are unavailable");
    this.name = "PublicGardenImpactProviderError";
  }
}

interface SourceState<T> {
  available: boolean;
  data: T;
}

const unavailable = <T>(fallback: T): SourceState<T> => ({ available: false, data: fallback });

async function settle<T>(read: () => Promise<T>, fallback: T): Promise<SourceState<T>> {
  try {
    return { available: true, data: await read() };
  } catch {
    return unavailable(fallback);
  }
}

function dedupeNewest<T extends { id: string }>(
  records: readonly T[],
  timestamp: (record: T) => number
): T[] {
  const byId = new Map<string, T>();
  for (const record of records) {
    const key = record.id.toLowerCase();
    const existing = byId.get(key);
    if (!existing || timestamp(record) > timestamp(existing)) byId.set(key, record);
  }
  return [...byId.values()];
}

function toIso(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

function latestIso(values: readonly number[]): string | null {
  return toIso(values.reduce((latest, value) => Math.max(latest, value), 0));
}

function buildApprovedAt(
  approvals: readonly PublicGardenImpactApprovalRecord[],
  workIds: ReadonlySet<string>
): Map<string, number> {
  const approvedAt = new Map<string, number>();
  for (const approval of approvals) {
    const workId = approval.workUID.toLowerCase();
    if (!approval.approved || !workIds.has(workId)) continue;
    approvedAt.set(workId, Math.max(approvedAt.get(workId) ?? 0, approval.createdAt));
  }
  return approvedAt;
}

function buildBreakdown(input: {
  chainId: number;
  works: readonly PublicGardenImpactWorkRecord[];
  approvalsAvailable: boolean;
  approvedAt: ReadonlyMap<string, number>;
  actions: readonly PublicGardenImpactActionRecord[];
}): {
  byDomain: PublicGardenImpactDomainBreakdown[];
  byAction: PublicGardenImpactActionBreakdown[];
} {
  const actions = new Map(input.actions.map((action) => [action.id.toLowerCase(), action]));
  const byAction = new Map<number, PublicGardenImpactWorkRecord[]>();
  for (const work of input.works) {
    const records = byAction.get(work.actionUID) ?? [];
    records.push(work);
    byAction.set(work.actionUID, records);
  }

  const actionRows = [...byAction.entries()]
    .sort(([left], [right]) => left - right)
    .map(([actionUid, works]) => {
      const actionId = `${input.chainId}-${actionUid}`;
      const action = actions.get(actionId.toLowerCase());
      return {
        actionUid,
        actionId,
        title: action?.title ?? null,
        domain: action?.domain ?? null,
        submittedWorkCount: works.length,
        approvedWorkCount: input.approvalsAvailable
          ? works.filter((work) => input.approvedAt.has(work.id.toLowerCase())).length
          : null,
      } satisfies PublicGardenImpactActionBreakdown;
    });

  const domainRows = PUBLIC_GARDEN_IMPACT_DOMAINS.map((domain) => {
    const matchingWorks = input.works.filter((work) => {
      const action = actions.get(`${input.chainId}-${work.actionUID}`.toLowerCase());
      return action?.domain === domain;
    });
    return {
      domain,
      submittedWorkCount: matchingWorks.length,
      approvedWorkCount: input.approvalsAvailable
        ? matchingWorks.filter((work) => input.approvedAt.has(work.id.toLowerCase())).length
        : null,
    } satisfies PublicGardenImpactDomainBreakdown;
  });
  return { byDomain: domainRows, byAction: actionRows };
}

function buildRecentWork(input: {
  chainId: number;
  works: readonly PublicGardenImpactWorkRecord[];
  approvedAt: ReadonlyMap<string, number>;
  actions: readonly PublicGardenImpactActionRecord[];
  limit: number;
}): PublicGardenImpactRecentWork[] {
  const actions = new Map(input.actions.map((action) => [action.id.toLowerCase(), action]));
  return input.works
    .filter((work) => input.approvedAt.has(work.id.toLowerCase()))
    .sort((left, right) => right.createdAt - left.createdAt || left.id.localeCompare(right.id))
    .slice(0, input.limit)
    .map((work) => {
      const action = actions.get(`${input.chainId}-${work.actionUID}`.toLowerCase());
      return {
        id: work.id,
        title: work.title,
        description: work.feedback.trim() || null,
        media: [...work.media],
        actionUid: work.actionUID,
        action: action ? { id: action.id, title: action.title, domain: action.domain } : null,
        createdAt: toIso(work.createdAt) ?? new Date(0).toISOString(),
        approvedAt:
          toIso(input.approvedAt.get(work.id.toLowerCase()) ?? 0) ?? new Date(0).toISOString(),
      };
    });
}

export async function loadPublicGardenImpactSnapshot(
  input: PublicGardenImpactLoadInput,
  deps: { readers: PublicGardenImpactReaders; now?: () => number; apiUrl?: string }
): Promise<PublicGardenImpactResponseV1> {
  const address = getAddress(input.gardenAddress) as Address;
  let garden: PublicGardenImpactGardenRecord | null;
  try {
    garden = await deps.readers.readGarden(input.chainId, address);
  } catch {
    throw new PublicGardenImpactProviderError();
  }
  if (
    !garden ||
    garden.id.toLowerCase() !== address.toLowerCase() ||
    !isGardenPubliclyVisible(garden)
  ) {
    throw new PublicGardenImpactNotFoundError();
  }

  const [works, approvals, actions, assessments, certificates] = await Promise.all([
    settle(() => deps.readers.readWorks(input.chainId, address), []),
    settle(() => deps.readers.readApprovals(input.chainId), []),
    settle(() => deps.readers.readActions(input.chainId), []),
    settle(() => deps.readers.readAssessments(input.chainId, address), []),
    settle(() => deps.readers.readCertificates(input.chainId, address), []),
  ]);
  if (!works.available && !assessments.available && !certificates.available) {
    throw new PublicGardenImpactProviderError();
  }

  const workRecords = dedupeNewest(works.data, (record) => record.createdAt);
  const workIds = new Set(workRecords.map((record) => record.id.toLowerCase()));
  const approvalRecords = dedupeNewest(approvals.data, (record) => record.createdAt);
  const approvedAt = buildApprovedAt(approvalRecords, workIds);
  const assessmentRecords = dedupeNewest(assessments.data, (record) => record.createdAt);
  const allCertificateRecords = dedupeNewest(certificates.data, (record) => record.updatedAt);
  const certificateRecords = allCertificateRecords.filter((record) => record.status !== "unknown");
  const actionRecords = dedupeNewest(actions.data, () => 0);
  const unavailableSources = (
    [
      ["works", works],
      ["approvals", approvals],
      ["actions", actions],
      ["assessments", assessments],
      ["certificates", certificates],
    ] as const
  )
    .filter(([, state]) => !state.available)
    .map(([source]) => source satisfies PublicGardenImpactSource);
  const impactTimes = [
    ...workRecords.map((record) => record.createdAt),
    ...approvalRecords
      .filter((record) => workIds.has(record.workUID.toLowerCase()))
      .map((record) => record.createdAt),
    ...assessmentRecords.map((record) => record.createdAt),
    ...allCertificateRecords.map((record) => record.updatedAt),
  ];
  const availableBreakdown = works.available
    ? buildBreakdown({
        chainId: input.chainId,
        works: workRecords,
        approvalsAvailable: approvals.available,
        approvedAt,
        actions: actions.available ? actionRecords : [],
      })
    : null;
  const breakdown = {
    byDomain: works.available && actions.available ? (availableBreakdown?.byDomain ?? null) : null,
    byAction: availableBreakdown?.byAction ?? null,
  };
  const recentLimit = Math.max(
    0,
    Math.min(PUBLIC_GARDEN_IMPACT_MAX_RECENT_LIMIT, Math.floor(input.recentLimit))
  );
  const isEmpty =
    unavailableSources.length === 0 &&
    workRecords.length === 0 &&
    assessmentRecords.length === 0 &&
    certificateRecords.length === 0;

  return {
    version: PUBLIC_GARDEN_IMPACT_VERSION,
    ok: true,
    garden: {
      chainId: input.chainId,
      address,
      name: garden.name,
      location: garden.location,
      url: new URL(
        buildPublicGardenImpactPath(input.chainId, address),
        deps.apiUrl ?? PUBLIC_GARDEN_IMPACT_API_URL
      ).toString(),
    },
    summary: {
      submittedWorkCount: works.available ? workRecords.length : null,
      approvedWorkCount: works.available && approvals.available ? approvedAt.size : null,
      assessmentCount: assessments.available ? assessmentRecords.length : null,
      impactCertificateCount: certificates.available ? certificateRecords.length : null,
      latestKnownActivityAt: latestIso(impactTimes),
    },
    breakdown,
    recentWork:
      works.available && approvals.available
        ? buildRecentWork({
            chainId: input.chainId,
            works: workRecords,
            approvedAt,
            actions: actions.available ? actionRecords : [],
            limit: recentLimit,
          })
        : null,
    provenance: {
      status: unavailableSources.length > 0 ? "partial" : isEmpty ? "empty" : "ready",
      partialData: unavailableSources.length > 0,
      unavailableSources,
      fetchedAt: new Date(deps.now?.() ?? Date.now()).toISOString(),
    },
  };
}
