import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import type { CreateAssessmentFormState } from "@green-goods/shared/stores/useCreateAssessmentStore";
import { CynefinPhase, Domain } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { useIntl } from "react-intl";
import { STORYBOOK_ADMIN_ACTIONS } from "../../../../../shared/.storybook/adminFixtures";
import { withSeededQueryClient } from "../../../../../shared/.storybook/decorators";
import { ADMIN_FLOW_DIALOG_CLASS, AdminDialog } from "../../AdminDialog";
import { ActionFlowShell } from "../../Layout/ActionFlowShell";
import {
  FlowSendFooter,
  type FlowSendPhase,
  type FlowSendStatus,
  SingleSendNote,
} from "../../Layout/FlowSendFooter";
import { FlowStepHeader } from "../../Layout/FlowStepHeader";
import { ReviewStep } from "./ReviewStep";
import { assessmentSendStatus } from "./reviewStatus";

const noop = () => undefined;

const STEPS = [
  { id: "domainContext", title: "Domain & Context" },
  { id: "strategy", title: "Challenge & Goals" },
  { id: "actionsHarvest", title: "Actions & Reporting Period" },
  { id: "review", title: "Review" },
];

const ANSWERS: CreateAssessmentFormState = {
  title: "Rio canopy baseline, wet season",
  description:
    "Canopy cover and seedling survival across the east plot, measured before the wet-season planting.",
  location: "East plot, Rio Rainforest Lab",
  diagnosis:
    "Cattle grazing thinned the canopy along the east boundary, and the seedlings planted last season have no shade.",
  smartOutcomes: [
    { description: "The east plot regains its canopy", metric: "treesPlanted", target: 200 },
    { description: "Seedlings survive their first dry season", metric: "areaCoveredHa", target: 5 },
  ],
  cynefinPhase: CynefinPhase.COMPLICATED,
  domain: Domain.AGRO,
  selectedActionUIDs: [STORYBOOK_ADMIN_ACTIONS[0].id],
  sdgTargets: [],
  reportingPeriodStart: "2026-07-01",
  reportingPeriodEnd: "2026-09-30",
  attachments: [],
};

/** How a failed send reads: the wallet declined, or the send broke. */
const FAILURES: Record<
  "declined" | "broken",
  Pick<FlowSendStatus, "tone" | "title" | "description">
> = {
  declined: {
    tone: "warning",
    title: "Transaction cancelled",
    description: "Transaction was cancelled. Please try again when ready.",
  },
  broken: {
    tone: "error",
    title: "Transaction failed",
    description: "Something went wrong. Please try again.",
  },
};

interface ReviewStoryArgs {
  phase: FlowSendPhase;
  failure: keyof typeof FAILURES;
  form: CreateAssessmentFormState;
}

/** The Review at one moment of the send: only the status row and the Edit links change. */
function ReviewAt({ phase, failure, form }: ReviewStoryArgs) {
  const { formatMessage } = useIntl();
  const status = assessmentSendStatus({ phase, failure: FAILURES[failure], formatMessage });
  return <ReviewStep form={form} steps={STEPS} status={status} onEditStep={noop} />;
}

/** The Review where a steward meets it: the last step of the Create Assessment dialog. */
function ReviewInFlow(args: ReviewStoryArgs) {
  const { phase } = args;
  return (
    <AdminDialog
      open
      size="lg"
      variant="flow"
      tone="hub"
      className={ADMIN_FLOW_DIALOG_CLASS}
      onOpenChange={noop}
      preventClose={phase === "sending"}
      title="Create Assessment"
      description="Describe the work, its goals, and the period it covers."
      bodyClassName="flex min-h-0 flex-col !overflow-hidden"
    >
      <ActionFlowShell
        layout="dialog"
        title="Create Assessment"
        context="Rio Rainforest Lab"
        steps={STEPS}
        currentStep={STEPS.length}
        complete={phase === "sent"}
        footer={
          <FlowSendFooter
            stepIndex={STEPS.length - 1}
            isLast
            phase={phase}
            sendLabel="Submit Assessment"
            note={<SingleSendNote phase={phase} />}
            another={{ label: "Create Another", onClick: noop }}
            onCancel={noop}
            onBack={noop}
            onNext={noop}
            onSend={noop}
            onDone={noop}
          />
        }
      >
        <div className="space-y-4">
          <FlowStepHeader title="Review" description="Check everything before submitting" />
          <ReviewAt {...args} />
        </div>
      </ActionFlowShell>
    </AdminDialog>
  );
}

const meta: Meta<ReviewStoryArgs> = {
  title: "Admin/Workflows/Assessment/ReviewStep",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The last step of Create Assessment: what the attestation will carry, grouped by the " +
          "step that asked it, each section with an Edit, under one status row. The row keeps " +
          "its height through ready, sending, sent and failed, so the sections never move. The " +
          "footer's primary sends from here; once the send lands the Review stays as a record " +
          "and the footer offers Done (DL-080).",
      },
    },
  },
  args: { phase: "ready", failure: "declined", form: ANSWERS },
  argTypes: {
    phase: { control: "inline-radio", options: ["ready", "sending", "sent", "failed"] },
    failure: { control: "inline-radio", options: ["declined", "broken"] },
  },
  render: (args) => <ReviewAt {...args} />,
  decorators: [
    withSeededQueryClient([[queryKeys.actions.byChain(DEFAULT_CHAIN_ID), STORYBOOK_ADMIN_ACTIONS]]),
    (Story) => (
      <div className="max-w-3xl p-4" data-tone="hub">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<ReviewStoryArgs>;

/** Nothing sent yet: the row says what the primary will do. */
export const Ready: Story = {};

export const Sending: Story = { args: { phase: "sending" } };

/** The send landed: the answers stay as a record, and no section reopens. */
export const Sent: Story = { args: { phase: "sent" } };

/** The wallet declined: the answers are still the steward's to change. */
export const Declined: Story = { args: { phase: "failed", failure: "declined" } };

export const Failed: Story = { args: { phase: "failed", failure: "broken" } };

/** A draft reopened on the Review with answers missing: each gap says so. */
export const MissingAnswers: Story = {
  args: {
    form: {
      ...ANSWERS,
      location: "",
      diagnosis: "",
      smartOutcomes: [],
      selectedActionUIDs: [],
      reportingPeriodEnd: "",
    },
  },
};

// The same four moments inside the dialog, footer included. They stay out of
// the docs page, which would open four modal dialogs at once.
const inFlow = {
  render: (args: ReviewStoryArgs) => <ReviewInFlow {...args} />,
  tags: ["!autodocs"],
};

export const InFlowReady: Story = { ...inFlow };

export const InFlowSending: Story = { ...inFlow, args: { phase: "sending" } };

export const InFlowSent: Story = { ...inFlow, args: { phase: "sent" } };

export const InFlowFailed: Story = { ...inFlow, args: { phase: "failed", failure: "declined" } };
