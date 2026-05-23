import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { AdminButton } from "../AdminButton";
import { AdminConfirmDialog } from "../AdminDialog";

// Coverage for the emergency-pause confirmation that `PositionCard` opens.
// PositionCard wires a real `AdminConfirmDialog` (danger variant) behind its
// "Emergency pause" control; the PositionCard *visual harness* story cannot
// exercise that path because it stubs the button with `fn()`. This story
// renders the real `AdminConfirmDialog` with the same copy and variant the
// runtime uses, so the confirmation surface is proven in-browser.
//
// Strings mirror the i18n values PositionCard formats:
//   app.treasury.emergencyPauseTitle / .emergencyPauseDescription /
//   .emergencyPause (confirm) and app.wizard.cancel (cancel).

const PAUSE_TITLE = "Confirm emergency pause";
const PAUSE_DESCRIPTION =
  "This action will block all new deposits to the vault strategy. Existing depositors can still withdraw their funds.";
const CONFIRM_LABEL = "Emergency pause";
const CANCEL_LABEL = "Cancel";

/**
 * State wrapper that mirrors PositionCard's emergency-pause flow: a danger
 * trigger that opens the real confirmation dialog. `onConfirm` is a spy so the
 * play function can prove the confirm transaction is never fired.
 */
function EmergencyPauseFixture({ onConfirm = fn() }: { onConfirm?: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-auto max-w-md p-4">
      <AdminButton variant="danger" size="sm" onClick={() => setOpen(true)}>
        {CONFIRM_LABEL}
      </AdminButton>
      <AdminConfirmDialog
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={onConfirm}
        title={PAUSE_TITLE}
        description={PAUSE_DESCRIPTION}
        confirmLabel={CONFIRM_LABEL}
        cancelLabel={CANCEL_LABEL}
        variant="danger"
      />
    </div>
  );
}

const meta: Meta<typeof AdminConfirmDialog> = {
  title: "Admin/Workflows/Vault/Emergency Pause Confirm",
  component: AdminConfirmDialog,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The danger-variant `AdminConfirmDialog` that `PositionCard` opens when an operator taps **Emergency pause**. Rendered through a small state wrapper so the open → confirm/cancel surface is reviewable and browser-tested without seeding wagmi.",
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
type Story = StoryObj<typeof AdminConfirmDialog>;

/** Static preview of the open confirmation surface for docs/visual review. */
export const Open: Story = {
  render: () => (
    <div className="mx-auto max-w-md p-4">
      <AdminConfirmDialog
        isOpen
        onClose={() => undefined}
        onConfirm={fn()}
        title={PAUSE_TITLE}
        description={PAUSE_DESCRIPTION}
        confirmLabel={CONFIRM_LABEL}
        cancelLabel={CANCEL_LABEL}
        variant="danger"
      />
    </div>
  ),
};

/**
 * Browser interaction + geometry. Opens the confirmation, asserts the surface,
 * title, description, and footer actions, checks the dialog sits within the
 * viewport, then cancels — proving close works. The confirm action is a spy
 * and is never clicked, so no pause "transaction" is ever submitted.
 */
export const OpenAndCancel: Story = {
  tags: ["storybook-ci"],
  render: (args) => <EmergencyPauseFixture onConfirm={args.onConfirm} />,
  args: { onConfirm: fn() },
  play: async ({ args, canvasElement }) => {
    // Trigger lives in the canvas; the dialog portals to document.body. Scope
    // the trigger query to the canvas so it never collides with the confirm
    // button (same label) once the dialog opens.
    const trigger = within(canvasElement).getByRole("button", { name: CONFIRM_LABEL });
    await userEvent.click(trigger);

    const dialog = await within(document.body).findByRole("alertdialog", {
      name: new RegExp(PAUSE_TITLE, "i"),
    });

    // Settle the open animation (admin-m3-overrides.css drives a zoom/opacity
    // fade) so the visibility assertions below don't race the opacity fade-in.
    // `animation.finished` resolves at actual completion, independent of runner
    // load.
    await Promise.all(
      (dialog.getAnimations?.() ?? []).map((animation) => animation.finished.catch(() => undefined))
    );

    // Scrim is present.
    const scrim = document.body.querySelector<HTMLElement>(
      '[data-component="AdminDialog"][data-slot="overlay"]'
    );
    await expect(scrim).not.toBeNull();

    // Surface has a non-zero rect and stays within the viewport.
    await waitFor(async () => {
      const rect = dialog.getBoundingClientRect();
      await expect(rect.width).toBeGreaterThan(0);
      await expect(rect.height).toBeGreaterThan(0);
      await expect(rect.left).toBeGreaterThanOrEqual(-1);
      await expect(rect.right).toBeLessThanOrEqual(window.innerWidth + 1);
      await expect(rect.top).toBeGreaterThanOrEqual(-1);
      await expect(rect.bottom).toBeLessThanOrEqual(window.innerHeight + 1);
    });

    // Title + description copy.
    await expect(within(dialog).getByRole("heading", { name: PAUSE_TITLE })).toBeVisible();
    await expect(within(dialog).getByText(/block all new deposits/i)).toBeVisible();

    // Footer actions: both Cancel and the danger confirm, scoped to the dialog
    // so the canvas trigger is excluded.
    const actions = within(dialog).getByTestId("admin-dialog-actions");
    await expect(actions).toBeVisible();
    const cancelButton = within(actions).getByRole("button", { name: CANCEL_LABEL });
    const confirmButton = within(actions).getByRole("button", { name: CONFIRM_LABEL });
    await expect(cancelButton).toBeVisible();
    await expect(confirmButton).toBeVisible();

    // Cancel closes the dialog; confirm is never invoked. The close animation
    // (~300ms) delays Radix's unmount, and combined-suite load can stretch the
    // wall-clock time, so allow a generous timeout for the surface to leave.
    await userEvent.click(cancelButton);
    await waitFor(
      async () => {
        await expect(
          within(document.body).queryByRole("alertdialog", {
            name: new RegExp(PAUSE_TITLE, "i"),
          })
        ).toBeNull();
      },
      { timeout: 4000 }
    );
    await expect(args.onConfirm).not.toHaveBeenCalled();
  },
};
