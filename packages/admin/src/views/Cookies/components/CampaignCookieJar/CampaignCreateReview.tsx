import { AdminCard } from "@/components/AdminCard";
import type { CampaignCookieJarCreateFormProps } from "./CampaignCookieJarCreateForm.types";
import { ReviewLine } from "./ReviewLine";

/**
 * The Review step: what the jar pays, who can claim, and where its page lives.
 * The flow's footer carries Create Cookie Jar.
 */
export function CampaignCreateReview(props: CampaignCookieJarCreateFormProps) {
  const { formatMessage, payoutLabel, aggregation, publicCampaignUrl, createError } = props;
  return (
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
      {createError ? (
        <p className="text-body-sm text-error-dark" role="alert">
          {createError.message}
        </p>
      ) : null}
    </AdminCard>
  );
}
