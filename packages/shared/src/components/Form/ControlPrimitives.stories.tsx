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
        <FormField label="Steward note" htmlFor="admin-control-note">
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

/**
 * The client field scale: a 16px rounded rectangle at sm 40, md 44, lg 48 (DL-022,
 * DL-023), and the public site's editorial underline field (DL-024). Display-size
 * text keeps the field's height, and a small select keeps its chevron lane.
 */
export const DefaultSurfaceSizes: Story = {
  tags: ["storybook-ci"],
  render: () => (
    <section className="flex w-[320px] max-w-full flex-col gap-3 bg-bg-white-0 p-3 text-text-strong-950">
      <TextInput aria-label="Small field" controlSize="sm" placeholder="sm · 40px" />
      <TextInput aria-label="Medium field" placeholder="md · 44px" />
      <TextInput aria-label="Large field" controlSize="lg" placeholder="lg · 48px" />
      <NativeSelect aria-label="Medium select" defaultValue="all">
        <option value="all">All Gardens</option>
      </NativeSelect>
      <NativeSelect
        aria-label="Small select"
        controlSize="sm"
        defaultValue="month"
        className="w-auto"
      >
        <option value="day">Day</option>
        <option value="month">Month</option>
      </NativeSelect>
      <TextInput aria-label="Invalid field" invalid defaultValue="0x00" />
      <TextInput aria-label="Editorial field" surface="editorial" placeholder="you@example.com" />
      <TextInput aria-label="Display amount" className="font-serif text-2xl" defaultValue="25.00" />
      <TextInput
        aria-label="Editorial display field"
        surface="editorial"
        className="text-2xl"
        placeholder="you@example.com"
      />
    </section>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const radius = (element: HTMLElement) =>
      Number.parseFloat(getComputedStyle(element).borderTopLeftRadius);
    for (const [name, height] of [
      ["Small field", 40],
      ["Medium field", 44],
      ["Large field", 48],
    ] as const) {
      const field = canvas.getByRole("textbox", { name });
      await expect(field.getBoundingClientRect().height).toBe(height);
      await expect(radius(field)).toBe(16);
    }
    await expect(radius(canvas.getByRole("combobox", { name: "Medium select" }))).toBe(16);
    await expect(radius(canvas.getByRole("textbox", { name: "Editorial field" }))).toBe(0);
    // A 24px serif value sits inside the 44px step instead of growing the field.
    for (const name of ["Display amount", "Editorial display field"]) {
      await expect(canvas.getByRole("textbox", { name }).getBoundingClientRect().height).toBe(44);
    }
    const smallSelect = canvas.getByRole("combobox", { name: "Small select" });
    await expect(getComputedStyle(smallSelect).paddingRight).toBe("36px");
  },
};

/**
 * Header-row filters take the compact size: a 32px face, the height of the
 * compact buttons beside them, sized to the chosen option with the condensed
 * density's 64px floor (DL-032). The select keeps the 48px tap area (DL-023):
 * its own box takes the taps above and below the face, so the row still lays
 * out a 32px control.
 */
export const CompactHeaderFilters: Story = {
  tags: ["storybook-ci"],
  render: () => (
    <section className="w-[360px] max-w-full bg-bg-white-0 p-4 text-text-strong-950">
      <div className="flex min-h-10 items-center gap-2" data-testid="header-row">
        <p className="shrink-0 whitespace-nowrap text-sm text-text-sub-600">7 live</p>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <NativeSelect
            aria-label="Status"
            controlSize="compact"
            density="condensed"
            className="w-auto min-w-16 max-w-48 field-sizing-content"
            defaultValue="live"
          >
            <option value="live">Live</option>
            <option value="settled">Settled</option>
            <option value="all">All</option>
          </NativeSelect>
          <NativeSelect
            aria-label="Kind"
            controlSize="compact"
            density="condensed"
            className="w-auto min-w-16 max-w-48 field-sizing-content"
            defaultValue="all"
          >
            <option value="all">All kinds</option>
            <option value="offers">Offers</option>
            <option value="requests">Requests</option>
          </NativeSelect>
        </div>
      </div>
    </section>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const select = canvas.getByRole("combobox", { name: "Status" });
    const style = getComputedStyle(select);
    const box = select.getBoundingClientRect();
    const borderTop = Number.parseFloat(style.borderTopWidth);
    const face = box.height - borderTop - Number.parseFloat(style.borderBottomWidth);

    await expect(face).toBe(32);
    await expect(box.height).toBe(48);
    // The row lays out a 32px control, so the 40px header row keeps its height.
    await expect(canvas.getByTestId("header-row").getBoundingClientRect().height).toBe(40);
    // A tap 6px above the visible face still lands on the select.
    const hit = canvasElement.ownerDocument.elementFromPoint(
      box.left + box.width / 2,
      box.top + borderTop - 6
    );
    await expect(hit).toBe(select);
  },
};

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
        error="Enter at least one valid steward address."
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
