import type { Meta, StoryObj } from "@storybook/react";
import { withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import { AdminLinearProgress } from "./AdminLinearProgress";

const meta: Meta<typeof AdminLinearProgress> = {
  title: "Admin/Primitives/AdminLinearProgress",
  component: AdminLinearProgress,
  tags: ["autodocs"],
  decorators: [withAdminPrimitiveFrame],
  parameters: {
    docs: {
      description: {
        component: [
          "**AdminLinearProgress** — M3 linear progress. Determinate when `value`",
          "is provided (0–100), indeterminate when `value` is undefined. 4dp",
          "track height, M3 surface/primary roles.",
          "",
          "**Tone-aware** — the active fill consumes `var(--tone-action,",
          "var(--m3-primary))` so the bar tints to the active workspace.",
          "",
          '**Accessibility**: `role="progressbar"` with `aria-valuenow` /',
          "`aria-valuemin` / `aria-valuemax`. Always pass `ariaLabel`.",
        ].join("\n"),
      },
    },
    a11y: {
      config: {
        rules: [
          { id: "aria-valid-attr-value", enabled: true },
          { id: "color-contrast", enabled: true },
        ],
      },
    },
  },
  argTypes: {
    value: { control: { type: "range", min: 0, max: 100, step: 1 } },
  },
};

export default meta;
type Story = StoryObj<typeof AdminLinearProgress>;

export const Indeterminate: Story = {
  args: { ariaLabel: "Syncing submissions" },
  render: (args) => (
    <div className="max-w-xl">
      <AdminLinearProgress {...args} />
    </div>
  ),
};

export const Determinate: Story = {
  args: { value: 65, ariaLabel: "Upload progress" },
  render: (args) => (
    <div className="max-w-xl">
      <AdminLinearProgress {...args} />
    </div>
  ),
};

export const StateCatalog: Story = {
  render: () => (
    <div className="max-w-xl space-y-5">
      <div className="space-y-2">
        <div className="text-label-lg text-[rgb(var(--m3-on-surface))]">Indeterminate</div>
        <AdminLinearProgress ariaLabel="Loading work queue" />
      </div>
      {[0, 25, 50, 75, 100].map((value) => (
        <div key={value} className="space-y-2">
          <div className="text-label-lg text-[rgb(var(--m3-on-surface-variant))]">
            {value} percent
          </div>
          <AdminLinearProgress value={value} ariaLabel={`${value} percent complete`} />
        </div>
      ))}
    </div>
  ),
};

/**
 * Tone matrix — same 50% determinate bar rendered inside each `[data-tone]`
 * scope so the tone-action fill can be verified across all four workspaces.
 */
export const ToneMatrix: Story = {
  render: () => (
    <div className="grid max-w-3xl gap-4 md:grid-cols-2">
      {(["hub", "garden", "community", "actions"] as const).map((tone) => (
        <div
          key={tone}
          data-tone={tone}
          className="space-y-2 rounded-2xl border border-stroke-soft bg-bg-white-0 p-4"
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-soft">
            [data-tone="{tone}"]
          </div>
          <AdminLinearProgress value={50} ariaLabel={`${tone} progress 50 percent`} />
        </div>
      ))}
    </div>
  ),
};
