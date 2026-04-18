import type { Meta, StoryObj } from "@storybook/react";
import { RiErrorWarningLine } from "@remixicon/react";
import { useState } from "react";
import { AdminButton } from "./AdminButton";
import { AdminDialog } from "./AdminDialog";

const meta: Meta<typeof AdminDialog> = {
  title: "Admin/AdminDialog",
  component: AdminDialog,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "M3 Basic Dialog — corner-extra-large (28dp) shape, surface-container-high, elevation-3, 32% scrim. Reserved for flows where the strict M3 actions slot + centered layout are required (CookieJar deposit/withdraw/manage). New admin modals should default to DialogShell from @green-goods/shared.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AdminDialog>;

export const Default: Story = {
  render: () => {
    const Demo = () => {
      const [open, setOpen] = useState(true);
      return (
        <AdminDialog
          open={open}
          onOpenChange={setOpen}
          title="Confirm deposit"
          description="Deposit 250 DAI into North Meadow cookie jar?"
          actions={
            <>
              <AdminButton variant="text" onClick={() => setOpen(false)}>
                Cancel
              </AdminButton>
              <AdminButton variant="filled" onClick={() => setOpen(false)}>
                Deposit
              </AdminButton>
            </>
          }
        >
          <div className="text-body-md text-[rgb(var(--m3-on-surface-variant))]">
            Funds will be available to payout recipients immediately after confirmation.
          </div>
        </AdminDialog>
      );
    };
    return <Demo />;
  },
};

export const WithIcon: Story = {
  render: () => {
    const Demo = () => {
      const [open, setOpen] = useState(true);
      return (
        <AdminDialog
          open={open}
          onOpenChange={setOpen}
          title="Unable to withdraw"
          description="This jar has no available balance."
          icon={RiErrorWarningLine}
          actions={
            <AdminButton variant="text" onClick={() => setOpen(false)}>
              Dismiss
            </AdminButton>
          }
        >
          <div className="text-body-md text-[rgb(var(--m3-on-surface-variant))]">
            Recent payouts exhausted the jar. Top up the jar to continue.
          </div>
        </AdminDialog>
      );
    };
    return <Demo />;
  },
};
