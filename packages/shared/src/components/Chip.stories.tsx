import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { Chip } from "./Chip";

const meta = {
  title: "Shared/Primitives/Chip",
  component: Chip,
  tags: ["autodocs", "storybook-ci"],
  parameters: {
    docs: {
      description: {
        component:
          "A capsule toggle for filters and choices (DL-021): 32px with a 44px hit area. A selected chip uses the action fill with white text (DL-017) and announces itself with aria-pressed, or aria-checked / aria-selected when it plays a radio or tab role.",
      },
    },
  },
  args: { children: "Offers" },
} satisfies Meta<typeof Chip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unselected: Story = {
  play: async ({ canvasElement }) => {
    const chip = within(canvasElement).getByRole("button", { name: "Offers" });
    await expect(chip.getBoundingClientRect().height).toBe(32);
    // A capsule: the corner is at least half the height (the browser clamps the full radius).
    await expect(
      Number.parseFloat(getComputedStyle(chip).borderTopLeftRadius)
    ).toBeGreaterThanOrEqual(16);
    await expect(Number.parseFloat(getComputedStyle(chip, "::after").height)).toBe(44);
  },
};

export const Selected: Story = {
  args: { selected: true },
};

function FilterRow() {
  const filters = ["All", "Offers", "Requests"];
  const [active, setActive] = useState("All");
  return (
    <div className="flex gap-2">
      {filters.map((filter) => (
        <Chip key={filter} selected={active === filter} onClick={() => setActive(filter)}>
          {filter}
        </Chip>
      ))}
    </div>
  );
}

export const FilterToggle: Story = {
  render: () => <FilterRow />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await userEvent.click(canvas.getByRole("button", { name: "Requests" }));
    await expect(canvas.getByRole("button", { name: "Requests" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(canvas.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  },
};

export const RadioGroup: Story = {
  render: () => (
    <div role="radiogroup" aria-label="Asset" className="flex gap-2">
      <Chip role="radio" aria-checked selected>
        DAI
      </Chip>
      <Chip role="radio" aria-checked={false}>
        WETH
      </Chip>
    </div>
  ),
};
