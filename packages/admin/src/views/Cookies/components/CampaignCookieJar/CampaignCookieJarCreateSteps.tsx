import type { ReactNode } from "react";
import type { IntlShape } from "react-intl";
import { AdminCard } from "@/components/AdminCard";
import type { ActionFlowStep } from "@/components/Layout/ActionFlowStepper";
import type { FlowSendStatus } from "@/components/Layout/FlowSendFooter";
import { FlowStepHeader } from "@/components/Layout/FlowStepHeader";
import { CampaignAdvancedSection } from "./CampaignAdvancedSection";
import type { CampaignCookieJarCreateFormProps } from "./CampaignCookieJarCreateForm.types";
import { CampaignCreateReview } from "./CampaignCreateReview";
import { CampaignDetailsSection } from "./CampaignDetailsSection";
import { CampaignGardenSection } from "./CampaignGardenSection";
import { CampaignPayoutSection } from "./CampaignPayoutSection";

/** The Create Cookie Jar flow's steps; Advanced is a detour on Review. */
export function campaignCreateSteps(formatMessage: IntlShape["formatMessage"]): ActionFlowStep[] {
  return [
    {
      id: "campaign",
      title: formatMessage({
        id: "cockpit.community.cookies.createCampaignSection",
        defaultMessage: "Campaign",
      }),
      description: formatMessage({
        id: "cockpit.community.cookies.createStep.campaignHint",
        defaultMessage: "Name, story, and image",
      }),
    },
    {
      id: "payout",
      title: formatMessage({
        id: "cockpit.community.cookies.createPayoutSection",
        defaultMessage: "Payout",
      }),
      description: formatMessage({
        id: "cockpit.community.cookies.createStep.payoutHint",
        defaultMessage: "What each steward can claim",
      }),
    },
    {
      id: "gardens",
      title: formatMessage({
        id: "cockpit.community.cookies.createGardensSection",
        defaultMessage: "Eligible gardens",
      }),
      description: formatMessage({
        id: "cockpit.community.cookies.createStep.gardensHint",
        defaultMessage: "Whose stewards can claim",
      }),
    },
    {
      id: "review",
      title: formatMessage({ id: "cockpit.community.cookies.review", defaultMessage: "Review" }),
      description: formatMessage({
        id: "cockpit.community.cookies.createStep.reviewHint",
        defaultMessage: "Check it, then create",
      }),
    },
  ];
}

function CampaignCreateNotices({ form }: { form: CampaignCookieJarCreateFormProps }) {
  const { formatMessage, moduleConfigured, isDeployer, roleLoading } = form;
  if (moduleConfigured && (isDeployer || roleLoading)) return null;
  return (
    <AdminCard variant="outlined" className="space-y-2 text-body-sm text-text-sub">
      {!moduleConfigured ? (
        <p>
          {formatMessage({
            id: "cockpit.community.cookies.factoryMissing",
            defaultMessage: "Cookie Jar factory discovery is not configured on this network yet.",
          })}
        </p>
      ) : null}
      {!isDeployer && !roleLoading ? (
        <p>
          {formatMessage({
            id: "cockpit.community.cookies.deployerOnly",
            defaultMessage:
              "This surface is intended for deployer and ops wallets. Connect a deployer wallet to create jars, or the jar owner to sync an existing jar.",
          })}
        </p>
      ) : null}
    </AdminCard>
  );
}

/** One step's body under its header. */
export function CampaignCreateStepBody({
  step,
  form,
  status,
  outcome,
}: {
  step: ActionFlowStep;
  form: CampaignCookieJarCreateFormProps;
  /** Where the Review's send stands. */
  status: FlowSendStatus;
  /** What the send made, once it landed. */
  outcome?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <FlowStepHeader title={step.title} description={step.description} />
      <CampaignCreateNotices form={form} />
      {step.id === "campaign" ? <CampaignDetailsSection {...form} /> : null}
      {step.id === "payout" ? <CampaignPayoutSection {...form} /> : null}
      {step.id === "gardens" ? <CampaignGardenSection {...form} /> : null}
      {step.id === "review" ? (
        <>
          <CampaignCreateReview {...form} status={status} outcome={outcome} />
          {/* Advanced changes what Create sends, so it goes once the jar exists. */}
          {status.phase === "sent" ? null : <CampaignAdvancedSection {...form} />}
        </>
      ) : null}
    </div>
  );
}
