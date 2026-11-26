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
 * A steward's own pending work: the chain never takes their decision on it (`SelfAttestation`),
 * so the page offers no Approve or Reject and says who decides it instead. With another steward
 * or an owner, it reads as the Hub's notice does (PRD-1617); where nobody else may review, it says
 * what to do (PRD-1472).
 */
export function OwnWorkReviewNotice({ soleReviewer }: { soleReviewer: boolean }) {
  const { formatMessage } = useIntl();
  return (
    <Alert
      variant="info"
      layout="stacked"
      icon={<RiUserAddLine className="h-5 w-5 flex-shrink-0" aria-hidden="true" />}
      title={formatMessage({
        id: soleReviewer
          ? "app.work.detail.soleReviewer.title"
          : "app.work.detail.reviewBlocked.selfReviewTitle",
      })}
    >
      <p data-component="OwnWorkReviewNotice" data-sole-reviewer={soleReviewer || undefined}>
        {formatMessage({
          id: soleReviewer
            ? "app.work.detail.soleReviewer.body"
            : "app.work.detail.reviewBlocked.selfReviewMessage",
        })}
      </p>
    </Alert>
  );
}
