import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, screen, userEvent, waitFor } from "storybook/test";
import { GardensFilterSheet } from "./index";

/**
 * Filtering the Home garden list by membership and sort order. Reset Filters is the sheet's only
 * action, pinned to the bottom edge in the shared bar (DL-016), and stays disabled until a filter
 * differs from the defaults.
 */
const meta: Meta<typeof GardensFilterSheet> = {
  title: "Client/Sheets/GardensFilterSheet",
  component: GardensFilterSheet,
  tags: ["autodocs", "storybook-ci"],
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile" } },
  args: {
    isOpen: true,
    onClose: fn(),
    filters: { scope: "all", sort: "default" },
    onScopeChange: fn(),
    onSortChange: fn(),
    onReset: fn(),
    canFilterMine: true,
    myGardensCount: 2,
    isFilterActive: false,
  },
};

export default meta;
type Story = StoryObj<typeof GardensFilterSheet>;

export const Defaults: Story = {
  play: async ({ args }) => {
    await expect(await screen.findByRole("button", { name: "Reset Filters" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /My gardens \(2\)/ }));
    await expect(args.onScopeChange).toHaveBeenCalledWith("mine");
  },
};

export const FilteredToMine: Story = {
  args: { filters: { scope: "mine", sort: "recent" }, isFilterActive: true },
  play: async ({ args }) => {
    const reset = await screen.findByRole("button", { name: "Reset Filters" });
    await expect(reset).toBeEnabled();
    await userEvent.click(reset);
    await expect(args.onReset).toHaveBeenCalledOnce();
  },
};

export const SignedOut: Story = {
  args: { canFilterMine: false, myGardensCount: 0 },
  play: async () => {
    const hint = await screen.findByText("Sign in to filter by your gardens.");
    await waitFor(() => expect(hint).toBeVisible());
    await expect(screen.getByRole("button", { name: /My gardens \(0\)/ })).toBeDisabled();
  },
};
