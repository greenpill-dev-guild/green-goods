import { Domain, type GardenAssessment } from "../../types/domain";
import type { EASGardenAssessment } from "../../types/eas-responses";
import {
  type ActionDomain,
  type AttestationFilters,
  type HypercertAttestation,
} from "../../types/hypercerts";

/**
 * Maps numeric Domain enum values to ActionDomain strings used in hypercert attestations.
 */
const DOMAIN_TO_ACTION_DOMAIN: Record<number, ActionDomain> = {
  [Domain.SOLAR]: "solar",
  [Domain.AGRO]: "agroforestry",
  [Domain.EDU]: "education",
  [Domain.WASTE]: "waste",
};

/**
 * Converts a numeric Domain enum to its ActionDomain string equivalent.
 */
export function domainToActionDomain(domain: Domain): ActionDomain | undefined {
  return DOMAIN_TO_ACTION_DOMAIN[domain];
}

export function applyAttestationFilters(
  items: HypercertAttestation[],
  filters?: AttestationFilters
): HypercertAttestation[] {
  if (!filters) return items;

  return items.filter((attestation) => {
    const startDate =
      filters.startDate instanceof Date
        ? Math.floor(filters.startDate.getTime() / 1000)
        : (filters.startDate ?? null);
    const endDate =
      filters.endDate instanceof Date
        ? Math.floor(filters.endDate.getTime() / 1000)
        : (filters.endDate ?? null);

    if (startDate && attestation.approvedAt < startDate) return false;
    if (endDate && attestation.approvedAt > endDate) return false;

    if (filters.domain && attestation.domain !== filters.domain) {
      return false;
    }

    if (filters.actionType && attestation.actionType !== filters.actionType) {
      return false;
    }

    if (filters.workScope) {
      const scopes = attestation.workScope ?? [];
      if (!scopes.includes(filters.workScope)) return false;
    }

    if (filters.gardenerAddress) {
      const address = attestation.gardenerAddress.toLowerCase();
      if (address !== filters.gardenerAddress.toLowerCase()) return false;
    }

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const haystack = [
        attestation.title,
        attestation.gardenerName ?? "",
        attestation.gardenerAddress,
        attestation.domain ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });
}

/**
 * Filters attestations based on a GardenAssessment's parameters.
 * Applies the assessment's reportingPeriod, domain, and selectedActionUIDs
 * as filters to narrow down which work attestations are relevant for hypercert minting.
 */
export function filterAttestationsByAssessment(
  attestations: HypercertAttestation[],
  assessment: GardenAssessment | EASGardenAssessment
): HypercertAttestation[] {
  const actionDomain = domainToActionDomain(assessment.domain);
  const { start, end } =
    "reportingPeriod" in assessment
      ? assessment.reportingPeriod
      : { start: assessment.startDate, end: assessment.endDate };

  return attestations.filter((attestation) => {
    // Filter by reporting period (work must fall within the assessment window)
    if (start && attestation.createdAt < start) return false;
    if (end && attestation.createdAt > end) return false;

    // Filter by domain
    if (actionDomain && attestation.domain && attestation.domain !== actionDomain) {
      return false;
    }

    return true;
  });
}
