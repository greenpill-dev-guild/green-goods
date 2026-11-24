import type { Address } from "./funding-types";
import type { ActionDomain } from "../types/hypercerts";
import { ALL_DOMAINS, DOMAIN_ACTION_DOMAIN } from "../utils/domain";

export const PUBLIC_GARDEN_IMPACT_VERSION = 1 as const;
export const PUBLIC_GARDEN_IMPACT_DEFAULT_RECENT_LIMIT = 3;
export const PUBLIC_GARDEN_IMPACT_MAX_RECENT_LIMIT = 12;
export const PUBLIC_GARDEN_IMPACT_DOMAINS: readonly ActionDomain[] = ALL_DOMAINS.map(
  (domain) => DOMAIN_ACTION_DOMAIN[domain]
);

export type PublicGardenImpactDomain = ActionDomain;
export type PublicGardenImpactSource =
  | "works"
  | "approvals"
  | "actions"
  | "assessments"
  | "certificates";

export type PublicGardenImpactCount = number | null;

export interface PublicGardenImpactDomainBreakdown {
  domain: PublicGardenImpactDomain;
  submittedWorkCount: number;
  approvedWorkCount: PublicGardenImpactCount;
}

export interface PublicGardenImpactActionBreakdown {
  actionUid: number;
  actionId: string;
  title: string | null;
  domain: PublicGardenImpactDomain | null;
  submittedWorkCount: number;
  approvedWorkCount: PublicGardenImpactCount;
}

export interface PublicGardenImpactRecentWork {
  id: string;
  title: string;
  description: string | null;
  media: string[];
  actionUid: number;
  action: {
    id: string;
    title: string | null;
    domain: PublicGardenImpactDomain | null;
  } | null;
  createdAt: string;
  approvedAt: string;
}

export interface PublicGardenImpactResponseV1 {
  version: typeof PUBLIC_GARDEN_IMPACT_VERSION;
  ok: true;
  garden: {
    chainId: number;
    address: Address;
    name: string | null;
    location: string | null;
    url: string;
  };
  summary: {
    submittedWorkCount: PublicGardenImpactCount;
    approvedWorkCount: PublicGardenImpactCount;
    assessmentCount: PublicGardenImpactCount;
    impactCertificateCount: PublicGardenImpactCount;
    latestKnownActivityAt: string | null;
  };
  breakdown: {
    byDomain: PublicGardenImpactDomainBreakdown[] | null;
    byAction: PublicGardenImpactActionBreakdown[] | null;
  };
  recentWork: PublicGardenImpactRecentWork[] | null;
  provenance: {
    status: "ready" | "empty" | "partial";
    partialData: boolean;
    unavailableSources: PublicGardenImpactSource[];
    fetchedAt: string;
    /** A retained complete snapshot; fetchedAt remains the original observation time. */
    stale?: boolean;
    refreshFailedAt?: string;
  };
}
