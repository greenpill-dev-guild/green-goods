import { RiArrowRightSLine, RiLeafLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect } from "storybook/test";
import { withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import { AdminCard, AdminCardTitle } from "./AdminCard";

const meta: Meta<typeof AdminCard> = {
  title: "Admin/Primitives/AdminCard",
  component: AdminCard,
  tags: ["autodocs"],
  decorators: [withAdminPrimitiveFrame],
  parameters: {
    docs: {
      description: {
        component: [
          "**AdminCard** — the cockpit's card on the shared card surface (`.gg-card`,",
          "DL-102, DL-118). Elevated and outlined draw the installed app's card: its fill,",
          "a 1px edge, a faint shadow in light and the 24px corner. Filled keeps a tint on",
          "the same corner with no edge. Interactive cards add the neutral ink state",
          "layer and never lift.",
          "",
          "**Workspace tone** belongs to the canvas, not the card: inside a",
          '`[data-tone="hub|garden|community|actions"]` scope the card keeps its surface.',
        ].join("\n"),
      },
    },
    a11y: {
      config: {
        rules: [
          { id: "color-contrast", enabled: true },
          { id: "region", enabled: true },
        ],
      },
    },
  },
  argTypes: {
    variant: { control: "select", options: ["filled", "elevated", "outlined"] },
    interactive: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof AdminCard>;

const SampleContent = () => (
  <div className="flex items-start gap-3">
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--m3-shape-full)] bg-[rgb(var(--m3-primary-container))] text-[rgb(var(--m3-on-primary-container))]">
      <RiLeafLine className="h-5 w-5" aria-hidden />
    </span>
    <div className="min-w-0 flex-1 space-y-1">
      <div className="type-title-sm text-[rgb(var(--m3-on-surface))]">Pending review</div>
      <div className="type-body text-[rgb(var(--m3-on-surface-variant))]">
        14 submissions waiting, oldest 3 days.
      </div>
    </div>
  </div>
);

export const Elevated: Story = {
  args: { variant: "elevated", interactive: false },
  render: (args) => (
    <AdminCard {...args} className="max-w-sm">
      <SampleContent />
    </AdminCard>
  ),
};

export const CardTitle: Story = {
  render: () => (
    <AdminCard className="max-w-sm">
      <AdminCardTitle>Pool Status</AdminCardTitle>
      <p className="mt-2 type-body text-text-sub">A card title shares one scale across admin.</p>
    </AdminCard>
  ),
};

export const Filled: Story = {
  args: { variant: "filled" },
  render: (args) => (
    <AdminCard {...args} className="max-w-sm">
      <SampleContent />
    </AdminCard>
  ),
};

/** The outline is the shared card's 1px edge (DL-102); the play test checks it draws. */
export const Outlined: Story = {
  tags: ["storybook-ci"],
  args: { variant: "outlined" },
  render: (args) => (
    <AdminCard {...args} className="max-w-sm">
      <SampleContent />
    </AdminCard>
  ),
  play: async ({ canvasElement }) => {
    const card = canvasElement.querySelector('[data-component="AdminCard"]');
    await expect(card).not.toBeNull();
    const edge = getComputedStyle(card as Element);
    await expect(edge.borderTopWidth).toBe("1px");
    await expect(edge.borderTopStyle).toBe("solid");
  },
};

export const Interactive: Story = {
  args: { variant: "elevated", interactive: true },
  render: (args) => (
    <AdminCard {...args} className="max-w-sm">
      <div className="flex items-center justify-between gap-4">
        <SampleContent />
        <RiArrowRightSLine
          className="h-6 w-6 shrink-0 text-[rgb(var(--m3-on-surface-variant))]"
          aria-hidden
        />
      </div>
    </AdminCard>
  ),
};

/** Every variant is the shared card (DL-118): the 24px corner, and an edge on all but filled. */
export const StateCatalog: Story = {
  tags: ["storybook-ci"],
  play: async ({ canvasElement }) => {
    const cards = [...canvasElement.querySelectorAll('[data-component="AdminCard"]')];
    await expect(cards).toHaveLength(3);
    for (const card of cards) {
      await expect(card).toHaveClass("gg-card");
      await expect(getComputedStyle(card).borderTopLeftRadius).toBe("24px");
    }
    const [filled, elevated, outlined] = cards.map((card) => getComputedStyle(card));
    await expect(filled?.borderTopWidth).toBe("0px");
    await expect(elevated?.borderTopWidth).toBe("1px");
    await expect(outlined?.borderTopWidth).toBe("1px");
  },
  render: () => (
    <div className="grid gap-4 md:grid-cols-3">
      {(["filled", "elevated", "outlined"] as const).map((variant) => (
        <AdminCard key={variant} variant={variant}>
          <div className="space-y-2">
            <div className="type-label capitalize text-[rgb(var(--m3-on-surface))]">{variant}</div>
            <div className="type-body text-[rgb(var(--m3-on-surface-variant))]">
              Surface, shape, and elevation remain visible inside the admin canvas.
            </div>
          </div>
        </AdminCard>
      ))}
    </div>
  ),
};

/**
 * The same elevated card inside each `[data-tone]` scope: the card keeps its
 * surface, because workspace tone belongs to the canvas (Controlled Chrome).
 */
export const WithToneWash: Story = {
  render: () => (
    <div className="grid gap-4 md:grid-cols-2">
      {(["hub", "garden", "community", "actions"] as const).map((tone) => (
        <div key={tone} data-tone={tone} className="rounded-2xl bg-bg-white-0 p-4">
          <div className="mb-2 type-label-sm font-semibold uppercase tracking-[0.06em] text-text-soft">
            [data-tone=&quot;{tone}&quot;]
          </div>
          <AdminCard variant="elevated">
            <SampleContent />
          </AdminCard>
        </div>
      ))}
    </div>
  ),
};
