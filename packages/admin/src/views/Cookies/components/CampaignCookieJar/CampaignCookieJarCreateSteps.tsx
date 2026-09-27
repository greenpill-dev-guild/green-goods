import type { IntlShape } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard } from "@/components/AdminCard";
import { AdminLinearProgress } from "@/components/AdminLinearProgress";
import type { ActionFlowStep } from "@/components/Layout/ActionFlowStepper";
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
}: {
  step: ActionFlowStep;
  form: CampaignCookieJarCreateFormProps;
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
          <CampaignCreateReview {...form} />
          <CampaignAdvancedSection {...form} />
        </>
      ) : null}
    </div>
  );
}

/** Cancel or Back, then Next or Create Cookie Jar, with progress while it sends. */
export function CampaignCreateFooter({
  formatMessage,
  isFirstStep,
  isLastStep,
  pending,
  canCreate,
  onCancel,
  onBack,
  onNext,
  onCreate,
}: {
  formatMessage: IntlShape["formatMessage"];
  isFirstStep: boolean;
  isLastStep: boolean;
  pending: boolean;
  canCreate: boolean;
  onCancel: () => void;
  onBack: () => void;
  onNext: () => void;
  onCreate: () => void;
}) {
  const createLabel = formatMessage({
    id: "cockpit.community.cookies.create",
    defaultMessage: "Create Cookie Jar",
  });
  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
      <div className="min-w-0 sm:flex-1" aria-live="polite">
        {pending ? <AdminLinearProgress ariaLabel={createLabel} /> : null}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <AdminButton
          type="button"
          variant={isFirstStep ? "text" : "outlined"}
          onClick={isFirstStep ? onCancel : onBack}
          disabled={pending}
          className="self-start sm:self-auto"
        >
          {isFirstStep
            ? formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })
            : formatMessage({ id: "app.common.back", defaultMessage: "Back" })}
        </AdminButton>
        {isLastStep ? (
          <AdminButton
            type="button"
            variant="filled"
            onClick={onCreate}
            loading={pending}
            disabled={!canCreate || pending}
            className="w-full sm:w-auto"
          >
            {createLabel}
          </AdminButton>
        ) : (
          <AdminButton
            type="button"
            variant="filled"
            onClick={onNext}
            disabled={pending}
            className="w-full sm:w-auto"
          >
            {formatMessage({ id: "app.common.next", defaultMessage: "Next" })}
          </AdminButton>
        )}
      </div>
    </div>
  );
}
