import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { fn } from "storybook/test";
import { GardenChip } from "@green-goods/shared";
import { withAdminPrimitiveFrame } from "../../../../shared/.storybook/decorators";
import { AdminButton } from "../AdminButton";
import { AdminCard } from "../AdminCard";
import { AdminTabRail } from "../AdminTabRail";

/**
 * Tone gallery — verifies that the per-view `[data-tone]` scope wires through
 * GardenChip leaf, filled actions, neutral AdminTabRail state, and the
 * page-header bottom hairline. One cell per tone so designers can confirm at a glance.
 */
const meta: Meta = {
  title: "Admin/Layouts/Tone Gallery",
  decorators: [withAdminPrimitiveFrame],
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: [
          "**Tone Gallery** — `[data-tone]` consumption across the load-bearing",
          "admin primitives. Per `DESIGN_NOTES.md § Tone system`, tone touches:",
          "",
          "1. Canvas background (the wash on `.workspace-canvas[data-tone]`)",
          "2. GardenChip leaf icon (tone-tinted)",
          "3. Filled AdminButton action color",
          "4. PageHeader bottom hairline (`rgb(var(--tone-action) / 0.10)`)",
          "5. Neutral AdminTabRail and AdminCard surfaces",
          "",
          "Tone is supplemental — content readability and accessibility never",
          "depend on it. `var(--tone-action)` is a raw RGB triplet inside admin's",
          "scopes; falls back to brand green outside admin.",
        ].join("\n"),
      },
    },
    a11y: {
      config: {
        rules: [{ id: "color-contrast", enabled: true }],
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const TabsDemo = ({ tone }: { tone: string }) => {
  const [active, setActive] = useState("review");
  return (
    <AdminTabRail
      ariaLabel={`${tone} sections`}
      activeId={active}
      onChange={setActive}
      tabs={[
        { id: "review", label: "Review", count: 12 },
        { id: "assess", label: "Assess", count: 5 },
        { id: "certify", label: "Certify", count: 3 },
        { id: "history", label: "History" },
      ]}
    />
  );
};

const sampleGarden = [{ id: "g1", name: "Milpa Alta" }];

const ToneCell = ({
  tone,
  name,
}: {
  tone: "hub" | "garden" | "community" | "actions";
  name: string;
}) => (
  <section
    data-tone={tone}
    className="overflow-hidden rounded-2xl border border-stroke-soft bg-bg-white-0"
  >
    <header
      className="flex items-center justify-between border-b px-4 py-3"
      style={{ borderBottomColor: "rgb(var(--tone-action, 0 0 0) / 0.10)" }}
    >
      <div className="flex items-center gap-3">
        <GardenChip gardens={sampleGarden} selectedGarden={sampleGarden[0]} onSelectGarden={fn()} />
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-soft">
            {tone}
          </div>
          <div className="text-base font-semibold text-text-strong">{name}</div>
        </div>
      </div>
    </header>

    <div className="space-y-3 p-4">
      <TabsDemo tone={tone} />

      <AdminCard variant="elevated">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-text-strong">Pending review</div>
            <div className="text-xs text-text-sub">
              14 submissions waiting, oldest 3 days. Card material stays neutral.
            </div>
          </div>
          <AdminButton size="sm">Review queue</AdminButton>
        </div>
      </AdminCard>
    </div>
  </section>
);

const ToneGrid = ({ theme }: { theme: "light" | "dark" }) => (
  <section
    data-theme={theme}
    className="admin-m3 space-y-3 rounded-[var(--m3-shape-lg)] bg-[rgb(var(--m3-surface))] p-4"
  >
    <div className="text-label-md font-semibold uppercase text-[rgb(var(--m3-on-surface-variant))]">
      {theme}
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <ToneCell tone="hub" name="Hub" />
      <ToneCell tone="garden" name="Garden" />
      <ToneCell tone="community" name="Community" />
      <ToneCell tone="actions" name="Actions" />
    </div>
  </section>
);

export const VariantGallery: Story = {
  render: () => (
    <div className="space-y-4 p-6">
      <ToneGrid theme="light" />
      <ToneGrid theme="dark" />
    </div>
  ),
};
