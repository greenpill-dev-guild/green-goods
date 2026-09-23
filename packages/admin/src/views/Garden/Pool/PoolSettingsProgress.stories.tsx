import type { PoolSetupStepState } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentPoolSetupSequence";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { PoolSettingsProgress } from "./PoolSettingsProgress";
import { promptNumbers } from "./SetupFlow/setupWrites";

const TX = `0x${"a".repeat(64)}` as `0x${string}`;

/** Both settings changed: the agreement, then the limit. */
function rows(
  charter: PoolSetupStepState["status"],
  cap: PoolSetupStepState["status"]
): PoolSetupStepState[] {
  return [
    {
      action: "setPoolCharter",
      status: charter,
      hash: charter === "landed" ? TX : null,
      batched: false,
    },
    {
      action: "setProviderOpenCommitmentCap",
      status: cap,
      hash: cap === "landed" ? TX : null,
      batched: false,
    },
  ];
}

function numbered(steps: PoolSetupStepState[], stopped = false) {
  const { numbers, total } = promptNumbers(steps, false, stopped);
  return { rows: steps, numbers, total };
}

const meta: Meta<typeof PoolSettingsProgress> = {
  title: "Admin/Pool/PoolSettingsProgress",
  component: PoolSettingsProgress,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A pool settings save once it has started: where it stands in one line, each write row by row, what a stop left saved, and how many more times a retry asks the wallet.",
      },
    },
  },
  args: {
    status: "running",
    failure: null,
    chainId: 42161,
    ...numbered(rows("signing", "pending")),
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PoolSettingsProgress>;

/** The first of two prompts is open in the wallet. */
export const Signing: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("Confirm in your wallet (1 of 2)")
    ).toBeInTheDocument();
  },
};

/** The agreement landed; the limit is being confirmed. */
export const Confirming: Story = {
  args: numbered(rows("landed", "confirming")),
};

/** The agreement landed and the limit did not: a retry asks once more, for the limit only. */
export const AgreementSavedLimitNot: Story = {
  args: {
    status: "failed",
    failure: "send-failed",
    ...numbered(rows("landed", "failed"), true),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("The new agreement is saved. The commitment limit is not.")
    ).toBeInTheDocument();
    await expect(canvas.getByText(/Your wallet will ask once more\./)).toBeInTheDocument();
  },
};

/** The first write was refused: nothing changed, and a retry asks for both again. */
export const NothingSaved: Story = {
  args: {
    status: "failed",
    failure: "send-failed",
    ...numbered(rows("failed", "pending"), true),
  },
};

/** No wallet could sign, so nothing was sent and there is nothing to retry. */
export const NoWallet: Story = {
  args: {
    status: "failed",
    failure: "no-sender",
    ...numbered(rows("pending", "pending"), true),
  },
};

/** Both writes landed. */
export const Saved: Story = {
  args: {
    status: "complete",
    ...numbered(rows("landed", "landed")),
  },
};
