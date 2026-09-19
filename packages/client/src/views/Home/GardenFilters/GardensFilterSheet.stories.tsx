import { Domain } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import { GardensFilterSheet } from "./index";

/**
 * Filtering the Home garden list at the full tier: membership, the four action domains as chips,
 * and sort order, under the shared header (DL-028). Reset Filters is the
 * sheet's only action, pinned to the bottom edge in the shared bar (DL-016), and stays disabled
 * until a filter differs from the defaults.
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
    filters: { scope: "all", sort: "name" },
    onScopeChange: fn(),
    onSortChange: fn(),
    onDomainsChange: fn(),
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
    const sheet = within(await screen.findByRole("dialog", { name: "Filter Gardens" }));
    await expect(sheet.queryByRole("searchbox")).not.toBeInTheDocument();
    await expect(
      sheet.getByText("Choose which gardens to show and how to order them.")
    ).toBeVisible();
    const all = sheet.getByRole("button", { name: "All gardens" }).getBoundingClientRect();
    const mine = sheet.getByRole("button", { name: /My gardens \(2\)/ }).getBoundingClientRect();
    const solar = sheet.getByRole("button", { name: "Solar" }).getBoundingClientRect();
    const agro = sheet.getByRole("button", { name: "Agroforestry" }).getBoundingClientRect();
    const education = sheet.getByRole("button", { name: "Education" }).getBoundingClientRect();
    const waste = sheet.getByRole("button", { name: "Waste" }).getBoundingClientRect();
    const name = sheet.getByRole("button", { name: "Name (A-Z)" }).getBoundingClientRect();
    const recent = sheet.getByRole("button", { name: "Newest first" }).getBoundingClientRect();
    await expect(all.x).toBe(mine.x);
    await expect(all.y).toBeLessThan(mine.y);
    await expect(solar.y).toBe(agro.y);
    await expect(education.y).toBe(waste.y);
    await expect(solar.width).toBe(agro.width);
    await expect(name.x).toBe(recent.x);
    await expect(name.y).toBeLessThan(recent.y);
    await userEvent.click(sheet.getByRole("button", { name: /My gardens \(2\)/ }));
    await expect(args.onScopeChange).toHaveBeenCalledWith("mine");
    await userEvent.click(sheet.getByRole("button", { name: "Agroforestry" }));
    await expect(args.onDomainsChange).toHaveBeenCalledWith([Domain.AGRO]);
  },
};

export const SelectedDomains: Story = {
  args: {
    filters: {
      scope: "all",
      sort: "name",
      domains: [Domain.AGRO, Domain.EDU],
    },
    isFilterActive: true,
  },
  play: async ({ args }) => {
    const sheet = within(await screen.findByRole("dialog", { name: "Filter Gardens" }));
    await expect(sheet.getByRole("button", { name: "Agroforestry" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(sheet.getByRole("button", { name: "Solar" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    await userEvent.click(sheet.getByRole("button", { name: "Education" }));
    await expect(args.onDomainsChange).toHaveBeenCalledWith([Domain.AGRO]);
    await expect(sheet.getByRole("button", { name: "Reset Filters" })).toBeEnabled();
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
