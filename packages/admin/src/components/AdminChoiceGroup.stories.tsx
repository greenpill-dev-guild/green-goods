import { RiComputerLine, RiMoonLine, RiSeedlingLine, RiSunLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { AdminChoiceGroup } from "./AdminChoiceGroup";

const meta: Meta<typeof AdminChoiceGroup> = {
  title: "Admin/Primitives/AdminChoiceGroup",
  component: AdminChoiceGroup,
  tags: ["autodocs", "storybook-ci"],
  parameters: {
    docs: {
      description: {
        component:
          "Compact single-select radio group for simple admin preferences and context switches. Use AdminSelectableCard for richer card choices, AdminTabRail for view modes, and AdminFilterChip for toolbar filters.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AdminChoiceGroup>;

function ThemeExample() {
  const [theme, setTheme] = useState("system");
  return (
    <AdminChoiceGroup
      ariaLabel="Theme"
      value={theme}
      onChange={setTheme}
      columns={3}
      options={[
        {
          value: "light",
          label: "Light",
          leadingVisual: <RiSunLine className="h-4 w-4" aria-hidden="true" />,
        },
        {
          value: "dark",
          label: "Dark",
          leadingVisual: <RiMoonLine className="h-4 w-4" aria-hidden="true" />,
        },
        {
          value: "system",
          label: "System",
          leadingVisual: <RiComputerLine className="h-4 w-4" aria-hidden="true" />,
        },
      ]}
    />
  );
}

function GardenExample() {
  const [garden, setGarden] = useState("milpa");
  return (
    <AdminChoiceGroup
      ariaLabel="Your gardens"
      value={garden}
      onChange={setGarden}
      options={[
        {
          value: "milpa",
          label: "Milpa Alta",
          leadingVisual: <RiSeedlingLine className="h-4 w-4" aria-hidden="true" />,
        },
        {
          value: "rainforest",
          label: "Rainforest Commons",
          leadingVisual: <RiSeedlingLine className="h-4 w-4" aria-hidden="true" />,
        },
      ]}
    />
  );
}

export const ThemeChoices: Story = {
  render: () => <ThemeExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("radiogroup", { name: "Theme" })).toBeVisible();
    await userEvent.click(canvas.getByRole("radio", { name: "Dark" }));
    await expect(canvas.getByRole("radio", { name: "Dark" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  },
};

export const ContextSwitchList: Story = {
  render: () => <GardenExample />,
};
