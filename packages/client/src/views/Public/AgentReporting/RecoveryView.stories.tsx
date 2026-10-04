import type { Meta, StoryObj } from "@storybook/react";
import ceremony from "./CeremonyView.stories";
import { RecoveryView } from "./RecoveryView";

const ACCOUNT = "0x1f3a9c2b7d4e5f60718293a4b5c6d7e8f9012345";
const noop = () => {};
const asyncNoop = async () => {};

const meta: Meta<typeof RecoveryView> = {
  title: "Client/Public/AgentReporting/Recovery",
  component: RecoveryView,
  // The focused shell and the language switch, as the ceremony stories set them up.
  decorators: ceremony.decorators as Meta<typeof RecoveryView>["decorators"],
  parameters: {
    ...ceremony.parameters,
    docs: {
      description: {
        component:
          "`/agent/reporting/recover/:requestId` — moving an account to a new chat, drawn as the " +
          "ceremonies are: the steps in the top bar, a heading card of one size, the step's own " +
          "content, and the act in the fixed bar. Its steps have no status card until the move " +
          "is done, so a problem is said in the heading card.",
      },
    },
  },
  args: {
    stage: "intro",
    channelLabel: "Telegram",
    recoveredAccount: null,
    error: null,
    account: null,
    connecting: false,
    connectWallet: noop,
    connectPasskey: asyncNoop,
    start: asyncNoop,
    prove: asyncNoop,
    confirmCode: asyncNoop,
    apply: asyncNoop,
  },
};
export default meta;

type Story = StoryObj<typeof RecoveryView>;

export const Intro: Story = {};
export const Connect: Story = { args: { stage: "connect" } };
export const Connected: Story = { args: { stage: "connect", account: ACCOUNT } };
export const ConnectDeclined: Story = { args: { ...Connected.args, error: "declined" } };
export const Code: Story = {
  args: { stage: "code", account: ACCOUNT, recoveredAccount: ACCOUNT },
};
/** A code that didn't match is the field's own error, in the place its hint holds. */
export const CodeWrong: Story = { args: { ...Code.args, error: "wrong_code" } };
export const Confirm: Story = { args: { ...Code.args, stage: "confirm" } };
export const Applying: Story = { args: { ...Code.args, stage: "applying" } };
export const Applied: Story = { args: { ...Code.args, stage: "applied" } };
export const Unavailable: Story = { args: { stage: "unavailable", error: "expired" } };
