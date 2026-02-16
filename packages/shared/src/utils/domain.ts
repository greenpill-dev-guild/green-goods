import { Domain } from "../types/domain";

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
