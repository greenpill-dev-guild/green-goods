import { useMemo } from "react";
import { buildContributorWeights, type ContributorWeight } from "../../lib/hypercerts";
import type { HypercertAttestation } from "../../types/hypercerts";

/**
 * Derives contributor weights from selected attestations for distribution calculations.
 */
export function useHypercertContributorWeights(
  selectedAttestations: HypercertAttestation[]
): ContributorWeight[] {
  return useMemo(() => buildContributorWeights(selectedAttestations), [selectedAttestations]);
}
