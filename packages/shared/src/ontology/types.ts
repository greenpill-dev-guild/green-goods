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

export type OntologyStatus = "live" | "spec";

export type OntologyLayer = "solidity" | "indexer" | "shared" | "docs";

export type VocabularyExtract =
  | "solidity-enum"
  | "graphql-enum"
  | "ts-numeric-enum"
  | "ts-union"
  | "ts-interface-keys"
  | "ts-object-keys"
  | "ts-object-values"
  | "ts-readonly-array"
  | "ts-property-union";

export interface OntologyAnchor {
  file: string;
  /** Optional human line hint, e.g. "28-34" or "107,373". Never parsed. */
  lines?: string;
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
  status: OntologyStatus;
  definition: string;
  layers?: EntityLayerAnchors;
  spec_source?: string;
  indexer_note?: string;
  note?: string;
  relationships?: EntityRelationship[];
}

export interface OntologyPersona {
  id: string;
  display: string;
  /** GardenRole hat this persona wears, lowercase id from GARDEN_ROLE_IDS. */
  hat: string;
  definition: string;
}

export interface VocabularyCanonical {
  ordered: boolean;
  value_scheme: "index" | "explicit" | "none";
  members: string[];
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
  status: OntologyStatus;
  definition: string;
  spec_source?: string;
  canonical: VocabularyCanonical;
  derived_members?: string[];
  planned_anchor?: { file: string; symbol: string };
  representations: VocabularyRepresentation[];
  mappings: VocabularyMapping[];
}

export interface OntologySchemaField {
  name: string;
  type: string;
}

export interface OntologySchema {
  status: OntologyStatus;
  source?: string;
  spec_source?: string;
  check?: "existence-only";
  /** Constant name holding the registration schema string (existence-only). */
  source_symbol?: string;
  name: string;
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
  status: OntologyStatus;
  statement: string;
  enforced_at: OntologyAnchor[];
  holes: ConstraintHole[];
}

export interface StateMachineState {
  name: string;
  storage: "protocol" | "on-chain" | "off-chain" | "derived" | "client-derived";
}

export interface StateMachineTransition {
  from: string;
  to: string;
  layer: "on-chain" | "derived" | "off-chain";
  mechanism: string;
}

export interface OntologyStateMachine {
  id: string;
  status: OntologyStatus;
  vocabulary: string;
  spec_source?: string;
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

export type CapabilityState = "complete" | "partial" | "blocked" | "not_started" | "not_applicable";

export interface CapabilityEvidence {
  file: string;
  /** Dot path into a JSON evidence file; the drift gate fails if it no longer resolves. */
  json_path?: string;
  note?: string;
}

export interface CapabilityDimension {
  state: CapabilityState;
  evidence: CapabilityEvidence[];
  note?: string;
  verified_at: string;
}

/** The maturity story of one entity — five dimensions, each evidence-backed. */
export interface EntityCapability {
  entity: string;
  dimensions: {
    implementation: CapabilityDimension;
    deployment: CapabilityDimension;
    activation: CapabilityDimension;
    indexing: CapabilityDimension;
    availability: CapabilityDimension;
  };
}

export interface ConceptCardConfusion {
  ref: string;
  reason: string;
}

/** Human explainer for one entity; rendered into concepts.generated.mdx. */
export interface ConceptCard {
  entity: string;
  plain_name: string;
  why_it_matters: string;
  example: string;
  aliases: string[];
  not_confused_with: ConceptCardConfusion[];
  safe_claim: string;
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
  vocabularies: OntologyVocabulary[];
  schemas: Record<string, OntologySchema>;
  constraints: OntologyConstraint[];
  state_machines: OntologyStateMachine[];
  integration_matrix: OntologyIntegrationMatrix;
  pattern_watches: OntologyPatternWatch[];
  known_issues: OntologyKnownIssue[];
  capabilities: EntityCapability[];
  concept_cards: ConceptCard[];
}
