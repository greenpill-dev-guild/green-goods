import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, screen, userEvent } from "storybook/test";
import { DraftSheet } from "./DraftSheet";

/**
 * The prompt shown when a saved work draft is waiting. Continue Draft stacks over Start Fresh;
 * Start Fresh first asks to confirm, with a red Discard Draft over Keep Draft (DL-016). Photos
 * saved before an account existed get their own recovery wording.
 */
const meta: Meta<typeof DraftSheet> = {
  title: "Client/Sheets/DraftSheet",
  component: DraftSheet,
  tags: ["autodocs", "storybook-ci"],
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile" } },
  args: {
    isOpen: true,
    imageCount: 2,
    onContinue: fn(),
    onStartFresh: fn(),
    onClose: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof DraftSheet>;

export const ContinueDraft: Story = {
  play: async () => {
    await expect(
      await screen.findByRole("dialog", { name: "Continue Previous Work?" })
    ).toBeVisible();
    const resume = screen.getByRole("button", { name: "Continue Draft" });
    await expect(resume.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      screen.getByRole("button", { name: "Start Fresh" }).getBoundingClientRect().top
    );
  },
};

export const DiscardConfirm: Story = {
  play: async ({ args }) => {
    await userEvent.click(await screen.findByRole("button", { name: "Start Fresh" }));
    await expect(await screen.findByRole("dialog", { name: "Discard this draft?" })).toBeVisible();
    await expect(screen.getByRole("button", { name: "Keep Draft" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Discard Draft" }));
    await expect(args.onStartFresh).toHaveBeenCalledOnce();
  },
};

export const RecoverPhotos: Story = {
  args: { legacyRecovery: true },
  play: async () => {
    await expect(
      await screen.findByRole("dialog", { name: "Recover saved photos?" })
    ).toBeVisible();
    await expect(screen.getByRole("button", { name: "Recover photos" })).toBeVisible();
  },
};

export const CouldNotRestore: Story = {
  args: {
    onContinue: fn(async () => {
      throw new Error("draft storage unavailable");
    }),
  },
  play: async () => {
    await userEvent.click(await screen.findByRole("button", { name: "Continue Draft" }));
    await expect(
      await screen.findByText(
        "Could not save or restore this work. Your previously saved work is still available."
      )
    ).toBeVisible();
  },
};
