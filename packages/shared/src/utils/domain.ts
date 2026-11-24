import { DOMAIN_TOKEN_SLUG, Domain, type DomainTokenSlug } from "../types/domain";
import type { ActionDomain } from "../types/hypercerts";

export const ALL_DOMAINS = Object.values(Domain).filter(
  (value): value is Domain => typeof value === "number"
);

/** Immutable on-chain action slug prefixes. */
export const DOMAIN_SLUG_PREFIX: Record<Domain, string> = {
  [Domain.SOLAR]: "solar",
  [Domain.AGRO]: "agro",
  [Domain.EDU]: "edu",
  [Domain.WASTE]: "waste",
};

/** Published hypercert and public garden-impact API words. */
export const DOMAIN_ACTION_DOMAIN: Record<Domain, ActionDomain> = {
  [Domain.SOLAR]: "solar",
  [Domain.AGRO]: "agroforestry",
  [Domain.EDU]: "education",
  [Domain.WASTE]: "waste",
};

const DOMAIN_NAMES: Record<DomainTokenSlug, string> = {
  solar: "Solar",
  agro: "Agroforestry",
  education: "Education",
  waste: "Waste",
};

export const DOMAIN_LABELS = Object.fromEntries(
  ALL_DOMAINS.map((domain) => [
    domain,
    {
      id: `app.domain.tab.${DOMAIN_TOKEN_SLUG[domain]}`,
      defaultMessage: DOMAIN_NAMES[DOMAIN_TOKEN_SLUG[domain]],
      assessmentLabelId: `app.admin.assessment.domainAction.domain.${DOMAIN_ACTION_DOMAIN[domain]}`,
      gardenLabelId: `app.garden.create.domain.${DOMAIN_SLUG_PREFIX[domain]}`,
    },
  ])
) as Record<
  Domain,
  {
    id: string;
    defaultMessage: string;
    assessmentLabelId: string;
    gardenLabelId: string;
  }
>;

/** Display boundaries accept numeric enums or token spellings, never coerce an unknown to a domain. */
export function resolveDisplayDomain(value: number | string | null | undefined): Domain | null {
  return (
    ALL_DOMAINS.find((domain) =>
      typeof value === "string"
        ? DOMAIN_TOKEN_SLUG[domain] === value.toLowerCase()
        : domain === value
    ) ?? null
  );
}

/**
 * Expand a uint8 domain bitmask into an array of Domain enum values.
 * Bit mapping: bit 0 = SOLAR, bit 1 = AGRO, bit 2 = EDU, bit 3 = WASTE
 *
 * @param mask - The bitmask to expand (0-15)
 * @returns Array of Domain enum values present in the mask
 */
export function expandDomainMask(mask: number): Domain[] {
  const domains: Domain[] = [];
  if (mask & 1) domains.push(Domain.SOLAR);
  if (mask & 2) domains.push(Domain.AGRO);
  if (mask & 4) domains.push(Domain.EDU);
  if (mask & 8) domains.push(Domain.WASTE);
  return domains;
}

/** The uint8 bitmask `setGardenDomains` takes for these domains; `expandDomainMask` reverses it. */
export function domainMaskOf(domains: readonly Domain[]): number {
  return domains.reduce((mask, domain) => mask | (1 << domain), 0);
}

/**
 * Check if a bitmask includes a specific domain.
 *
 * @param mask - The bitmask to check
 * @param domain - The Domain enum value to test for
 * @returns True if the domain bit is set in the mask
 */
export function hasDomain(mask: number, domain: Domain): boolean {
  return (mask & (1 << domain)) !== 0;
}
