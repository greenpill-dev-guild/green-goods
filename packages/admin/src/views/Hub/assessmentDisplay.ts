import { DOMAIN_CONFIG } from "@green-goods/shared/config/domain";
import type { Domain } from "@green-goods/shared/types/domain";

/**
 * The label id of the domain an assessment's attestation names, or null when
 * the value names no domain the cockpit knows.
 */
export function assessmentDomainLabelId(domain: number | null | undefined): string | null {
  if (domain === null || domain === undefined) return null;
  return DOMAIN_CONFIG[domain as Domain]?.labelId ?? null;
}
