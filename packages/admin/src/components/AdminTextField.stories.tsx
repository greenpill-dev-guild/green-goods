import { RiMailLine, RiSearchLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import { AdminSelect, AdminTextArea, AdminTextField } from "./AdminTextField";

const meta: Meta<typeof AdminTextField> = {
  title: "Admin/Primitives/AdminTextField",
  component: AdminTextField,
  tags: ["autodocs"],
  decorators: [withAdminPrimitiveFrame],
  parameters: {
    docs: {
      description: {
        component:
          "The cockpit's text field, in the installed app's anatomy (F3): the label above, an outlined box at the cockpit's 8px corner on the responsive tier (44px with 16px text on touch widths, 40px with 14px from 640px), icon slots, and the message line under it, which reserves two lines for a hint, an error or a character count.",
      },
    },
  },
  argTypes: {
    required: { control: "boolean" },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof AdminTextField>;

export const Default: Story = {
  args: { label: "Garden name", placeholder: "e.g., Rio Claro" },
  render: (args) => (
    <div className="max-w-sm">
      <AdminTextField {...args} />
    </div>
  ),
};

export const WithLeadingIcon: Story = {
  args: {
    label: "Search",
    leadingIcon: RiSearchLine,
    placeholder: "Search gardens",
  },
  render: (args) => (
    <div className="max-w-sm">
      <AdminTextField {...args} />
    </div>
  ),
};

export const Error: Story = {
  args: {
    label: "Email address",
    defaultValue: "not-an-email",
    error: "Enter a valid email address.",
    leadingIcon: RiMailLine,
  },
  render: (args) => (
    <div className="max-w-sm">
      <AdminTextField {...args} />
    </div>
  ),
};

export const StateCatalog: Story = {
  render: () => (
    <div className="grid max-w-3xl gap-5 sm:grid-cols-2">
      <AdminTextField label="Empty" />
      <AdminTextField label="With a placeholder" placeholder="e.g., Rio Claro" />
      <AdminTextField label="With a value" defaultValue="North Meadow" />
      <AdminTextField label="Required field" required />
      <AdminTextField
        label="Email address"
        helperText="Used for garden invitations."
        leadingIcon={RiMailLine}
      />
      <AdminTextField
        label="Invalid email"
        defaultValue="not-an-email"
        error="Enter a valid email address."
        leadingIcon={RiMailLine}
      />
      <AdminTextField label="Chain ID" defaultValue="11155111" disabled />
      <AdminTextField label="Garden name, counted" showCount inputProps={{ maxLength: 60 }} />
    </div>
  ),
};

/**
 * The label sits above the outlined box, so it never covers a placeholder, a
 * value or a select's option text, and focus redraws the ring without moving
 * anything. Runs in addon-vitest browser mode, where real layout applies.
 */
export const LabelAboveGeometry: Story = {
  tags: ["storybook-ci"],
  render: () => (
    <div className="grid max-w-3xl items-start gap-5 sm:grid-cols-2">
      <AdminTextField label="Search" placeholder="Search by title" />
      <AdminTextArea label="Description" placeholder="Describe the work in the garden" />
      <AdminTextField label="Garden name" defaultValue="North Meadow" />
      <AdminSelect label="Role" defaultValue="gardener">
        <option value="gardener">Gardener</option>
        <option value="evaluator">Evaluator</option>
      </AdminSelect>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const boxOf = (control: HTMLElement) =>
      control.closest<HTMLElement>('[data-region="field-container"]');
    const controls = [
      canvas.getByRole("textbox", { name: "Search" }),
      canvas.getByRole("textbox", { name: "Description" }),
      canvas.getByRole("textbox", { name: "Garden name" }),
      canvas.getByRole("combobox", { name: "Role" }),
    ];

    for (const control of controls) {
      const box = boxOf(control);
      const label = canvasElement.querySelector<HTMLElement>(`label[for="${control.id}"]`);
      await expect(box).not.toBeNull();
      await expect(label).not.toBeNull();
      if (!box || !label) continue;
      await expect(label.getBoundingClientRect().bottom).toBeLessThanOrEqual(
        box.getBoundingClientRect().top
      );
    }

    // A single-line field is exactly its tier: 44px on touch widths, 40px from 640px.
    const nameBox = boxOf(canvas.getByRole("textbox", { name: "Garden name" }));
    const tier = window.innerWidth < 640 ? 44 : 40;
    await expect(Math.round(nameBox?.getBoundingClientRect().height ?? 0)).toBe(tier);

    // Focus thickens the ring inside the box, so the field keeps its height.
    const search = canvas.getByRole("textbox", { name: "Search" });
    const searchField = search.closest<HTMLElement>("[data-component]");
    const before = searchField?.getBoundingClientRect().height;
    await userEvent.click(search);
    await expect(search).toHaveFocus();
    await expect(searchField?.getBoundingClientRect().height).toBe(before);
  },
};

const ROLE_OPTIONS = (
  <>
    <option value="">Choose a role</option>
    <option value="gardener">Gardener</option>
    <option value="evaluator">Evaluator</option>
  </>
);

const LONG_MESSAGE =
  "Shorten this to the length the contract accepts: accented letters count as two, and some symbols count as more, so a name that looks short can still be too long to save.";

/**
 * The line under a field is reserved, so a message arriving moves nothing below it
 * (D10). Checked in browser mode, where real layout applies: a text field, a text
 * area and a select are each the same height with no message, a helper, a one-line
 * error, and (for the text field) a counter. Heights are compared with each other,
 * never with a number, so the check reads the same at any text size or font. A
 * message longer than the reserve grows the line rather than scrolling inside it.
 */
export const MessageHoldsTheLine: Story = {
  tags: ["storybook-ci"],
  render: () => (
    // items-start: a grid row would otherwise stretch a field to its tallest neighbour.
    <div className="grid max-w-3xl items-start gap-5 sm:grid-cols-3">
      <AdminTextField label="Name, no message" />
      <AdminTextField label="Name, helper" helperText="Shown on the garden's page." />
      <AdminTextField label="Name, error" error="Enter a name." />
      <AdminTextArea label="Reason, no message" />
      <AdminTextArea label="Reason, helper" helperText="Members read this." />
      <AdminTextArea label="Reason, error" error="Give a reason." />
      <AdminSelect label="Role, no message" defaultValue="gardener">
        {ROLE_OPTIONS}
      </AdminSelect>
      <AdminSelect label="Role, helper" defaultValue="gardener" helperText="Sets what they can do.">
        {ROLE_OPTIONS}
      </AdminSelect>
      <AdminSelect label="Role, error" defaultValue="" error="Pick a role.">
        {ROLE_OPTIONS}
      </AdminSelect>
      <AdminTextField label="Name, counted" showCount inputProps={{ maxLength: 60 }} />
      <AdminTextField label="Name, long error" error={LONG_MESSAGE} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const fieldOf = (role: "textbox" | "combobox", name: string) => {
      const control = canvas.getByRole(role, { name });
      return control.closest<HTMLElement>("[data-component]") ?? control;
    };
    const heightOf = (role: "textbox" | "combobox", name: string) =>
      fieldOf(role, name).getBoundingClientRect().height;
    const cases = [
      ["textbox", "Name", ["helper", "error", "counted"]],
      ["textbox", "Reason", ["helper", "error"]],
      ["combobox", "Role", ["helper", "error"]],
    ] as const;

    for (const [role, field, states] of cases) {
      const plain = heightOf(role, `${field}, no message`);
      for (const state of states) {
        await expect(Math.abs(heightOf(role, `${field}, ${state}`) - plain)).toBeLessThan(0.5);
      }
    }

    // Past the reserve the line grows, and never scrolls what it holds.
    const longLine = fieldOf("textbox", "Name, long error").querySelector<HTMLElement>(
      '[data-region="supporting-line"]'
    );
    await expect(heightOf("textbox", "Name, long error")).toBeGreaterThan(
      heightOf("textbox", "Name, no message")
    );
    await expect(longLine?.scrollHeight).toBe(longLine?.clientHeight);
  },
};

const WORKSPACE_TONES = [
  ["hub", "Hub"],
  ["garden", "Garden"],
  ["community", "Community"],
  ["actions", "Actions"],
] as const;

const TextFieldToneMatrix = ({ theme }: { theme: "light" | "dark" }) => (
  <section
    data-theme={theme}
    className="admin-m3 rounded-[var(--m3-shape-lg)] bg-[rgb(var(--m3-surface))] p-4"
  >
    <div className="mb-3 type-label-sm font-semibold uppercase text-[rgb(var(--m3-on-surface-variant))]">
      {theme}
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      {WORKSPACE_TONES.map(([tone, label]) => (
        <div
          key={`${theme}-${tone}`}
          data-tone={tone}
          className="space-y-3 rounded-[var(--m3-shape-md)] border border-[rgb(var(--m3-outline-variant))] bg-[rgb(var(--m3-surface-container-low))] p-3"
        >
          <div className="type-label-sm font-medium text-[rgb(var(--m3-on-surface-variant))]">
            {label}
          </div>
          <AdminTextField
            label={`${theme} ${label}`}
            defaultValue="North Meadow"
            helperText="Focus shows the workspace ring."
          />
        </div>
      ))}
    </div>
  </section>
);

export const WorkspaceToneMatrix: Story = {
  render: () => (
    <div className="space-y-4">
      <TextFieldToneMatrix theme="light" />
      <TextFieldToneMatrix theme="dark" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const actionsField = canvas.getByRole("textbox", { name: "dark Actions" });
    await userEvent.click(actionsField);
    await expect(actionsField).toHaveFocus();
  },
};

// ---------------------------------------------------------------------------
// AdminSelect — the form select sharing this field anatomy (added 2026-08-29)
// ---------------------------------------------------------------------------

const CYCLE_OPTIONS = (
  <>
    <option value="">Choose a cycle</option>
    <option value="c1">Season One</option>
    <option value="c2">Winter interseason</option>
  </>
);

export const SelectField: Story = {
  name: "Select",
  render: () => (
    <div className="max-w-sm space-y-4">
      <AdminSelect
        label="Cycle"
        defaultValue=""
        helperText="An empty-value option plays the placeholder."
      >
        {CYCLE_OPTIONS}
      </AdminSelect>
      <AdminSelect label="Cycle" defaultValue="c1">
        {CYCLE_OPTIONS}
      </AdminSelect>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const selects = canvas.getAllByRole("combobox", { name: "Cycle" });
    await expect(selects).toHaveLength(2);
    await userEvent.selectOptions(selects[0], "c2");
    await expect(selects[0]).toHaveValue("c2");
  },
};

export const SelectStates: Story = {
  name: "Select — error · disabled",
  render: () => (
    <div className="max-w-sm space-y-4">
      <AdminSelect label="Action" defaultValue="" error="Pick an action">
        <option value="">Choose an action</option>
        <option value="a1">Turn soil</option>
      </AdminSelect>
      <AdminSelect label="Action" defaultValue="a1" disabled>
        <option value="a1">Turn soil</option>
      </AdminSelect>
    </div>
  ),
};
