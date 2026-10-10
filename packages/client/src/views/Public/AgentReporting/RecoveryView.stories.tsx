import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
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
    failure: null,
    savedPasskey: false,
    canFindAccount: true,
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
/** A browser that remembers a passkey can still reach another account, by its name. */
export const ConnectReturning: Story = { args: { stage: "connect", savedPasskey: true } };
/** On a new phone the browser remembers no passkey, so Use Passkey asks for the account's name. */
export const FindAccount: Story = { args: { stage: "connect", initialEntry: "find" } };
export const FindNameNotFound: Story = {
  args: {
    ...FindAccount.args,
    failure: { reason: "name_not_found", spoken: "No passkey found for that username." },
  },
};
/** A failed attempt to connect is said in the heading card, with what to do next. */
export const ConnectFailed: Story = {
  args: {
    ...ConnectReturning.args,
    failure: { reason: "prompt_closed", spoken: "Sign in was cancelled." },
  },
};
export const Connected: Story = { args: { stage: "connect", account: ACCOUNT } };
export const ConnectDeclined: Story = { args: { ...Connected.args, error: "declined" } };
export const Code: Story = {
  args: { stage: "code", account: ACCOUNT, recoveredAccount: ACCOUNT },
};
/** A code that didn't match is the field's own error, in the place its hint holds. */
export const CodeWrong: Story = { args: { ...Code.args, error: "wrong_code" } };
export const Confirm: Story = { args: { ...Code.args, stage: "confirm" } };
/**
 * Confirm Code and Move My Account are one act in one place, so the button's node stays and only
 * its name changes. The step has changed all the same, and its title takes focus: the person
 * hears what moving the account does before they are on the act that does it.
 */
export const CodeConfirmed: Story = {
  tags: ["storybook-ci"],
  args: Code.args,
  render: function CodeConfirmed(args) {
    const [stage, setStage] = useState(args.stage);
    return <RecoveryView {...args} stage={stage} confirmCode={async () => setStage("confirm")} />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("textbox", { name: /6-digit code/ }), "123456");
    const pressed = canvas.getByRole("button", { name: "Confirm Code" });
    await userEvent.click(pressed);
    const title = await canvas.findByRole("heading", { level: 1, name: "Move This Account?" });
    await expect(canvas.getByRole("button", { name: "Move My Account" })).toBe(pressed);
    await waitFor(() => expect(title).toHaveFocus());
  },
};
export const Applying: Story = { args: { ...Code.args, stage: "applying" } };
export const Applied: Story = { args: { ...Code.args, stage: "applied" } };
export const Unavailable: Story = { args: { stage: "unavailable", error: "expired" } };
