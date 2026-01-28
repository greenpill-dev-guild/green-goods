import type { Address, Hex } from "viem";

// =============================================================================
// Domain enums
// =============================================================================

export type ActionDomain = "solar" | "waste" | "agroforestry" | "education" | "mutual_credit";

/** Canonical list of all action domains */
export const ACTION_DOMAINS: readonly ActionDomain[] = [
  "solar",
  "waste",
  "agroforestry",
  "education",
  "mutual_credit",
] as const;

export type ActionType =
  | "hub_session"
  | "workshop"
  | "node_deployment"
  | "cleanup"
  | "recycling"
  | "composting"
  | "planting"
  | "nursery"
  | "maintenance"
  | "training"
  | "certification"
  | "commitment"
  | "exchange";

export type CapitalType =
  | "living"
  | "social"
  | "material"
  | "financial"
  | "intellectual"
  | "experiential"
  | "spiritual"
  | "cultural";

// =============================================================================
// Metrics
// =============================================================================

export interface MetricValue {
  value: number;
  unit: string;
}

export interface PredefinedMetric {
  value: number;
  unit: string;
  aggregation: "sum" | "count" | "average" | "max";
  label: string;
}

export interface CustomMetric {
  value: number;
  unit: string;
  label: string;
}

export interface OutcomeMetrics {
  predefined: Record<string, PredefinedMetric>;
  custom: Record<string, CustomMetric>;
}

// =============================================================================
// Allowlist & Attestations
// =============================================================================

export interface AllowlistEntry {
  /** Ethereum address of the recipient */
  address: Address;
  /**
   * Token/ownership quantity for this recipient.
   * Represents the fraction units of the hypercert allocated to this address.
   * The total across all entries should equal TOTAL_UNITS (100_000_000n).
   * Base units are used for accounting with no decimal representation.
   */
  units: bigint;
  /** Optional display label for the recipient */
  label?: string;
}

export interface AttestationFilters {
  startDate?: Date | number | null;
  endDate?: Date | number | null;
  domain?: ActionDomain | string | null;
  workScope?: string | null;
  actionType?: ActionType | string | null;
  gardenerAddress?: Address | null;
  searchQuery?: string;
}

export interface AttestationRef {
  uid: Hex;
  title: string;
  domain?: ActionDomain;
}

export interface HypercertAttestation {
  /** Work approval UID (EAS) */
  id: string;
  /** Alias for id when using GraphQL node shapes */
  uid?: string;
  /** Work submission UID (EAS) */
  workUid: string;
  gardenId: string;
  title: string;
  actionType?: ActionType;
  domain?: ActionDomain;
  workScope: string[];
  gardenerAddress: Address;
  gardenerName?: string | null;
  mediaUrls: string[];
  metrics?: Record<string, MetricValue> | null;
  createdAt: number;
  approvedAt: number;
  approvedBy?: Address;
  feedback?: string | null;
}

// Alias to match spec naming for GraphQL work approval nodes
export type WorkApprovalNode = HypercertAttestation;

// =============================================================================
// Hypercert Metadata (Hypercerts standard + Green Goods extensions)
// =============================================================================

export interface ScopeDefinition {
  name: string;
  value: string[];
  excludes?: string[];
  display_value?: string;
}

export interface TimeframeDefinition {
  name: string;
  value: [number, number];
  display_value: string;
}

export interface PropertyDefinition {
  trait_type: string;
  value: string | number;
}

export interface GreenGoodsExtension {
  gardenId: string;
  attestationRefs: AttestationRef[];
  sdgs: number[];
  capitals: CapitalType[];
  outcomes: OutcomeMetrics;
  domain: ActionDomain;
  karmaGapProjectId?: string;
  protocolVersion: string;
}

export interface HypercertMetadata {
  name: string;
  description: string;
  image: string;
  external_url?: string;
  hypercert: {
    work_scope: ScopeDefinition;
    impact_scope: ScopeDefinition;
    work_timeframe: TimeframeDefinition;
    impact_timeframe: TimeframeDefinition;
    contributors: ScopeDefinition;
    rights: ScopeDefinition;
  };
  properties?: PropertyDefinition[];
  hidden_properties?: GreenGoodsExtension;
}

// =============================================================================
// Draft persistence
// =============================================================================

export interface HypercertDraft {
  id: string;
  gardenId: string;
  operatorAddress: Address;
  stepNumber: number;
  attestationIds: string[];
  title: string;
  description: string;
  workScopes: string[];
  impactScopes: string[];
  workTimeframeStart: number;
  workTimeframeEnd: number;
  impactTimeframeStart: number;
  impactTimeframeEnd: number | null;
  sdgs: number[];
  capitals: CapitalType[];
  outcomes: OutcomeMetrics;
  allowlist: AllowlistEntry[];
  externalUrl: string;
  createdAt: number;
  updatedAt: number;
}

// =============================================================================
// Hypercert records (indexer)
// =============================================================================

export type HypercertStatus = "active" | "claimed" | "sold" | "unknown";

export interface HypercertAllowlistClaim {
  id: string;
  claimant: Address;
  units: bigint;
  claimedAt: number;
  txHash: Hex;
}

export interface HypercertRecord {
  id: string;
  tokenId: bigint;
  gardenId: string;
  metadataUri: string;
  imageUri?: string;
  mintedAt: number;
  mintedBy: Address;
  txHash: Hex;
  totalUnits: bigint;
  claimedUnits: bigint;
  attestationCount: number;
  /** Full attestation data (optional, may require separate EAS fetch) */
  attestations?: HypercertAttestation[];
  /** EAS attestation UIDs bundled into this hypercert (from Envio) */
  attestationUIDs?: string[];
  title?: string | null;
  description?: string | null;
  workScopes?: string[] | null;
  status?: HypercertStatus;
  allowlistEntries?: HypercertAllowlistClaim[];
}
