import type { Meta, StoryObj } from "@storybook/react";
import { expect, waitFor, within } from "storybook/test";
import { CommitmentExpireDialog } from "./CommitmentExpireDialog";

const meta: Meta<typeof CommitmentExpireDialog> = {
  title: "Admin/Pool/CommitmentExpireDialog",
  component: CommitmentExpireDialog,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component: [
          "**CommitmentExpireDialog** — the confirmation in front of the past-due `Expire now…`",
          "act (pool row and commitment inspector alike). Expiry supersedes waiting claims,",
          "releases the pool's reservation, and is terminal, so the dialog names that blast",
          "radius; the contract stores no expiry reason, so it binds to `AdminConfirmDialog`",
          '(`variant="danger"`) with no invented reason field.',
        ].join("\n"),
      },
    },
    a11y: {
      config: {
        rules: [
          { id: "aria-dialog-name", enabled: true },
          { id: "button-name", enabled: true },
        ],
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof CommitmentExpireDialog>;

/** The confirmation as the steward sees it from a past-due row. */
export const Open: Story = {
  args: {
    isOpen: true,
    title: "Saturday compost workshop",
    tone: "garden",
    onClose: () => undefined,
    onConfirm: () => undefined,
  },
  play: async ({ canvasElement }) => {
    // AdminConfirmDialog portals to <body>, so query the document, not the canvas root.
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => {
      expect(body.getByRole("alertdialog", { name: "Expire This Commitment" })).toBeInTheDocument();
    });
    // The blast radius names the record; danger confirm carries the act verb.
    expect(body.getByText(/Saturday compost workshop/)).toBeInTheDocument();
    expect(body.getByRole("button", { name: "Expire Now" })).toBeInTheDocument();
    expect(body.getByRole("button", { name: "Keep It Live" })).toBeInTheDocument();
  },
};

/** Mid-flight: the chain call is out; both affordances hold, the confirm spins. */
export const Sending: Story = {
  args: {
    isOpen: true,
    title: "Saturday compost workshop",
    tone: "garden",
    isLoading: true,
    onClose: () => undefined,
    onConfirm: () => undefined,
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => {
      expect(body.getByRole("alertdialog", { name: "Expire This Commitment" })).toBeInTheDocument();
    });
  },
};

/** Closed — nothing renders above the scrim. */
export const Closed: Story = {
  args: {
    isOpen: false,
    title: "Saturday compost workshop",
    onClose: () => undefined,
    onConfirm: () => undefined,
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    expect(body.queryByRole("alertdialog")).not.toBeInTheDocument();
  },
};
