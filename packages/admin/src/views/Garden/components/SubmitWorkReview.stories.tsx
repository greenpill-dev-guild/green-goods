import { type Action, Domain } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { RiUploadCloudLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { ADMIN_FLOW_DIALOG_CLASS, AdminDialog } from "@/components/AdminDialog";
import { ActionFlowShell } from "@/components/Layout/ActionFlowShell";
import {
  FlowSendFooter,
  type FlowSendPhase,
  SingleSendNote,
} from "@/components/Layout/FlowSendFooter";
import { SubmitWorkReview } from "./SubmitWorkReview";
import { submitWorkSendStatus } from "./submitWorkStatus";

const noop = () => undefined;

const ACTION: Action = {
  id: "42161-1",
  slug: "agro.canopy_baseline",
  title: "Canopy baseline",
  startTime: 0,
  endTime: 0,
  instructions: "Document baseline canopy cover for the plot.",
  capitals: [],
  media: [],
  domain: Domain.AGRO,
  createdAt: 0,
  description: "Document baseline canopy cover.",
  inputs: [
    {
      key: "plot",
      title: "Plot code",
      placeholder: "Plot A",
      type: "text",
      required: true,
      options: [],
    },
  ],
  mediaInfo: { title: "Field photos", required: true, minImageCount: 1, maxImageCount: 3 },
};

const STEPS = [
  { id: "action", title: "Action" },
  { id: "media", title: "Media" },
  { id: "details", title: "Details" },
  { id: "review", title: "Review" },
];

const FILLED = {
  plot: "Plot A",
  timeSpentMinutes: 2.5,
  feedback: "Cleared the south bed and logged regrowth.",
};

interface ReviewStoryArgs {
  phase: FlowSendPhase;
  /** The stage the send says it is on, while it sends. */
  progressMessage: string;
  values: Record<string, unknown>;
}

/** The Review at one moment of the send: only the status row and the Edit links change. */
function ReviewAt({ phase, progressMessage, values }: ReviewStoryArgs) {
  const { formatMessage } = useIntl();
  const status = submitWorkSendStatus({ phase, progressMessage, formatMessage });
  return (
    <SubmitWorkReview
      action={ACTION}
      images={[]}
      values={values}
      photoRequirementText="1 photo required"
      status={status}
      onEditStep={noop}
    />
  );
}

/** The Review where a steward meets it: the last step of the Submit Work dialog. */
function ReviewInFlow(args: ReviewStoryArgs) {
  const { phase } = args;
  return (
    <AdminDialog
      open
      size="lg"
      variant="flow"
      tone="garden"
      className={ADMIN_FLOW_DIALOG_CLASS}
      onOpenChange={noop}
      preventClose={phase === "sending"}
      title="Submit Work"
      description="Submit work on behalf of a gardener for this garden"
      bodyClassName="flex min-h-0 flex-col !overflow-hidden"
    >
      <ActionFlowShell
        layout="dialog"
        title="Submit Work"
        context="Rio Rainforest Lab"
        steps={STEPS}
        currentStep={STEPS.length}
        complete={phase === "sent"}
        footer={
          <FlowSendFooter
            stepIndex={STEPS.length - 1}
            isLast
            phase={phase}
            sendLabel="Submit Work"
            sendButtonProps={{ leadingIcon: <RiUploadCloudLine /> }}
            note={<SingleSendNote phase={phase} />}
            another={{ label: "Submit Another", onClick: noop }}
            onCancel={noop}
            onBack={noop}
            onNext={noop}
            onSend={noop}
            onDone={noop}
          />
        }
      >
        <ReviewAt {...args} />
      </ActionFlowShell>
    </AdminDialog>
  );
}

const meta: Meta<ReviewStoryArgs> = {
  title: "Admin/Workflows/Garden/SubmitWorkReview",
  tags: ["autodocs"],
  args: { phase: "ready", progressMessage: "", values: FILLED },
  argTypes: {
    phase: { control: "inline-radio", options: ["ready", "sending", "sent", "failed"] },
  },
  render: (args) => <ReviewAt {...args} />,
  decorators: [
    (Story) => (
      <div className="max-w-2xl" data-tone="garden">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Read-only summary shown on the final Review step of Submit Work — action, details, " +
          "time & notes, and photos, built from admin Surface + M3 tokens — under one status " +
          "row. The row keeps its height through ready, sending, sent and failed, so the cards " +
          "never move; once the send lands the Review stays as a record and the footer offers " +
          "Done (DL-080).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<ReviewStoryArgs>;

/** Nothing sent yet: the row says what the primary will do. */
export const Filled: Story = {};

export const Empty: Story = {
  args: { values: {} },
};

/** The send names the stage it is on as it reaches each. */
export const Sending: Story = {
  args: { phase: "sending", progressMessage: "Uploading media..." },
};

/** The send landed: the values stay as a record, and no section reopens. */
export const Sent: Story = { args: { phase: "sent" } };

/** The send failed or was declined: the values are still the steward's to change. */
export const Failed: Story = { args: { phase: "failed" } };

// The same four moments inside the dialog, footer included. They stay out of
// the docs page, which would open four modal dialogs at once.
const inFlow = {
  render: (args: ReviewStoryArgs) => <ReviewInFlow {...args} />,
  tags: ["!autodocs"],
};

export const InFlowReady: Story = { ...inFlow };

export const InFlowSending: Story = {
  ...inFlow,
  args: { phase: "sending", progressMessage: "Confirm in your wallet..." },
};

export const InFlowSent: Story = { ...inFlow, args: { phase: "sent" } };

export const InFlowFailed: Story = { ...inFlow, args: { phase: "failed" } };
