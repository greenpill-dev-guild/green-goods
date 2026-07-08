import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import { AdminButton } from "./AdminButton";
import { AdminInlineField } from "./AdminInlineField";

const meta: Meta<typeof AdminInlineField> = {
  title: "Admin/Primitives/AdminInlineField",
  component: AdminInlineField,
  tags: ["autodocs"],
  decorators: [withAdminPrimitiveFrame],
  parameters: {
    docs: {
      description: {
        component:
          "Compact 40dp field paired with an inline action for 'enter one short value and submit' rows (register a hypercert/action id, add a strategy address). External M3 label keeps the input aligned on the same axis as the AdminButton; error text sits below both controls so it never nudges the button.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AdminInlineField>;

function RegisterRow({ initialError }: { initialError?: string }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(initialError ?? "");
  return (
    <div className="max-w-md">
      <AdminInlineField
        label="Hypercert token ID"
        value={value}
        onChange={(next) => {
          setValue(next);
          setError("");
        }}
        onSubmit={() => {
          if (!value.trim()) setError("Enter a hypercert token ID.");
        }}
        placeholder="e.g. 12"
        inputMode="numeric"
        error={error || undefined}
        action={
          <AdminButton
            type="button"
            variant="filled"
            onClick={() => {
              if (!value.trim()) setError("Enter a hypercert token ID.");
            }}
            disabled={!value.trim()}
          >
            Register
          </AdminButton>
        }
      />
    </div>
  );
}

export const Default: Story = {
  render: () => <RegisterRow />,
};

export const WithError: Story = {
  render: () => <RegisterRow initialError="Enter a valid hypercert token ID." />,
};

export const AlignsWithButton: Story = {
  render: () => <RegisterRow />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox", { name: "Hypercert token ID" });
    const button = canvas.getByRole("button", { name: "Register" });
    // The compact field and its action share the same 40dp height, so their
    // vertical centers line up — the core alignment guarantee of this primitive.
    const inputBox = input.getBoundingClientRect();
    const buttonBox = button.getBoundingClientRect();
    await expect(Math.abs(inputBox.height - buttonBox.height)).toBeLessThanOrEqual(1);
    await userEvent.type(input, "12");
    await expect(input).toHaveValue("12");
  },
};

const WORKSPACE_TONES = [
  ["hub", "Hub"],
  ["garden", "Garden"],
  ["community", "Community"],
  ["actions", "Actions"],
] as const;

const InlineFieldToneMatrix = ({ theme }: { theme: "light" | "dark" }) => (
  <section
    data-theme={theme}
    className="admin-m3 rounded-[var(--m3-shape-lg)] bg-[rgb(var(--m3-surface))] p-4"
  >
    <div className="mb-3 text-label-md font-semibold uppercase text-[rgb(var(--m3-on-surface-variant))]">
      {theme}
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      {WORKSPACE_TONES.map(([tone, label]) => (
        <div
          key={`${theme}-${tone}`}
          data-tone={tone}
          className="rounded-[var(--m3-shape-md)] border border-[rgb(var(--m3-outline-variant))] bg-[rgb(var(--m3-surface-container-low))] p-3"
        >
          <div className="mb-2 text-label-md font-medium text-[rgb(var(--m3-on-surface-variant))]">
            {label}
          </div>
          <AdminInlineField
            label="Hypercert token ID"
            value=""
            onChange={() => {}}
            placeholder="e.g. 12"
            action={
              <AdminButton type="button" variant="filled">
                Register
              </AdminButton>
            }
          />
        </div>
      ))}
    </div>
  </section>
);

export const WorkspaceToneMatrix: Story = {
  render: () => (
    <div className="space-y-4">
      <InlineFieldToneMatrix theme="light" />
      <InlineFieldToneMatrix theme="dark" />
    </div>
  ),
};
