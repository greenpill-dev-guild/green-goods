import { RiCheckLine, RiCloseLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect } from "storybook/test";
import tokens from "../../styles/design-md.generated.json";
import { Badge, CountBadge } from "./Badge";

const meta: Meta<typeof Badge> = {
  title: "Shared/Primitives/Badge",
  component: Badge,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["transparent", "pill", "outline"],
      description: "Visual variant of the badge",
    },
    tint: {
      control: "select",
      options: [
        "primary",
        "secondary",
        "tertiary",
        "accent",
        "destructive",
        "black",
        "muted",
        "none",
      ],
      description: "Color tint of the badge",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: {
    children: "Badge",
    variant: "transparent",
    tint: "none",
  },
};

export const Pill: Story = {
  args: {
    children: "Pill Badge",
    variant: "pill",
    tint: "primary",
  },
};

export const Outline: Story = {
  args: {
    children: "Outline",
    variant: "outline",
  },
};

export const WithLeadingIcon: Story = {
  args: {
    children: "Success",
    variant: "pill",
    tint: "primary",
    leadingIcon: <RiCheckLine className="w-4 h-4" />,
  },
};

export const WithTrailingIcon: Story = {
  args: {
    children: "Dismiss",
    variant: "pill",
    tint: "destructive",
    trailingIcon: <RiCloseLine className="w-4 h-4" />,
  },
};

export const AllTints: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="pill" tint="primary">
        Primary
      </Badge>
      <Badge variant="pill" tint="secondary">
        Secondary
      </Badge>
      <Badge variant="pill" tint="tertiary">
        Tertiary
      </Badge>
      <Badge variant="pill" tint="accent">
        Accent
      </Badge>
      <Badge variant="pill" tint="destructive">
        Destructive
      </Badge>
      <Badge variant="pill" tint="black">
        Black
      </Badge>
      <Badge variant="pill" tint="muted">
        Muted
      </Badge>
    </div>
  ),
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="transparent">Transparent</Badge>
      <Badge variant="pill" tint="primary">
        Pill
      </Badge>
      <Badge variant="outline">Outline</Badge>
    </div>
  ),
};

export const DarkMode: Story = {
  args: {
    children: "Badge",
    variant: "pill",
    tint: "primary",
  },
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4">
        <Story />
      </div>
    ),
  ],
};

const COUNT_LADDER = [1, 9, 10, 99, 100];

/** The one count badge (F10) at every width it takes, beside a label and on a control's edge. */
export const Count: Story = {
  tags: ["storybook-ci"],
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        {COUNT_LADDER.map((count) => (
          <CountBadge key={count} count={count} />
        ))}
      </div>
      <div className="flex items-center gap-3">
        {COUNT_LADDER.map((count) => (
          <CountBadge key={count} count={count} ring />
        ))}
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // A single digit still takes the full 16px capsule, set in the count role DESIGN.md declares.
    const badge = canvasElement.querySelector<HTMLElement>(".gg-count-badge");
    if (!badge) throw new Error("No count badge rendered");
    const style = getComputedStyle(badge);
    const { count } = tokens.typography;
    await expect(style.fontSize).toBe(count.fontSize);
    await expect(style.lineHeight).toBe(count.lineHeight);
    await expect(Number(style.fontWeight)).toBe(count.fontWeight);
    const box = badge.getBoundingClientRect();
    await expect(box.height).toBe(16);
    await expect(box.width).toBeGreaterThanOrEqual(16);
  },
};

/** In the cockpit the badge takes each workspace tone's action pair. */
export const CountInCockpitTones: Story = {
  parameters: { surface: "admin" },
  render: () => (
    <div className="flex flex-col gap-3">
      {["hub", "garden", "community", "actions"].map((tone) => (
        <div key={tone} data-tone={tone} className="flex items-center gap-3">
          {COUNT_LADDER.map((count) => (
            <CountBadge key={count} count={count} />
          ))}
        </div>
      ))}
    </div>
  ),
};
