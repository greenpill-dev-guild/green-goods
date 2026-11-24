import { Alert } from "@green-goods/shared/components/Alert";
import type { Address, Garden } from "@green-goods/shared/types/domain";
import { compareAddresses } from "@green-goods/shared/utils/blockchain/address";
import { RiUserAddLine } from "@remixicon/react";
import { useIntl } from "react-intl";

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

/**
 * A garden's only reviewer on their own pending work: nobody else may decide it, so the page
 * says so and what to do, instead of offering acts the chain would refuse (PRD-1472).
 */
export function SoleReviewerNotice() {
  const { formatMessage } = useIntl();
  return (
    <Alert
      variant="info"
      layout="stacked"
      icon={<RiUserAddLine className="h-5 w-5 flex-shrink-0" aria-hidden="true" />}
      title={formatMessage({ id: "app.work.detail.soleReviewer.title" })}
    >
      <p data-component="SoleReviewerNotice">
        {formatMessage({ id: "app.work.detail.soleReviewer.body" })}
      </p>
    </Alert>
  );
}
