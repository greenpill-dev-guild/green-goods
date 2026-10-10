import type { Meta, StoryObj } from "@storybook/react";
import { FlowSendFooter, type FlowSendFooterProps, SingleSendNote } from "./FlowSendFooter";

const noop = () => undefined;

/** The footer at one moment of a send, with the note a one-prompt send says beside it. */
function FooterAt(props: FlowSendFooterProps) {
  return <FlowSendFooter {...props} note={<SingleSendNote phase={props.phase} />} />;
}

const meta = {
  title: "Admin/Shell/FlowSendFooter",
  component: FlowSendFooter,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The pinned footer of a create flow that ends on a Review step whose primary sends " +
          "(DL-080). Until the Review it goes back and on. On the Review it says how often the " +
          "wallet will ask beside the act; while the send works every button waits; a send " +
          "that failed or was declined offers Try Again and the way back; a send that landed " +
          "leaves only Done and, where the flow makes more than one thing, a fresh start.",
      },
    },
  },
  args: {
    stepIndex: 3,
    isLast: true,
    phase: "ready",
    sendLabel: "Submit Assessment",
    another: { label: "Create Another", onClick: noop },
    onCancel: noop,
    onBack: noop,
    onNext: noop,
    onSend: noop,
    onDone: noop,
  },
  render: (args) => <FooterAt {...args} />,
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-4" data-tone="hub">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FlowSendFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The first step leaves by Cancel. */
export const FirstStep: Story = { args: { stepIndex: 0, isLast: false } };

export const MiddleStep: Story = { args: { stepIndex: 1, isLast: false } };

/** Work outside the send is under way (media still preparing), so every button waits. */
export const Held: Story = { args: { stepIndex: 1, isLast: false, held: true } };

/** On the Review: the act, and how often the wallet will ask. */
export const Ready: Story = {};

/** What the act would send is incomplete: only the act waits, and the way back stays. */
export const SendHeld: Story = { args: { sendDisabled: true } };

export const Sending: Story = { args: { phase: "sending" } };

/** The send failed or was declined: the same act again, and the way back to the answers. */
export const Failed: Story = { args: { phase: "failed" } };

/** The send landed: Done, or a fresh start. */
export const Sent: Story = { args: { phase: "sent" } };

/** A flow that makes one thing only ends on Done alone. */
export const SentOneOnly: Story = { args: { phase: "sent", another: undefined } };
