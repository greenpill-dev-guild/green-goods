// Compact, read-only semantic query seam for agents and app code.
// Backed by the generated ontology-manifest.generated.json (regenerate with
// `bun run ontology:generate`; drift-gated by check-ontology), so importing
// this subpath never pulls the full 100KB+ sidecar. Dependency-light on
// purpose: no frameworks, no package-root imports.

import manifestJson from "./ontology-manifest.generated.json";
import type { CapabilityState } from "./types";

export interface ManifestTerm {
  id: string;
  kind: "entity";
  display: string;
  plain_name: string;
  definition: string;
  aliases: string[];
  not_confused_with: string[];
  relationships: Array<{ to: string; kind: string }>;
  maturity: Record<
    "implementation" | "deployment" | "activation" | "indexing" | "availability",
    CapabilityState
  > | null;
  safe_claim: string | null;
  evidence: string[];
  verified_at: string;
}

export interface ManifestPersona {
  id: string;
  kind: "persona";
  display: string;
  hat: string;
  definition: string;
}

export interface ManifestClaim {
  id: string;
  claim: string;
  maturity: string;
  safe_wording: string;
}

export interface OntologyManifest {
  version: number;
  description: string;
  generated_from: string;
  last_verified: string;
  terms: ManifestTerm[];
  personas: ManifestPersona[];
  vocabularies: Array<{ id: string; members: string[] }>;
  claims: ManifestClaim[];
}

const manifest = manifestJson as unknown as OntologyManifest;

/** The full generated manifest (terms, personas, vocabularies, claims). */
export function getOntologyManifest(): OntologyManifest {
  return manifest;
}

/**
 * Look a term up by entity id, display name, plain name, or alias
 * (case-insensitive). Personas resolve by id or display.
 */
export function lookupTerm(query: string): ManifestTerm | ManifestPersona | null {
  const needle = query.trim().toLowerCase();
  if (!needle) return null;
  for (const term of manifest.terms) {
    if (
      term.id === needle ||
      term.display.toLowerCase() === needle ||
      term.plain_name.toLowerCase() === needle ||
      term.aliases.some((alias) => alias.toLowerCase() === needle)
    ) {
      return term;
    }
  }
  for (const persona of manifest.personas) {
    if (persona.id === needle || persona.display.toLowerCase() === needle) return persona;
  }
  return null;
}

/** Related entity ids for a term (declared relationships, both directions). */
export function relatedTerms(entityId: string): Array<{ to: string; kind: string }> {
  const direct = manifest.terms.find((t) => t.id === entityId)?.relationships ?? [];
  const inbound = manifest.terms
    .filter((t) => t.relationships.some((r) => r.to === entityId))
    .map((t) => ({ to: t.id, kind: "referenced-by" as const }));
  return [...direct, ...inbound];
}

/** Five-dimension maturity for an entity, or null for concept-only terms. */
export function maturityOf(entityId: string): ManifestTerm["maturity"] {
  return manifest.terms.find((t) => t.id === entityId)?.maturity ?? null;
}

/**
 * The vetted public sentence for a term. Prefer this over improvising copy —
 * it is drift-gated against deployment evidence.
 */
export function safeClaim(entityId: string): string | null {
  return manifest.terms.find((t) => t.id === entityId)?.safe_claim ?? null;
}

/** Evidence pointers (repo paths, optionally with #json_path) behind a term's maturity. */
export function evidenceFor(entityId: string): string[] {
  return manifest.terms.find((t) => t.id === entityId)?.evidence ?? [];
}
