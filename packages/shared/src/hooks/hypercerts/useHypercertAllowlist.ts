import { useEffect } from "react";
import {
  type ContributorWeight,
  calculateDistribution,
  type DistributionMode,
} from "../../lib/hypercerts";
import type { AllowlistEntry } from "../../types/hypercerts";

interface UseHypercertAllowlistParams {
  allowlist: AllowlistEntry[];
  contributorWeights: ContributorWeight[];
  distributionMode: DistributionMode;
  hasSelectedAttestations: boolean;
  onAllowlistChange: (allowlist: AllowlistEntry[]) => void;
}

/**
 * Keeps allowlist distribution in sync with selected contributors and distribution mode.
 */
export function useHypercertAllowlist({
  allowlist,
  contributorWeights,
  distributionMode,
  hasSelectedAttestations,
  onAllowlistChange,
}: UseHypercertAllowlistParams): void {
  useEffect(() => {
    if (!hasSelectedAttestations) return;
    if (distributionMode === "custom" && allowlist.length > 0) return;

    const mode = distributionMode === "proportional" ? "count" : distributionMode;
    const nextAllowlist = calculateDistribution(contributorWeights, mode, allowlist);

    // Deep compare to avoid infinite loops - only update if contents differ
    const isDifferent =
      nextAllowlist.length !== allowlist.length ||
      nextAllowlist.some(
        (entry, index) =>
          entry.address !== allowlist[index]?.address || entry.units !== allowlist[index]?.units
      );

    if (isDifferent) {
      onAllowlistChange(nextAllowlist);
    }
  }, [allowlist, contributorWeights, distributionMode, hasSelectedAttestations, onAllowlistChange]);
}
