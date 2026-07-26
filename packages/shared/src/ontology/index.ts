/**
 * Typed accessor for the canonical Green Goods ontology sidecar.
 *
 * Internal for now — not exported from the package root or any public
 * subpath. Later phases (read-seam validation, the agent domain validator)
 * import from here; scripts read green-goods-ontology.json directly.
 */

import ontologyJson from "./green-goods-ontology.json";
import type { GreenGoodsOntology } from "./types";

export type * from "./types";

const ontology = ontologyJson as unknown as GreenGoodsOntology;

/** The canonical, drift-gated Green Goods ontology. */
export function getOntology(): GreenGoodsOntology {
  return ontology;
}
