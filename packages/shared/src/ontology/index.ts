/**
 * Typed accessor for the canonical Green Goods ontology sidecar.
 *
 * The full semantic sidecar remains internal. Public consumers should use the
 * compact read-only query seam in query.ts, which loads only the generated
 * agent manifest.
 */

import ontologyJson from "./green-goods-ontology.json";
import type { GreenGoodsOntology } from "./types";

export type * from "./types";

// PRD-745: Decline a `satisfies` check on this imported JSON: TypeScript widens its
// strings, so it cannot check the literal unions without generated literal typings.
// Keep this cast internal; CI checks the declared runtime invariants independently.
// Generating and maintaining a complete schema/type source remains separate work.
const ontology = ontologyJson as unknown as GreenGoodsOntology;

/** The canonical, drift-gated Green Goods ontology. */
export function getOntology(): GreenGoodsOntology {
  return ontology;
}

export * from "./query";
