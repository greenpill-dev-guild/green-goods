/**
 * Types for the machine-readable Green Goods ontology sidecar
 * (green-goods-ontology.json). The sidecar is the canonical, drift-gated
 * specification of entities, controlled vocabularies, EAS schemas,
 * constraints, and lifecycle state machines across every layer of the stack.
 *
 * Consumed today by scripts/quality/check-ontology.mjs (CI drift gate) and
 * the generated docs pages; typed here so later phases (read-seam validation,
 * agent domain validator) can import one canonical shape.
 */

/** Whether a term is accepted Green Goods language, independent of release maturity. */
export type OntologySemanticStatus = "canonical" | "proposed";

/** Whether a vocabulary, schema, constraint, or machine has an executable source. */
export type OntologySourceStatus = "implemented" | "specified";

export type OntologyImplementationStatus =
  | "implemented"
  | "partial"
  | "not-implemented"
  | "not-applicable";

export type OntologyDeploymentStatus = "deployed" | "not-deployed" | "not-applicable";
export type OntologyActivationStatus = "active" | "inactive" | "not-applicable";
export type OntologyIntegrationStatus =
  | "integrated"
  | "partial"
  | "not-integrated"
  | "not-applicable";
export type OntologyAvailability =
  | "available"
  | "deployed-not-available"
  | "in-build"
  | "planned"
  | "vision";

export type OntologyLayer = "solidity" | "indexer" | "shared" | "docs";

/**
 * Product surfaces a term is allowed to appear on. Mirrors the glossary's
 "Allowed surfaces" column, which the docs-glossary guard locks to the sidecar.
 * `community` is carried verbatim pending the community-surface-token known issue.
 */
export type OntologySurface = "admin" | "client" | "agent" | "community" | "public" | "docs";

export type VocabularyExtract =
  | "solidity-enum"
  | "graphql-enum"
  | "ts-numeric-enum"
  | "ts-string-enum"
  | "ts-union"
  | "ts-interface-keys"
  | "ts-object-keys"
  | "ts-object-values"
  | "ts-readonly-array"
  | "ts-property-union";

export interface OntologyAnchor {
  file: string;
  /** Stable source identifier checked when present. Prefer this over a line hint. */
  symbol?: string;
  /** Optional human line hint, e.g. "28-34" or "107,373". Never parsed. */
  lines?: string;
}

export interface OntologyPlannedAnchor {
  file: string;
  symbol: string;
}

export interface EntityLayerAnchors {
  solidity?: string[];
  indexer?: { file: string; type: string };
  shared?: string[];
  docs?: string;
}

export interface EntityRelationship {
  to: string;
  kind: string;
  note?: string;
}

export interface OntologyEntity {
  id: string;
  display: string;
  semantic_status: OntologySemanticStatus;
  definition: string;
  layers?: EntityLayerAnchors;
  spec_source?: string;
  indexer_note?: string;
  note?: string;
  relationships?: EntityRelationship[];
  surfaces: OntologySurface[];
}

export interface OntologyPersona {
  id: string;
  display: string;
  /** GardenRole hat this persona wears, lowercase id from GARDEN_ROLE_IDS. */
  hat: string;
  definition: string;
  surfaces: OntologySurface[];
}

export interface VocabularyCanonical {
  ordered: boolean;
  value_scheme: "index" | "explicit" | "none";
  members: string[];
  /**
   * Human label for a canonical member whose wire name differs from what people read.
   * Keyed by canonical member; every key must be a member of this vocabulary.
   */
  display_labels?: Record<string, string>;
  /** Why the wire name and the display label diverge. Required when display_labels is set. */
  display_labels_note?: string;
}

export interface VocabularyRepresentation {
  id: string;
  layer: OntologyLayer;
  file: string;
  symbol: string;
  extract: VocabularyExtract;
  /** Required for extract "ts-property-union": the containing interface. */
  property?: string;
  ordered: boolean;
  /** The expected (desired) member list for this layer — drift is file ≠ this. */
  members: string[];
  /** Expected numeric values for numeric-enum representations. */
  values?: number[];
  note?: string;
}

export interface VocabularyMapping {
  id: string;
  from: string;
  to: string;
  kind: "explicit" | "identity";
  total_from: boolean;
  bijective?: boolean;
  pairs?: Record<string, string>;
  unmapped_from?: string[];
  unmapped_to?: string[];
  code_anchor?: string | null;
  note?: string;
}

export interface OntologyVocabulary {
  id: string;
  source_status: OntologySourceStatus;
  definition: string;
  spec_source?: string;
  canonical: VocabularyCanonical;
  derived_members?: string[];
  planned_anchor?: OntologyPlannedAnchor;
  representations: VocabularyRepresentation[];
  mappings: VocabularyMapping[];
}

export interface OntologySchemaField {
  name: string;
  type: string;
}

export interface OntologySchema {
  source_status: OntologySourceStatus;
  source?: string;
  spec_source?: string;
  check?: "existence-only";
  /** Constant name holding the registration schema string (existence-only). */
  source_symbol?: string;
  name: string;
  /** Canonical entity this schema records. Absent when no entity covers it yet — see `note`. */
  entity?: string;
  revocable: boolean;
  resolver?: string | null;
  /** Planned resolver contract name for spec-only schemas whose source file does not exist yet. */
  planned_resolver?: string | null;
  note?: string;
  fields: OntologySchemaField[];
}

export type ConstraintKind =
  | "functional"
  | "disjoint"
  | "domain-range"
  | "closed-set"
  | "sum"
  | "non-transferable"
  | "existence";

export interface ConstraintHole {
  statement: string;
  anchors: OntologyAnchor[];
}

export interface OntologyConstraint {
  id: string;
  kind: ConstraintKind;
  source_status: OntologySourceStatus;
  spec_source?: string;
  planned_anchor?: OntologyPlannedAnchor;
  statement: string;
  enforced_at: OntologyAnchor[];
  holes: ConstraintHole[];
}

export interface StateMachineState {
  name: string;
  storage: "protocol" | "on-chain" | "off-chain" | "derived" | "client-derived";
}

export interface StateMachineTransition {
  from: string[];
  to: string[];
  layer: "on-chain" | "derived" | "off-chain";
  mechanism: string;
}

export interface OntologyStateMachine {
  id: string;
  source_status: OntologySourceStatus;
  kind: "executable" | "narrative";
  vocabulary: string;
  spec_source?: string;
  planned_anchor?: OntologyPlannedAnchor;
  enforced_at?: OntologyAnchor[];
  note?: string;
  states: StateMachineState[];
  transitions: StateMachineTransition[];
}

export interface IntegrationMatrixRow {
  /** entity:<id>, persona:<id>, schema:<key>, or concept:<free-form>. */
  ref: string;
  label: string;
  note?: string;
  cells: Record<string, string>;
}

export interface OntologyIntegrationMatrix {
  protocols: string[];
  rows: IntegrationMatrixRow[];
}

/**
 * A glossary Term Reference entry that is deliberately not a canonical entity or persona.
 * Declaring it here is what lets the docs-term-reference guard fail on an undeclared term.
 */
export interface OntologySupportingTerm {
  id: string;
  display: string;
  reason: string;
}

export interface OntologyPatternWatch {
  id: string;
  file: string;
  pattern: string;
  expect: "absent" | "present";
  note: string;
}

export interface OntologyKnownIssue {
  id: string;
  statement: string;
  anchors: string[];
}

export interface OntologyEvidence {
  file: string;
  note: string;
}

export interface OntologyCapability {
  ref: `entity:${string}`;
  implementation: OntologyImplementationStatus;
  deployment: OntologyDeploymentStatus;
  activation: OntologyActivationStatus;
  integration: OntologyIntegrationStatus;
  availability: OntologyAvailability;
  evidence: OntologyEvidence[];
  verified_at: string;
  note?: string;
  chains?: Readonly<Record<string, OntologyChainCapability>>;
}

export type OntologyChainCapability = Pick<
  OntologyCapability,
  "deployment" | "activation" | "integration" | "availability" | "evidence" | "verified_at"
> & { note?: string };

export interface OntologyHumanConceptSource {
  ref: `entity:${string}` | `persona:${string}`;
  plain_name: string;
  why_it_matters: string;
  who_touches_it: string[];
  example: string;
  aliases: string[];
  not_confused_with: string[];
}

export interface OntologyMarketingClaim {
  id: string;
  claim: string;
  audience: string[];
  maturity: OntologyAvailability;
  term_refs: Array<`entity:${string}` | `persona:${string}`>;
  evidence: OntologyEvidence[];
  safe_wording: string;
  verified_at: string;
}

export interface GreenGoodsOntologyProjections {
  version: number;
  capabilities: OntologyCapability[];
  human_concepts: OntologyHumanConceptSource[];
  marketing_claims: OntologyMarketingClaim[];
}

export interface AgentOntologyClaim {
  id: string;
  maturity: OntologyAvailability;
  safe_wording: string;
  verified_at: string;
}

export interface AgentOntologyTerm {
  ref: `entity:${string}` | `persona:${string}`;
  id: string;
  kind: "entity" | "persona";
  canonical: string;
  definition: string;
  semantic_status: OntologySemanticStatus;
  surfaces: OntologySurface[];
  aliases: string[];
  relationships: EntityRelationship[];
  maturity: OntologyCapability | null;
  safe_claims: AgentOntologyClaim[];
}

export interface AgentOntologyManifest {
  version: number;
  verified_at: string;
  terms: AgentOntologyTerm[];
}

export interface GreenGoodsOntology {
  version: number;
  description: string;
  meta: {
    last_verified: string;
    excluded_from_v1: string[];
  };
  consumers: Array<{ path: string; reads: string }>;
  entities: OntologyEntity[];
  personas: OntologyPersona[];
  personas_note: string;
  supporting_terms_note: string;
  supporting_terms: OntologySupportingTerm[];
  vocabularies: OntologyVocabulary[];
  schemas: Record<string, OntologySchema>;
  constraints: OntologyConstraint[];
  state_machines: OntologyStateMachine[];
  integration_matrix: OntologyIntegrationMatrix;
  pattern_watches: OntologyPatternWatch[];
  known_issues: OntologyKnownIssue[];
}
