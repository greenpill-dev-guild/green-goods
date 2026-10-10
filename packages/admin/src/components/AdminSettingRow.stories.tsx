import { Switch } from "@green-goods/shared/components/Form/ControlPrimitives";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, within } from "storybook/test";
import { withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import { AdminSettingRow } from "./AdminSettingRow";

const meta: Meta<typeof AdminSettingRow> = {
  title: "Admin/Primitives/AdminSettingRow",
  component: AdminSettingRow,
  tags: ["autodocs"],
  decorators: [withAdminPrimitiveFrame],
  parameters: {
    docs: {
      description: {
        component:
          "A field title (left) paired with a trailing control (right) — the inline setting-row grammar for toggles and compact controls in admin forms and dialogs. The title uses the shared FormField label treatment, so setting rows never read smaller or greyer than the stacked text fields beside them. Pass `labelId` and reference it from a Radix-style control's `aria-labelledby` (e.g. Switch).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AdminSettingRow>;

function ToggleRow({ description }: { description?: string }) {
  const [on, setOn] = useState(false);
  return (
    <div className="max-w-md">
      <AdminSettingRow labelId="open-joining" label="Open joining" description={description}>
        <Switch
          surface="admin"
          checked={on}
          onCheckedChange={setOn}
          aria-labelledby="open-joining"
        />
      </AdminSettingRow>
    </div>
  );
}

export const Default: Story = {
  render: () => <ToggleRow description="Allow anyone to join this garden without an invitation" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The title names the control by reference (aria-labelledby), so the switch
    // is reachable by its label — the core a11y guarantee of this primitive.
    const toggle = canvas.getByRole("switch", { name: "Open joining" });
    await expect(toggle).toHaveAttribute("aria-checked", "false");
  },
};

export const WithoutDescription: Story = {
  render: () => <ToggleRow />,
};

const ThemeBlock = ({ theme }: { theme: "light" | "dark" }) => (
  <section
    data-theme={theme}
    className="admin-m3 rounded-[var(--m3-shape-lg)] bg-[rgb(var(--m3-surface))] p-4"
  >
    <div className="mb-3 text-label-md font-semibold uppercase text-[rgb(var(--m3-on-surface-variant))]">
      {theme}
    </div>
    <div className="max-w-md space-y-4">
      <AdminSettingRow
        labelId={`oj-${theme}`}
        label="Open joining"
        description="Allow anyone to join this garden without an invitation"
      >
        <Switch
          surface="admin"
          checked
          onCheckedChange={() => {}}
          aria-labelledby={`oj-${theme}`}
        />
      </AdminSettingRow>
      <AdminSettingRow
        labelId={`lg-${theme}`}
        label="Limit gardeners"
        description="Cap how many gardeners can join. Off means unlimited."
      >
        <Switch
          surface="admin"
          checked={false}
          onCheckedChange={() => {}}
          aria-labelledby={`lg-${theme}`}
        />
      </AdminSettingRow>
    </div>
  </section>
);

export const ThemeMatrix: Story = {
  render: () => (
    <div className="space-y-4">
      <ThemeBlock theme="light" />
      <ThemeBlock theme="dark" />
    </div>
  ),
};
