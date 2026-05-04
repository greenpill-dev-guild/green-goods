import { RiErrorWarningLine, RiWallet3Line } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { type ComponentType, useState } from "react";
import { withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import { AdminButton } from "./AdminButton";
import { AdminDialog } from "./AdminDialog";

const meta: Meta<typeof AdminDialog> = {
  title: "Admin/Primitives/AdminDialog",
  component: AdminDialog,
  tags: ["autodocs"],
  decorators: [withAdminPrimitiveFrame],
  parameters: {
    docs: {
      description: {
        component: [
          "**AdminDialog** — M3 basic dialog. 28dp shape, surface-container-high,",
          "elevation-3, 32 percent scrim, optional icon, headline, supporting",
          "text, and action slot.",
          "",
          "**Tone-aware** — focus ring on the close button consumes",
          "`var(--tone-action, var(--m3-primary))` so it tints to the active",
          "workspace.",
          "",
          "**Accessibility**: native `<dialog>` via Radix; Escape closes; focus",
          "trapped while open; focus returns to trigger on close.",
        ].join("\n"),
      },
    },
    a11y: {
      config: {
        rules: [
          { id: "aria-dialog-name", enabled: true },
          { id: "color-contrast", enabled: true },
          { id: "button-name", enabled: true },
          { id: "focus-order-semantics", enabled: true },
        ],
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AdminDialog>;

function DialogPreview({
  icon,
  title,
  description,
  body,
  confirmLabel = "Confirm",
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  body: string;
  confirmLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-56 items-center justify-center rounded-[var(--m3-shape-lg)] border border-[rgb(var(--m3-outline-variant))] bg-[rgb(var(--m3-surface-container-lowest))] p-6">
      <AdminButton variant="filled" leadingIcon={<RiWallet3Line />} onClick={() => setOpen(true)}>
        Open dialog
      </AdminButton>
      <AdminDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        icon={icon}
        actions={
          <>
            <AdminButton variant="text" onClick={() => setOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton variant="filled" onClick={() => setOpen(false)}>
              {confirmLabel}
            </AdminButton>
          </>
        }
      >
        <div>{body}</div>
      </AdminDialog>
    </div>
  );
}

export const Default: Story = {
  render: () => (
    <DialogPreview
      title="Confirm deposit"
      description="Deposit 250 DAI into North Meadow cookie jar?"
      body="Funds will be available to payout recipients immediately after confirmation."
      confirmLabel="Deposit"
    />
  ),
};

export const WithIcon: Story = {
  render: () => (
    <DialogPreview
      title="Unable to withdraw"
      description="This jar has no available balance."
      body="Recent payouts exhausted the jar. Top up the jar to continue."
      icon={RiErrorWarningLine}
      confirmLabel="Dismiss"
    />
  ),
};

export const StateCatalog: Story = {
  render: () => (
    <div className="grid gap-4 md:grid-cols-2">
      <DialogPreview
        title="Confirm deposit"
        description="Deposit 250 DAI into North Meadow cookie jar?"
        body="Funds will be available after confirmation."
        confirmLabel="Deposit"
      />
      <DialogPreview
        title="Unable to withdraw"
        description="This jar has no available balance."
        body="Top up the jar to continue."
        icon={RiErrorWarningLine}
        confirmLabel="Dismiss"
      />
    </div>
  ),
};

/** Long body — verifies dialog scrolls inside its surface when content exceeds viewport. */
export const LongBody: Story = {
  render: () => (
    <DialogPreview
      title="Read before continuing"
      description="A long supporting message — dialog body should scroll cleanly."
      body={Array.from(
        { length: 12 },
        (_, i) =>
          `Paragraph ${i + 1}: lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`
      ).join("\n\n")}
      confirmLabel="I understand"
    />
  ),
};

/** Tone matrix — same dialog inside each `[data-tone]` scope. */
export const ToneMatrix: Story = {
  render: () => (
    <div className="grid gap-4 md:grid-cols-2">
      {(["hub", "garden", "community", "actions"] as const).map((tone) => (
        <div key={tone} data-tone={tone}>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-soft">
            [data-tone="{tone}"]
          </div>
          <DialogPreview
            title="Confirm deposit"
            description="Deposit 250 DAI into the cookie jar."
            body="Funds will be available after confirmation."
            confirmLabel="Deposit"
          />
        </div>
      ))}
    </div>
  ),
};
