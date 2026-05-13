import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { withAdminPrimitiveFrame } from "../../../.storybook/decorators";
import { FormField } from "./FormFieldWrapper";
import { NativeSelect, Switch, Textarea, TextInput } from "./ControlPrimitives";

function ControlPrimitiveCatalog() {
  const [joiningOpen, setJoiningOpen] = useState(true);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="space-y-4">
        <div>
          <h2 className="text-title-sm font-semibold text-[rgb(var(--m3-on-surface))]">
            Admin surface
          </h2>
          <p className="text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
            Shared controls with the admin surface preset.
          </p>
        </div>
        <FormField label="Action title" htmlFor="admin-control-title">
          <TextInput
            id="admin-control-title"
            surface="admin"
            defaultValue="Canopy baseline"
            aria-label="Action title"
          />
        </FormField>
        <FormField label="Review state" htmlFor="admin-control-state">
          <NativeSelect id="admin-control-state" surface="admin" defaultValue="pending">
            <option value="pending">Pending review</option>
            <option value="approved">Approved</option>
            <option value="changes">Needs changes</option>
          </NativeSelect>
        </FormField>
        <FormField label="Operator note" htmlFor="admin-control-note">
          <Textarea
            id="admin-control-note"
            surface="admin"
            defaultValue="Verify image evidence before certification."
            rows={3}
          />
        </FormField>
        <div className="flex items-center justify-between gap-4 rounded-[var(--m3-shape-sm)] border border-[rgb(var(--m3-outline-variant))] p-3">
          <div>
            <p className="text-label-lg text-[rgb(var(--m3-on-surface))]">Open joining</p>
            <p className="text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
              Allow members to join without invitation.
            </p>
          </div>
          <Switch
            surface="admin"
            checked={joiningOpen}
            onCheckedChange={setJoiningOpen}
            aria-label="Open joining"
          />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-title-sm font-semibold text-[rgb(var(--m3-on-surface))]">States</h2>
          <p className="text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
            Disabled, compact, and invalid states for route forms.
          </p>
        </div>
        <FormField label="Disabled amount" htmlFor="admin-control-disabled">
          <TextInput
            id="admin-control-disabled"
            surface="admin"
            disabled
            defaultValue="0.25"
            aria-label="Disabled amount"
          />
        </FormField>
        <FormField
          label="Invalid amount"
          htmlFor="admin-control-invalid"
          error="Enter a valid decimal amount"
        >
          <TextInput
            id="admin-control-invalid"
            surface="admin"
            defaultValue="abc"
            invalid
            aria-invalid="true"
            aria-describedby="admin-control-invalid-helper-text"
          />
        </FormField>
        <FormField label="Compact cooldown" htmlFor="admin-control-compact">
          <NativeSelect
            id="admin-control-compact"
            surface="admin"
            controlSize="sm"
            defaultValue="86400"
          >
            <option value="3600">1h</option>
            <option value="86400">1d</option>
            <option value="604800">7d</option>
          </NativeSelect>
        </FormField>
        <div className="flex items-center gap-3">
          <Switch surface="admin" checked={false} disabled aria-label="Disabled switch" />
          <span className="text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
            Disabled switch
          </span>
        </div>
      </section>
    </div>
  );
}

const meta: Meta<typeof ControlPrimitiveCatalog> = {
  title: "Shared/Form/ControlPrimitives",
  component: ControlPrimitiveCatalog,
  decorators: [withAdminPrimitiveFrame],
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Shared input, select, textarea, and switch primitives with an admin-surface preset for admin route forms.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ControlPrimitiveCatalog>;

export const StateCatalog: Story = {};

export const FocusedTopInputMobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
  render: () => (
    <section className="w-[320px] max-w-full space-y-4 rounded-[var(--m3-shape-md)] border border-[rgb(var(--m3-outline-variant))] p-3">
      <FormField
        label="Long campaign amount label that still wraps cleanly"
        htmlFor="focused-top-input"
        hint="This field sits at the top of a dense route section."
      >
        <TextInput id="focused-top-input" surface="admin" defaultValue="0.25" />
      </FormField>
      <FormField
        label="Manual allowlist review note"
        htmlFor="focused-top-textarea"
        error="Enter at least one valid operator address."
      >
        <Textarea
          id="focused-top-textarea"
          surface="admin"
          invalid
          defaultValue="0x0000"
          rows={3}
        />
      </FormField>
    </section>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = await canvas.findByLabelText(
      "Long campaign amount label that still wraps cleanly"
    );
    await userEvent.click(input);
    await expect(input).toHaveFocus();
  },
};
