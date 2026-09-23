import type { Meta, StoryObj } from "@storybook/react";
import { withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import { type TxProgressRow, TxProgressList } from "./TxProgressList";

const HASH = `0x${"3f".repeat(32)}` as const;

/** A row waiting its turn; each story moves the ones it needs on. */
function row(id: string, title: string, prompt: number, why?: string): TxProgressRow {
  return {
    id,
    title,
    why,
    status: "pending",
    marker: "pending",
    label: null,
    tone: "soft",
    current: false,
    prompt,
    hash: null,
  };
}

const charter = row("charter", "Write the agreement", 1, "Records what the pool is for.");
const cap = row("cap", "Set the commitment limit", 1, "Caps how many offers one person holds.");
const open = row("open", "Open the pool", 2, "Lets neighbours offer and ask.");

const meta: Meta<typeof TxProgressList> = {
  title: "Admin/Primitives/TxProgressList",
  component: TxProgressList,
  tags: ["autodocs"],
  decorators: [withAdminPrimitiveFrame],
  parameters: {
    docs: {
      description: {
        component: [
          "**TxProgressList** — the writes a steward sends one after another, each",
          "with where it stands.",
          "",
          "The rows read before a run fill in during it, so the steward watches the",
          "list they already read rather than a spinner with no words. Each row",
          "carries the wallet prompt it rides in (rows sharing a number are approved",
          "together), and a row that is done links to its transaction. Callers name",
          "the rows and their states: the pool setup and settings saves through",
          "`SetupProgressList`, a seeding pass through `SeedStepSending` and",
          "`SeedStepDone`.",
        ].join("\n"),
      },
    },
  },
  args: {
    chainId: 42161,
    label: "What your wallet will sign",
    rows: [charter, cap, open],
  },
};

export default meta;
type Story = StoryObj<typeof TxProgressList>;

/** Before the run: every row says why the wallet will ask. */
export const BeforeTheRun: Story = {};

/** The first prompt landed; the wallet is asking for the second. */
export const Running: Story = {
  args: {
    rows: [
      {
        ...charter,
        why: undefined,
        title: "Agreement written",
        status: "landed",
        marker: "complete",
        label: "Done",
        tone: "success",
        hash: HASH,
      },
      {
        ...cap,
        why: undefined,
        title: "Commitment limit set",
        status: "landed",
        marker: "complete",
        label: "Done",
        tone: "success",
        hash: HASH,
      },
      {
        ...open,
        status: "signing",
        marker: "active",
        label: "Confirm in your wallet",
        tone: "active",
        current: true,
      },
    ],
  },
};

/** How a run can end, row by row: done, waiting to send later, or stopped. */
export const Ended: Story = {
  args: {
    label: "Each commitment and where it stands",
    rows: [
      {
        ...row("a", "Market rides", 1),
        status: "created",
        marker: "complete",
        label: "Created",
        tone: "success",
        hash: HASH,
      },
      {
        ...row("b", "Clinic rides", 2),
        status: "later",
        marker: "warning",
        label: "Sends later",
        tone: "warning",
      },
      {
        ...row("c", "School rides", 3),
        status: "not-sent",
        marker: "failed",
        label: "Not sent",
        tone: "error",
      },
    ],
  },
};

/** A steward's own long title stops at two lines; hovering shows all of it. */
export const LongTitle: Story = {
  args: {
    label: "Each commitment and where it stands",
    rows: [
      {
        ...row(
          "long",
          "Weekly rides to the Tuesday market for the elders on the hill, with a stop at the clinic on the way back when someone asks",
          1
        ),
        status: "wallet",
        marker: "active",
        label: "Confirm in your wallet",
        tone: "active",
        current: true,
      },
    ],
  },
};
