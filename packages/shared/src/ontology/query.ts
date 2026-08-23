/** Compact, read-only ontology seam for agents and application consumers. */

import manifestJson from "./agent-manifest.generated.json";
import type {
  AgentOntologyClaim,
  AgentOntologyManifest,
  AgentOntologyTerm,
  EntityRelationship,
  OntologyCapability,
  OntologyChainCapability,
  OntologySurface,
} from "./types";

const manifest = manifestJson as unknown as AgentOntologyManifest;

const termByLookup = new Map<string, AgentOntologyTerm>();
for (const term of manifest.terms) {
  for (const lookup of [term.ref, term.id, term.canonical, ...term.aliases]) {
    termByLookup.set(lookup.trim().toLowerCase(), term);
  }
}

/** Resolve a canonical id, typed ref, display name, or declared alias. */
export function getOntologyTerm(query: string): AgentOntologyTerm | undefined {
  return termByLookup.get(query.trim().toLowerCase());
}

export function getOntologyRelationships(query: string): readonly EntityRelationship[] {
  return getOntologyTerm(query)?.relationships ?? [];
}

/** Product surfaces this term may appear on. Empty when the term is unknown. */
export function getOntologySurfaces(query: string): readonly OntologySurface[] {
  return getOntologyTerm(query)?.surfaces ?? [];
}

export function getOntologyMaturity(query: string): OntologyCapability | null | undefined {
  return getOntologyTerm(query)?.maturity;
}

export function getOntologyChainMaturity(
  query: string,
  chainId: number
): OntologyChainCapability | undefined {
  return getOntologyMaturity(query)?.chains?.[String(chainId)];
}

export function getOntologySafeClaims(query: string): readonly AgentOntologyClaim[] {
  return getOntologyTerm(query)?.safe_claims ?? [];
}

export function listOntologyTerms(): readonly AgentOntologyTerm[] {
  return manifest.terms;
}

export function getOntologyManifestVersion(): Pick<
  AgentOntologyManifest,
  "version" | "verified_at"
> {
  return { version: manifest.version, verified_at: manifest.verified_at };
}
