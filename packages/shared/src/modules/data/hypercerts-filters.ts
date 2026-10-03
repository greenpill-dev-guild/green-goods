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

const SECONDS_PER_DAY = 86_400;

/** The UTC calendar day an instant falls on, counted in days since the epoch. */
function utcDayOf(seconds: number): number {
  return Math.floor(seconds / SECONDS_PER_DAY);
}

/**
 * Narrows work attestations to the ones an assessment covers: created within
 * its reporting period and, when the work names a domain, in its domain.
 *
 * A reporting period names whole days. Create Assessment stores each end as
 * UTC midnight of the day the author picked, so the stored end is the first
 * instant of the period's last day. Work belongs to the period from its first
 * UTC day through the whole of its last.
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
    const createdOn = utcDayOf(attestation.createdAt);
    if (start && createdOn < utcDayOf(start)) return false;
    if (end && createdOn > utcDayOf(end)) return false;

    // Filter by domain
    if (actionDomain && attestation.domain && attestation.domain !== actionDomain) {
      return false;
    }

    return true;
  });
}
