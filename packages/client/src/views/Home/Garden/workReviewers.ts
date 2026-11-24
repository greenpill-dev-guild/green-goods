import type { Address, Garden } from "@green-goods/shared/types/domain";
import { compareAddresses } from "@green-goods/shared/utils/blockchain/address";

/**
 * Whether anyone in the garden but the work's submitter may review it. The work-approval
 * contract takes a decision only from a garden operator, which the garden reads as a steward
 * or an owner (`isOperator`), and never from the person who submitted the work
 * (`SelfAttestation`), so a sole reviewer's own work can never be decided.
 */
export function hasOtherWorkReviewer(
  garden: Pick<Garden, "stewards" | "owners">,
  submitter: Address | string
): boolean {
  return [...(garden.stewards ?? []), ...(garden.owners ?? [])].some(
    (reviewer) => !compareAddresses(reviewer, submitter)
  );
}
