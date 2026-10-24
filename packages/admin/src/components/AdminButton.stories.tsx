import { RiAddLine, RiArrowRightLine, RiDeleteBinLine, RiSave3Line } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import {
  drawnRings,
  gradeMeasurement,
  measureElement,
  readToken,
} from "../../../shared/.storybook/design-system/measure";
import { AdminButton, AdminIconButton } from "./AdminButton";

const meta: Meta<typeof AdminButton> = {
  title: "Admin/Primitives/AdminButton",
  component: AdminButton,
  tags: ["autodocs"],
  decorators: [withAdminPrimitiveFrame],
  parameters: {
    docs: {
      description: {
        component:
          "The cockpit's buttons are the shared Button and IconButton (DL-115). Filled is the primary in the workspace tone, outlined the secondary on the control outline, text the tertiary, and danger and outlined danger take the danger tone; sm, md and lg are the shared compact, sm and lg sizes on the cockpit's 28 / 32 / 40px tiers with a 44px finger box. Tonal stays the cockpit's own pill for the chosen option in a set until phase 2.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["filled", "tonal", "elevated", "outlined", "text", "danger", "outlinedDanger"],
    },
    size: { control: "select", options: ["sm", "md", "lg"] },
    loading: { control: "boolean" },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof AdminButton>;

export const Filled: Story = {
  args: { variant: "filled", size: "md", children: "Continue" },
};

/** The chosen option in a set: the cockpit's own tonal pill until phase 2. */
export const Tonal: Story = {
  args: { variant: "tonal", size: "md", children: "Last 30 days" },
};

export const Outlined: Story = {
  args: { variant: "outlined", size: "md", children: "Cancel" },
};

/** A destructive action at outlined emphasis, beside a filled primary (Reject next to Approve). */
export const OutlinedDanger: Story = {
  args: { variant: "outlinedDanger", size: "md", children: "Reject" },
};

export const WithIcon: Story = {
  args: {
    variant: "filled",
    size: "md",
    leadingIcon: <RiAddLine />,
    children: "New action",
  },
};

export const Loading: Story = {
  args: { variant: "filled", loading: true, children: "Submitting" },
};

/**
 * AdminIconButton — glyph-only actions on the same tiers (28/32/40), the shared
 * IconButton. The `label` prop is the mandatory accessible name (aria-label + tooltip).
 */
export const IconButtons: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <AdminIconButton size="sm" label="Add (sm)">
          <RiAddLine />
        </AdminIconButton>
        <AdminIconButton size="md" label="Add (md)">
          <RiAddLine />
        </AdminIconButton>
        <AdminIconButton size="lg" label="Add (lg)">
          <RiAddLine />
        </AdminIconButton>
      </div>
      <div className="flex items-center gap-2">
        <AdminIconButton variant="standard" label="Standard">
          <RiAddLine />
        </AdminIconButton>
        <AdminIconButton variant="accent" label="Accent">
          <RiArrowRightLine />
        </AdminIconButton>
        <AdminIconButton variant="tonal" label="Tonal">
          <RiSave3Line />
        </AdminIconButton>
        <AdminIconButton variant="filled" label="Filled">
          <RiAddLine />
        </AdminIconButton>
        <AdminIconButton variant="danger" label="Delete">
          <RiDeleteBinLine />
        </AdminIconButton>
        <AdminIconButton label="Disabled" disabled>
          <RiAddLine />
        </AdminIconButton>
      </div>
    </div>
  ),
};

/** A focus ring the browser draws: the shared family's outline or a box-shadow ring. */
const drawsFocusRing = (control: HTMLElement) => {
  const style = getComputedStyle(control);
  const outline = style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) >= 2;
  return outline || drawnRings(control).length > 0;
};

/**
 * Keyboard focus draws the ring on every low-emphasis variant: the shared
 * family's 2px outline in the focus role, and the tonal pill's ring. The play
 * test tabs through them.
 */
export const FocusRings: Story = {
  tags: ["storybook-ci"],
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <AdminButton variant="tonal">Tonal</AdminButton>
      <AdminButton variant="outlined">Outlined</AdminButton>
      <AdminButton variant="text">Text</AdminButton>
      <AdminButton variant="danger">Danger</AdminButton>
      <AdminButton variant="outlinedDanger">Outlined danger</AdminButton>
      <AdminIconButton variant="tonal" label="Add item">
        <RiAddLine />
      </AdminIconButton>
    </div>
  ),
  play: async ({ canvasElement }) => {
    for (const control of within(canvasElement).getAllByRole("button")) {
      await userEvent.tab();
      await expect(control).toHaveFocus();
      await waitFor(() => expect(drawsFocusRing(control)).toBe(true));
    }
  },
};

export const StateCatalog: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <AdminButton variant="filled" leadingIcon={<RiSave3Line />}>
          Filled
        </AdminButton>
        <AdminButton variant="tonal">Tonal</AdminButton>
        <AdminButton variant="elevated">Elevated</AdminButton>
        <AdminButton variant="outlined">Outlined</AdminButton>
        <AdminButton variant="text" leadingIcon={<RiArrowRightLine />}>
          Text
        </AdminButton>
        <AdminButton variant="danger" leadingIcon={<RiDeleteBinLine />}>
          Danger
        </AdminButton>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <AdminButton disabled>Disabled</AdminButton>
        <AdminButton loading>Saving</AdminButton>
        <AdminButton variant="outlined" disabled>
          Disabled outline
        </AdminButton>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <AdminButton size="sm">Small</AdminButton>
        <AdminButton size="md">Medium</AdminButton>
        <AdminButton size="lg">Large</AdminButton>
      </div>
    </div>
  ),
};

const WORKSPACE_TONES = [
  ["hub", "Hub"],
  ["garden", "Garden"],
  ["community", "Community"],
  ["actions", "Actions"],
] as const;

const ButtonToneMatrix = ({ theme }: { theme: "light" | "dark" }) => (
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
          className="rounded-[var(--m3-shape-md)] border border-[rgb(var(--m3-outline-variant))] bg-[rgb(var(--m3-surface-container-low))] p-3"
        >
          <div className="mb-2 type-label-sm font-medium text-[rgb(var(--m3-on-surface-variant))]">
            {label}
          </div>
          <div className="flex flex-wrap gap-2">
            <AdminButton variant="filled" size="sm" leadingIcon={<RiSave3Line />}>
              Filled
            </AdminButton>
            <AdminButton variant="tonal" size="sm">
              Tonal
            </AdminButton>
            <AdminButton variant="elevated" size="sm">
              Elevated
            </AdminButton>
            <AdminButton variant="outlined" size="sm">
              Outlined
            </AdminButton>
            <AdminButton variant="text" size="sm" leadingIcon={<RiArrowRightLine />}>
              Text
            </AdminButton>
          </div>
        </div>
      ))}
    </div>
  </section>
);

export const WorkspaceToneMatrix: Story = {
  render: () => (
    <div className="space-y-4">
      <ButtonToneMatrix theme="light" />
      <ButtonToneMatrix theme="dark" />
    </div>
  ),
};

const ALL_TONES = [...WORKSPACE_TONES, ["home", "Home"]] as const;
const ACTION_VARIANTS = ["filled", "outlined", "text", "danger", "outlinedDanger"] as const;
const SIZE_HEIGHTS = { sm: 28, md: 32, lg: 40 } as const;

/** Channels and alpha of a computed colour. */
const colorParts = (color: string) => {
  const [r = 0, g = 0, b = 0, a = 1] = (color.match(/[\d.]+/g) ?? []).map(Number);
  return { rgb: [r, g, b], alpha: color.startsWith("rgba") ? a : 1 };
};

/**
 * The shared family as the cockpit draws it (DL-115): every action variant at
 * every tier, at rest, disabled and loading, beside the icon buttons, in every
 * workspace tone, light and dark. The play test measures it in the browser: the
 * 28 / 32 / 40px tiers with a 44px finger box, the one 14px label at 500, the
 * pill and the circle, and the disabled pair (a 12% ink fill under a 38% ink
 * label, no dim).
 */
export const SharedFamilyMatrix: Story = {
  tags: ["storybook-ci"],
  render: () => (
    <div className="space-y-4">
      {(["light", "dark"] as const).map((theme) => (
        <section
          key={theme}
          data-theme={theme}
          className="admin-m3 space-y-3 rounded-[var(--m3-shape-lg)] bg-[rgb(var(--m3-surface))] p-4"
        >
          {ALL_TONES.map(([tone, label]) => (
            <div key={tone} data-tone={tone} className="space-y-2" data-testid={`${theme}-${tone}`}>
              <div className="type-label-sm text-[rgb(var(--m3-on-surface-variant))]">
                {label}, {theme}
              </div>
              {(["sm", "md", "lg"] as const).map((size) => (
                <div key={size} className="flex flex-wrap items-center gap-2">
                  {ACTION_VARIANTS.map((variant) => (
                    <AdminButton key={variant} variant={variant} size={size}>
                      {variant === "outlinedDanger" ? "Reject" : "Save"}
                    </AdminButton>
                  ))}
                  <AdminButton size={size} disabled data-matrix="disabled">
                    Save
                  </AdminButton>
                  <AdminButton size={size} variant="outlined" disabled data-matrix="disabled">
                    Save
                  </AdminButton>
                  <AdminButton size={size} loading>
                    Saving
                  </AdminButton>
                  <AdminIconButton size={size} label={`Add, ${tone} ${theme} ${size}`}>
                    <RiAddLine />
                  </AdminIconButton>
                  <AdminIconButton
                    size={size}
                    variant="filled"
                    label={`Save, ${tone} ${theme} ${size}`}
                  >
                    <RiSave3Line />
                  </AdminIconButton>
                  <AdminIconButton
                    size={size}
                    variant="danger"
                    label={`Delete, ${tone} ${theme} ${size}`}
                  >
                    <RiDeleteBinLine />
                  </AdminIconButton>
                </div>
              ))}
            </div>
          ))}
        </section>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const buttons = Array.from(
      canvasElement.querySelectorAll<HTMLElement>('[data-component="AdminButton"]')
    );
    await expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      const size = button.getAttribute("data-size");
      const tier = size === "compact" ? "sm" : size === "sm" ? "md" : "lg";
      const failed = gradeMeasurement(measureElement(button), {
        height: SIZE_HEIGHTS[tier],
        radius: "pill",
        labelSize: 14,
        weight: 500,
        hit: 44,
      }).filter((check) => !check.pass);
      await expect(failed).toEqual([]);
    }
    for (const icon of canvasElement.querySelectorAll<HTMLElement>(
      '[data-component="AdminIconButton"]'
    )) {
      const size = icon.getAttribute("data-size");
      const tier = size === "compact" ? "sm" : size === "sm" ? "md" : "lg";
      const measured = measureElement(icon);
      await expect([measured.height, measured.corner]).toEqual([SIZE_HEIGHTS[tier], "circle"]);
      await expect(measured.hitHeight).toBeGreaterThanOrEqual(44);
    }
    for (const disabled of canvasElement.querySelectorAll<HTMLElement>(
      '[data-matrix="disabled"]'
    )) {
      const style = getComputedStyle(disabled);
      await expect(style.opacity).toBe("1");
      await expect(colorParts(style.backgroundColor).alpha).toBeCloseTo(0.12, 2);
      await expect(colorParts(style.color).alpha).toBeCloseTo(0.38, 2);
    }
  },
};

/**
 * The filled button and icon button, shared primaries, in every workspace tone,
 * light and dark: the tone's fill under its on-action ink, and keyboard focus
 * drawing the 2px ring. Hover and press take the tone's measured hover step,
 * whose contrast WorkspaceToneContrast.guard holds at AA.
 */
export const FilledActions: Story = {
  tags: ["storybook-ci"],
  render: () => (
    <div className="space-y-4">
      {(["light", "dark"] as const).map((theme) => (
        <section
          key={theme}
          data-theme={theme}
          className="admin-m3 flex flex-wrap gap-4 rounded-[var(--m3-shape-lg)] bg-[rgb(var(--m3-surface))] p-4"
        >
          {ALL_TONES.map(([tone, label]) => (
            <div key={tone} data-tone={tone} className="flex items-center gap-2">
              <AdminButton variant="filled" size="sm">
                {label}
              </AdminButton>
              <AdminIconButton variant="filled" label={`Add in ${label}, ${theme}`}>
                <RiAddLine />
              </AdminIconButton>
            </div>
          ))}
        </section>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    for (const control of within(canvasElement).getAllByRole("button")) {
      const style = getComputedStyle(control);
      await expect(colorParts(style.backgroundColor).rgb.join(" ")).toBe(
        readToken("--tone-action", control)
      );
      await expect(colorParts(style.color).rgb.join(" ")).toBe(
        readToken("--tone-on-action", control)
      );
      await userEvent.tab();
      await expect(control).toHaveFocus();
      await waitFor(() => expect(drawsFocusRing(control)).toBe(true));
    }
  },
};
