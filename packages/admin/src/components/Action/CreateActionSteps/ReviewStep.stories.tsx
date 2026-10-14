import type { CreateActionFormData } from "@green-goods/shared/hooks/action/useActionForm";
import { createActionResolver } from "@green-goods/shared/hooks/admin-ui/actions/createAction.utils";
import type { Meta, StoryObj } from "@storybook/react";
import { useForm } from "react-hook-form";
import { useIntl } from "react-intl";
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
import { actionSendStatus } from "./reviewStatus";

const noop = () => undefined;

const STEPS = [
  { id: "basics", title: "Basics" },
  { id: "capitals", title: "Capitals & Media" },
  { id: "instructions", title: "Instructions" },
  { id: "review", title: "Review" },
];

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

const DOMAIN_OPTIONS = [
  { value: 0, label: "Solar" },
  { value: 1, label: "Agroforestry" },
  { value: 2, label: "Education" },
  { value: 3, label: "Waste" },
];

interface ReviewStoryArgs {
  phase?: FlowSendPhase;
  pending?: boolean;
  failure?: keyof typeof FAILURES;
  overrides?: Partial<CreateActionFormData>;
}

function ReviewStepHarness({
  phase = "ready",
  failure = "declined",
  overrides,
  pending,
}: ReviewStoryArgs) {
  const { formatMessage } = useIntl();
  const defaults: CreateActionFormData = {
    title: "Riverbank cleanup cycle",
    slug: "waste.cleanup_event",
    domain: 3,
    startTime: new Date("2026-05-01T00:00:00Z"),
    endTime: new Date("2026-05-30T00:00:00Z"),
    capitals: [0, 3],
    media: [],
    instructionConfig: {
      description: "",
      uiConfig: {
        media: {
          title: "Capture Media",
          description: "Document the cleanup.",
          maxImageCount: 4,
          minImageCount: 1,
          required: true,
          needed: ["Before", "After"],
          optional: [],
        },
        details: {
          title: "Enter Details",
          description: "",
          feedbackPlaceholder: "",
          inputs: [
            {
              key: "kgCollected",
              title: "Kg collected",
              placeholder: "",
              type: "number",
              required: true,
              options: [],
            },
            {
              key: "participants",
              title: "Participants",
              placeholder: "",
              type: "number",
              required: false,
              options: [],
            },
          ],
        },
        review: { title: "Review", description: "" },
      },
    },
    ...overrides,
    translations: overrides?.translations ?? {},
  };

  const form = useForm<CreateActionFormData>({
    defaultValues: defaults,
    resolver: createActionResolver,
    mode: "onChange",
  });
  const status = actionSendStatus({ phase, pending, failure: FAILURES[failure], formatMessage });
  return <ReviewStep form={form} domainOptions={DOMAIN_OPTIONS} status={status} />;
}

/** The Review where a steward meets it: the last step of the Create Action dialog. */
function ReviewInFlow(args: ReviewStoryArgs) {
  const phase = args.phase ?? "ready";
  return (
    <AdminDialog
      open
      size="lg"
      variant="flow"
      tone="actions"
      className={ADMIN_FLOW_DIALOG_CLASS}
      onOpenChange={noop}
      preventClose={phase === "sending"}
      title="Create Action"
      description="Define the registry record, timeline, and submission requirements for a new action."
      bodyClassName="flex min-h-0 flex-col !overflow-hidden"
    >
      <ActionFlowShell
        layout="dialog"
        title="Create Action"
        steps={STEPS}
        currentStep={STEPS.length}
        complete={phase === "sent"}
        footer={
          <FlowSendFooter
            stepIndex={STEPS.length - 1}
            isLast
            phase={phase}
            sendLabel="Create Action"
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
          <FlowStepHeader title="Review" description="Confirm and submit" />
          <ReviewStepHarness {...args} />
        </div>
      </ActionFlowShell>
    </AdminDialog>
  );
}

const meta: Meta<typeof ReviewStepHarness> = {
  title: "Admin/Workflows/Action/ReviewStep",
  // storybook-quality-allow state-harness: supplies form state while rendering the real ReviewStep.
  component: ReviewStepHarness,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The last step of Create Action: what the action will register, under one status row " +
          "that keeps its height through ready, sending, sent and failed. The footer's primary " +
          "sends from here; once the send lands the Review stays as a record and the footer " +
          "offers Done and Create Another (DL-080).",
      },
    },
  },
  argTypes: {
    phase: { control: "inline-radio", options: ["ready", "sending", "sent", "failed"] },
    failure: { control: "inline-radio", options: ["declined", "broken"] },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-2xl" data-tone="actions">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ReviewStepHarness>;

export const Populated: Story = {};

export const NoCustomFields: Story = {
  args: {
    overrides: {
      capitals: [0],
      instructionConfig: {
        description: "",
        uiConfig: {
          media: {
            title: "",
            description: "",
            maxImageCount: 1,
            minImageCount: 1,
            required: false,
            needed: [],
            optional: [],
          },
          details: { title: "", description: "", feedbackPlaceholder: "", inputs: [] },
          review: { title: "", description: "" },
        },
      },
    },
  },
};

export const Pending: Story = { args: { phase: "sending", pending: true } };

export const Sending: Story = { args: { phase: "sending" } };

/** The send landed: the answers stay as a record. */
export const Sent: Story = { args: { phase: "sent" } };

/** The wallet declined: the answers are still the steward's to change. */
export const Declined: Story = { args: { phase: "failed", failure: "declined" } };

export const Failed: Story = { args: { phase: "failed", failure: "broken" } };

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
