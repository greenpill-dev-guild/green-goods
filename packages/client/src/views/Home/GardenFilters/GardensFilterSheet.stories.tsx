import { Domain } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import { GardensFilterSheet } from "./index";

/**
 * Filtering the Home garden list at the full tier: search by name or place, membership, the four
 * action domains as chips, and sort order, under the shared header (DL-028). Reset Filters is the
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
    filters: { scope: "all", sort: "default" },
    onScopeChange: fn(),
    onSortChange: fn(),
    onSearchChange: fn(),
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
    await expect(sheet.getByRole("searchbox", { name: "Search gardens" })).toHaveValue("");
    await userEvent.click(sheet.getByRole("button", { name: /My gardens \(2\)/ }));
    await expect(args.onScopeChange).toHaveBeenCalledWith("mine");
    await userEvent.click(sheet.getByRole("button", { name: "Agroforestry" }));
    await expect(args.onDomainsChange).toHaveBeenCalledWith([Domain.AGRO]);
  },
};

export const SearchAndDomains: Story = {
  args: {
    filters: {
      scope: "all",
      sort: "default",
      search: "São Paulo",
      domains: [Domain.AGRO, Domain.EDU],
    },
    isFilterActive: true,
  },
  play: async ({ args }) => {
    const sheet = within(await screen.findByRole("dialog", { name: "Filter Gardens" }));
    await expect(sheet.getByRole("searchbox", { name: "Search gardens" })).toHaveValue("São Paulo");
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
    await userEvent.type(sheet.getByRole("searchbox", { name: "Search gardens" }), "!");
    await expect(args.onSearchChange).toHaveBeenCalledWith("São Paulo!");
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
