import type { SeedRowProgress } from "@green-goods/shared/hooks/admin-ui/pool/useSeedTray";
import type { Meta, StoryObj } from "@storybook/react";
import { SeedStepDone, SeedStepSending } from "./SeedStepDone";

const HASH = `0x${"3f".repeat(32)}`;

function row(
  title: string,
  status: SeedRowProgress["status"],
  txHash: string | null = null
): SeedRowProgress {
  return { clientCommitmentId: title, title, status, txHash };
}

const meta: Meta<typeof SeedStepDone> = {
  title: "Admin/Pool/SeedStepDone",
  component: SeedStepDone,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Where a seeding pass ends. Each commitment is its own wallet prompt, so while the pass runs one line says which prompt the wallet is on, of how many, over every row with where it stands. Once it is over, the wizard stays open on how each row ended: created, with a link to its transaction; sends later, with its row waiting on the pool tab with Send Now; or not sent, with nothing created for it.",
      },
    },
  },
  args: {
    chainId: 42161,
    pass: [
      row("Market rides", "created", HASH),
      row("Clinic rides", "created", HASH),
      row("School rides", "created", HASH),
    ],
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SeedStepDone>;

/** Every row became a commitment. */
export const AllCreated: Story = {};

/** One was created, one waits on the pool tab, one was not sent. */
export const Mixed: Story = {
  args: {
    pass: [
      row("Market rides", "created", HASH),
      row("Clinic rides", "later"),
      row("School rides", "not-sent"),
    ],
  },
};

/** The only row was not sent, so nothing was created. */
export const NothingCreated: Story = { args: { pass: [row("Market rides", "not-sent")] } };

/** The pass is getting the first of three ready for the wallet. */
export const SendingPreparing: Story = {
  render: ({ chainId }) => (
    <SeedStepSending
      chainId={chainId}
      pass={[
        row("Market rides", "preparing"),
        row("Clinic rides", "waiting"),
        row("School rides", "waiting"),
      ]}
    />
  ),
};

/** The first landed; the wallet asks for the second of three. */
export const SendingAtTheWallet: Story = {
  render: ({ chainId }) => (
    <SeedStepSending
      chainId={chainId}
      pass={[
        row("Market rides", "created", HASH),
        row("Clinic rides", "wallet"),
        row("School rides", "waiting"),
      ]}
    />
  ),
};

/** The second is broadcast, and the chain is confirming it. */
export const SendingConfirming: Story = {
  render: ({ chainId }) => (
    <SeedStepSending
      chainId={chainId}
      pass={[
        row("Market rides", "created", HASH),
        row("Clinic rides", "confirming", HASH),
        row("School rides", "waiting"),
      ]}
    />
  ),
};
