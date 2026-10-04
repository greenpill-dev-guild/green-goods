import type { CreationSendMode } from "@green-goods/shared/hooks/admin-ui/pool/useSeedTray";
import type { Meta, StoryObj } from "@storybook/react";
import { useIntl } from "react-intl";
import { SeedFlowFooter } from "./SeedFlowFooter";
import { seedStatusView } from "./seedStatus";
import { type SeedStoryPhase, storySeedCopies, storySeedSending } from "./seedStoryTray";

const noop = () => undefined;

interface FooterStoryArgs {
  phase: SeedStoryPhase;
  mode: CreationSendMode;
  total: number;
  stepIndex: number;
  createDisabled: boolean;
  blockedReason: string | null;
  addAnotherDisabled: boolean;
}

/** The footer at one moment of a Create, read through the same status the Review shows. */
function FooterAt({ phase, mode, total, stepIndex, ...rest }: FooterStoryArgs) {
  const { formatMessage } = useIntl();
  const copies = storySeedCopies(phase, total);
  const status = seedStatusView({
    mode,
    isSending: storySeedSending(phase),
    copies,
    // Every story is a first Create, which sends every copy.
    pass: copies,
    total,
    grouped: total > 1,
    formatMessage,
  });
  return (
    <SeedFlowFooter
      {...rest}
      stepIndex={stepIndex}
      isLast={stepIndex === 3}
      status={status}
      mode={mode}
      total={total}
      canAddAnother={copies === null || status.busy}
      onCancel={noop}
      onBack={noop}
      onNext={noop}
      onAddAnother={noop}
      onCreate={noop}
      onDone={noop}
    />
  );
}

const meta: Meta<FooterStoryArgs> = {
  title: "Admin/Pool/SeedFlowFooter",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The pinned footer of Seed Promises. Until the review it goes back and on. On the review it says how many times the wallet will ask, beside Add Another Like This and Create; while the wallet asks everything is held; afterwards it offers Try Again for what didn't send, then Done.",
      },
    },
  },
  args: {
    phase: "ready",
    mode: "bundle",
    total: 10,
    stepIndex: 3,
    createDisabled: false,
    blockedReason: null,
    addAnotherDisabled: false,
  },
  render: (args) => <FooterAt {...args} />,
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<FooterStoryArgs>;

export const FirstStep: Story = { args: { stepIndex: 0 } };

export const MiddleStep: Story = { args: { stepIndex: 1 } };

/** A wallet that bundles is asked once for all ten. */
export const ReadyOneApproval: Story = {};

/** A wallet that can't bundle asks once per promise. */
export const ReadyOnePromptEach: Story = { args: { mode: "one-by-one" } };

export const ReadySingle: Story = { args: { total: 1 } };

/** The pool is not open, so Create is off, and the footer says why. */
export const PoolNotOpen: Story = {
  args: { createDisabled: true, blockedReason: "Open the pool before seeding into it." },
};

/** Another offer would be one more than the steward may hold open at once. */
export const NoRoomForAnother: Story = { args: { addAnotherDisabled: true } };

export const Approving: Story = { args: { phase: "asking" } };

export const SendingOneByOne: Story = { args: { phase: "sending", mode: "one-by-one" } };

export const Declined: Story = { args: { phase: "declined" } };

/** The answer was lost, so Try Again finishes whatever the chain already has. */
export const Unconfirmed: Story = { args: { phase: "unconfirmed" } };

/** Try Again states its count. */
export const PartialResult: Story = { args: { phase: "partial", mode: "one-by-one" } };

export const Created: Story = { args: { phase: "created" } };

/** One copy waits in the queue: Done, and it is finished from the Promises tab. */
export const FinishLater: Story = { args: { phase: "finishLater", mode: "one-by-one" } };
