import type { ReactNode } from "react";
import { AdminCard } from "@/components/AdminCard";
import type { FlowSendStatus } from "@/components/Layout/FlowSendFooter";
import { FlowStatusRow } from "@/components/Layout/FlowStatusRow";
import type { CampaignCookieJarCreateFormProps } from "./CampaignCookieJarCreateForm.types";
import { ReviewLine } from "./ReviewLine";

export interface CampaignCreateReviewProps extends CampaignCookieJarCreateFormProps {
  /** Where the send stands, in the one row that changes while it works. */
  status: FlowSendStatus;
  /** What the send made, once it landed: the jar, or the transaction awaiting its address. */
  outcome?: ReactNode;
}

/**
 * The Review step: what the jar pays, who can claim, and where its page lives,
 * under one status row that keeps its height through ready, sending, sent and
 * failed (DL-072, DL-080). The flow's footer carries Create Cookie Jar, then
 * Done once the jar exists.
 */
export function CampaignCreateReview({ status, outcome, ...props }: CampaignCreateReviewProps) {
  const { formatMessage, payoutLabel, aggregation, publicCampaignUrl } = props;
  return (
    <div className="space-y-4">
      <FlowStatusRow
        tone={status.tone}
        busy={status.busy}
        title={status.title}
        description={status.description}
      />
      {outcome}
      <AdminCard variant="outlined" className="space-y-2">
        <ReviewLine
          label={formatMessage({
            id: "cockpit.community.cookies.reviewPayout",
            defaultMessage: "Payout",
          })}
          value={payoutLabel}
        />
        <ReviewLine
          label={formatMessage({
            id: "cockpit.community.cookies.selectedGardens",
            defaultMessage: "Selected gardens",
          })}
          value={aggregation.sources.length}
        />
        <ReviewLine
          label={formatMessage({
            id: "cockpit.community.cookies.generatedStewards",
            defaultMessage: "Stewards who can claim",
          })}
          value={aggregation.allowlist.length}
        />
        <ReviewLine
          label={formatMessage({
            id: "cockpit.community.cookies.missingStewards",
            defaultMessage: "Gardens without a steward",
          })}
          value={aggregation.missingStewardGardens.length}
        />
        <ReviewLine
          label={formatMessage({
            id: "cockpit.community.cookies.generatedCampaignLink",
            defaultMessage: "Campaign page",
          })}
          value={publicCampaignUrl}
        />
      </AdminCard>
    </div>
  );
}
