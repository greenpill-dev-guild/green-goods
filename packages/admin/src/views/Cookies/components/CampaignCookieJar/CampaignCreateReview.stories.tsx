import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { ADMIN_FLOW_DIALOG_CLASS, AdminDialog } from "@/components/AdminDialog";
import { ActionFlowShell } from "@/components/Layout/ActionFlowShell";
import {
  FlowSendFooter,
  type FlowSendPhase,
  type FlowSendStatus,
  SingleSendNote,
} from "@/components/Layout/FlowSendFooter";
import {
  campaignCookieJarCreateFormProps,
  campaignCookieJarStoryDecorators,
  STORYBOOK_CAMPAIGN_JAR,
} from "./CampaignCookieJar.stories.fixtures";
import {
  CampaignCookieJarCreatedState,
  CampaignCookieJarSubmittedState,
} from "./CampaignCookieJarCreateStates";
import { CampaignCreateStepBody, campaignCreateSteps } from "./CampaignCookieJarCreateSteps";
import { CampaignCreateReview } from "./CampaignCreateReview";
import { campaignCreateStatus } from "./campaignCreateStatus";

const noop = () => undefined;
const { formatMessage } = campaignCookieJarCreateFormProps;
const steps = campaignCreateSteps(formatMessage);

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
    description: "The wallet rejected the transaction.",
  },
};

interface ReviewStoryArgs {
  phase: FlowSendPhase;
  failure: keyof typeof FAILURES;
  /** For a sent create: the jar is known, or the wallet only queued the create. */
  outcome: "created" | "submitted";
}

function statusAt({ phase, failure, outcome }: ReviewStoryArgs) {
  return campaignCreateStatus({
    phase,
    awaitingJarAddress: outcome === "submitted",
    failure: FAILURES[failure],
    formatMessage,
  });
}

function outcomeAt({ phase, outcome }: ReviewStoryArgs) {
  if (phase !== "sent") return null;
  return outcome === "created" ? (
    <CampaignCookieJarCreatedState jarAddress={STORYBOOK_CAMPAIGN_JAR} />
  ) : (
    <CampaignCookieJarSubmittedState
      hash="safe-tx-queued-1"
      manualInput=""
      manualAddress={null}
      onManualInputChange={noop}
      onUseManualAddress={noop}
    />
  );
}

/** The Review where a steward meets it: the last step of the Create Cookie Jar dialog. */
function ReviewInFlow(args: ReviewStoryArgs) {
  const status = statusAt(args);
  const review = steps[steps.length - 1];
  return (
    <AdminDialog
      open
      size="lg"
      variant="flow"
      tone="community"
      className={ADMIN_FLOW_DIALOG_CLASS}
      onOpenChange={noop}
      preventClose={args.phase === "sending"}
      title="Create Cookie Jar"
      bodyClassName="flex min-h-0 flex-col !overflow-hidden"
    >
      <ActionFlowShell
        layout="dialog"
        title="Create Cookie Jar"
        steps={steps}
        currentStep={steps.length}
        complete={args.phase === "sent"}
        footer={
          <FlowSendFooter
            stepIndex={steps.length - 1}
            isLast
            phase={args.phase}
            sendLabel="Create Cookie Jar"
            note={<SingleSendNote phase={args.phase} />}
            another={
              args.outcome === "created" ? { label: "Create Another", onClick: noop } : undefined
            }
            onCancel={noop}
            onBack={noop}
            onNext={noop}
            onSend={noop}
            onDone={noop}
          />
        }
      >
        {review ? (
          <CampaignCreateStepBody
            step={review}
            form={campaignCookieJarCreateFormProps}
            status={status}
            outcome={outcomeAt(args)}
          />
        ) : null}
      </ActionFlowShell>
    </AdminDialog>
  );
}

const meta: Meta<ReviewStoryArgs> = {
  title: "Admin/Workflows/Community/Payouts/CampaignCookieJar/CreateReview",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The last step of Create Cookie Jar: what the jar pays, who can claim, and where its " +
          "page lives, under one status row that keeps its height through ready, sending, sent " +
          "and failed. Once the jar exists the Review shows it, and the footer offers Done and " +
          "Create Another (DL-080).",
      },
    },
  },
  args: { phase: "ready", failure: "broken", outcome: "created" },
  argTypes: {
    phase: { control: "inline-radio", options: ["ready", "sending", "sent", "failed"] },
    failure: { control: "inline-radio", options: ["declined", "broken"] },
    outcome: { control: "inline-radio", options: ["created", "submitted"] },
  },
  render: (args) => (
    <div className="mx-auto max-w-3xl p-6">
      <CampaignCreateReview
        {...campaignCookieJarCreateFormProps}
        status={statusAt(args)}
        outcome={outcomeAt(args)}
      />
    </div>
  ),
  decorators: campaignCookieJarStoryDecorators,
};

export default meta;
type Story = StoryObj<ReviewStoryArgs>;

/** Nothing sent yet: the row says what the primary will do. */
export const Default: Story = {};

export const Sending: Story = { args: { phase: "sending" } };

/** The jar exists: the Review shows it under the row. */
export const Created: Story = { args: { phase: "sent" } };

/** The wallet queued the create without naming the jar: the Review asks for its address. */
export const SubmittedNeedsAddress: Story = { args: { phase: "sent", outcome: "submitted" } };

/** Creation failed on chain (a rejected signature here): the row names the error and keeps the jar. */
export const CreateFailed: Story = {
  tags: ["storybook-ci"],
  args: { phase: "failed" },
  play: async ({ canvasElement }) => {
    const row = await within(canvasElement).findByRole("status");
    await expect(row).toHaveTextContent("The wallet rejected the transaction.");
  },
};

/** A selected garden without a steward adds nobody who can claim; Review counts it. */
export const GardensWithoutSteward: Story = {
  tags: ["storybook-ci"],
  render: (args) => (
    <div className="mx-auto max-w-3xl p-6">
      <CampaignCreateReview
        {...campaignCookieJarCreateFormProps}
        status={statusAt(args)}
        aggregation={{
          ...campaignCookieJarCreateFormProps.aggregation,
          sources: [
            ...campaignCookieJarCreateFormProps.aggregation.sources,
            { gardenAddress: "0x5555555555555555555555555555555555555555" },
          ],
          missingStewardGardens: ["0x5555555555555555555555555555555555555555"],
        }}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const label = await canvas.findByText("Gardens without a steward");
    await expect(label.nextElementSibling).toHaveTextContent(/^1$/);
  },
};

// The same moments inside the dialog, footer included. They stay out of the
// docs page, which would open several modal dialogs at once.
const inFlow = {
  render: (args: ReviewStoryArgs) => <ReviewInFlow {...args} />,
  tags: ["!autodocs"],
};

export const InFlowReady: Story = { ...inFlow };

export const InFlowSending: Story = { ...inFlow, args: { phase: "sending" } };

export const InFlowSent: Story = { ...inFlow, args: { phase: "sent" } };

export const InFlowFailed: Story = { ...inFlow, args: { phase: "failed", failure: "declined" } };
