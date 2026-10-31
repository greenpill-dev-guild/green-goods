import { Button } from "@green-goods/shared/components/Button";
import { IconButton } from "@green-goods/shared/components/IconButton";
import {
  RiAddLine,
  RiArrowRightLine,
  RiDeleteBinLine,
  RiFileCopyLine,
  RiSave3Line,
} from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import {
  drawnRings,
  gradeMeasurement,
  measureElement,
  readToken,
} from "../../../shared/.storybook/design-system/measure";

const meta: Meta<typeof Button> = {
  title: "Admin/Primitives/Buttons",
  component: Button,
  tags: ["autodocs"],
  decorators: [withAdminPrimitiveFrame],
  parameters: {
    docs: {
      description: {
        component:
          "Admin views render the shared Button and IconButton directly (DL-115, DL-119). The primary fills with the workspace tone, the secondary sits on the control outline, the tertiary is text, and the danger tone marks a destructive act. The cockpit's tokens set the compact, sm and lg sizes at 28, 32 and 40px with a 44px finger box, pills, one 14px label at 500, no press scale, circles with an 18px glyph, and the neutral disabled pair.",
      },
    },
  },
  argTypes: {
    emphasis: { control: "select", options: ["primary", "secondary", "tertiary"] },
    tone: { control: "select", options: ["default", "danger", "warning"] },
    size: { control: "select", options: ["compact", "sm", "lg"] },
    loading: { control: "boolean" },
    disabled: { control: "boolean" },
  },
  args: { type: "button", size: "sm" },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { emphasis: "primary", children: "Continue" },
};

export const Secondary: Story = {
  args: { emphasis: "secondary", children: "Cancel" },
};

/** A destructive act at outlined emphasis, beside a filled primary (Reject next to Approve). */
export const SecondaryDanger: Story = {
  args: { emphasis: "secondary", tone: "danger", children: "Reject" },
};

/** The call site sizes the leading glyph: 16px at 28px, 18px on the other tiers. */
export const WithIcon: Story = {
  args: {
    emphasis: "primary",
    leadingIcon: <RiAddLine className="h-[18px] w-[18px]" aria-hidden="true" />,
    children: "New Action",
  },
};

export const Loading: Story = {
  args: { emphasis: "primary", loading: true, children: "Submitting" },
};

/**
 * Glyph-only actions on the same tiers (28/32/40). The accessible name is
 * required; the cockpit gives it as the tooltip too.
 */
export const IconButtons: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        {(["compact", "sm", "lg"] as const).map((size) => (
          <IconButton
            key={size}
            size={size}
            aria-label={`Add (${size})`}
            title={`Add (${size})`}
            icon={<RiAddLine />}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <IconButton size="sm" aria-label="Tertiary" title="Tertiary" icon={<RiAddLine />} />
        <IconButton
          size="sm"
          emphasis="secondary"
          aria-label="Secondary"
          title="Secondary"
          icon={<RiSave3Line />}
        />
        <IconButton
          size="sm"
          emphasis="primary"
          aria-label="Primary"
          title="Primary"
          icon={<RiAddLine />}
        />
        <IconButton
          size="sm"
          tone="danger"
          aria-label="Delete"
          title="Delete"
          icon={<RiDeleteBinLine />}
        />
        <IconButton
          size="sm"
          aria-label="Disabled"
          title="Disabled"
          disabled
          icon={<RiAddLine />}
        />
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

/** Keyboard focus draws the 2px ring on every emphasis and tone. The play test tabs through them. */
export const FocusRings: Story = {
  tags: ["storybook-ci"],
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" emphasis="secondary" size="sm">
        Secondary
      </Button>
      <Button type="button" emphasis="tertiary" size="sm">
        Tertiary
      </Button>
      <Button type="button" tone="danger" size="sm">
        Danger
      </Button>
      <Button type="button" emphasis="secondary" tone="danger" size="sm">
        Secondary Danger
      </Button>
      <IconButton
        size="sm"
        emphasis="secondary"
        aria-label="Add Item"
        title="Add Item"
        icon={<RiAddLine />}
      />
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
        <Button
          type="button"
          size="sm"
          leadingIcon={<RiSave3Line className="h-[18px] w-[18px]" aria-hidden="true" />}
        >
          Primary
        </Button>
        <Button type="button" emphasis="secondary" size="sm">
          Secondary
        </Button>
        <Button
          type="button"
          emphasis="tertiary"
          size="sm"
          leadingIcon={<RiArrowRightLine className="h-[18px] w-[18px]" aria-hidden="true" />}
        >
          Tertiary
        </Button>
        <Button
          type="button"
          tone="danger"
          size="sm"
          leadingIcon={<RiDeleteBinLine className="h-[18px] w-[18px]" aria-hidden="true" />}
        >
          Danger
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" disabled>
          Disabled
        </Button>
        <Button type="button" size="sm" loading>
          Saving
        </Button>
        <Button type="button" emphasis="secondary" size="sm" disabled>
          Disabled Outline
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Button type="button" size="compact">
          Compact
        </Button>
        <Button type="button" size="sm">
          Small
        </Button>
        <Button type="button" size="lg">
          Large
        </Button>
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
  <section data-theme={theme} className="admin-m3 rounded-lg bg-bg-weak p-4">
    <div className="mb-3 type-label-sm font-semibold uppercase text-text-sub">{theme}</div>
    <div className="grid gap-3 md:grid-cols-2">
      {WORKSPACE_TONES.map(([tone, label]) => (
        <div
          key={`${theme}-${tone}`}
          data-tone={tone}
          className="rounded-md border border-stroke-soft bg-bg-white p-3"
        >
          <div className="mb-2 type-label-sm font-medium text-text-sub">{label}</div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="compact"
              leadingIcon={<RiSave3Line className="h-4 w-4" aria-hidden="true" />}
            >
              Primary
            </Button>
            <Button type="button" emphasis="secondary" size="compact">
              Secondary
            </Button>
            <Button
              type="button"
              emphasis="tertiary"
              size="compact"
              leadingIcon={<RiArrowRightLine className="h-4 w-4" aria-hidden="true" />}
            >
              Tertiary
            </Button>
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
const ACTIONS = [
  { label: "Save", emphasis: "primary" },
  { label: "Save", emphasis: "secondary" },
  { label: "Save", emphasis: "tertiary" },
  { label: "Remove", emphasis: "primary", tone: "danger" },
  { label: "Reject", emphasis: "secondary", tone: "danger" },
] as const;
const SIZE_HEIGHTS = { compact: 28, sm: 32, lg: 40 } as const;

/** Channels and alpha of a computed color. */
const colorParts = (color: string) => {
  const [r = 0, g = 0, b = 0, a = 1] = (color.match(/[\d.]+/g) ?? []).map(Number);
  return { rgb: [r, g, b], alpha: color.startsWith("rgba") ? a : 1 };
};

/**
 * The shared family as the cockpit draws it: every emphasis and tone at every
 * tier, at rest, disabled and loading, beside the icon buttons, in every
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
          className="admin-m3 space-y-3 rounded-lg bg-bg-weak p-4"
        >
          {ALL_TONES.map(([tone, label]) => (
            <div key={tone} data-tone={tone} className="space-y-2" data-testid={`${theme}-${tone}`}>
              <div className="type-label-sm text-text-sub">
                {label}, {theme}
              </div>
              {(["compact", "sm", "lg"] as const).map((size) => (
                <div key={size} className="flex flex-wrap items-center gap-2">
                  {ACTIONS.map((action) => (
                    <Button
                      key={`${action.emphasis}-${"tone" in action ? action.tone : "default"}`}
                      type="button"
                      emphasis={action.emphasis}
                      tone={"tone" in action ? action.tone : undefined}
                      size={size}
                    >
                      {action.label}
                    </Button>
                  ))}
                  <Button type="button" size={size} disabled data-matrix="disabled">
                    Save
                  </Button>
                  <Button
                    type="button"
                    emphasis="secondary"
                    size={size}
                    disabled
                    data-matrix="disabled"
                  >
                    Save
                  </Button>
                  <Button type="button" size={size} loading>
                    Saving
                  </Button>
                  <IconButton
                    size={size}
                    aria-label={`Add, ${tone} ${theme} ${size}`}
                    title={`Add, ${tone} ${theme} ${size}`}
                    icon={<RiAddLine />}
                  />
                  <IconButton
                    size={size}
                    emphasis="primary"
                    aria-label={`Save, ${tone} ${theme} ${size}`}
                    title={`Save, ${tone} ${theme} ${size}`}
                    icon={<RiSave3Line />}
                  />
                  <IconButton
                    size={size}
                    tone="danger"
                    aria-label={`Delete, ${tone} ${theme} ${size}`}
                    title={`Delete, ${tone} ${theme} ${size}`}
                    icon={<RiDeleteBinLine />}
                  />
                  <IconButton
                    size={size}
                    emphasis="secondary"
                    disabled
                    data-matrix="disabled"
                    aria-label={`Send, disabled, ${tone} ${theme} ${size}`}
                    title={`Send, disabled, ${tone} ${theme} ${size}`}
                    icon={<RiSave3Line />}
                  />
                </div>
              ))}
            </div>
          ))}
        </section>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const buttons = Array.from(canvasElement.querySelectorAll<HTMLElement>(".gg-button"));
    await expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      const size = button.getAttribute("data-size") as keyof typeof SIZE_HEIGHTS;
      const failed = gradeMeasurement(measureElement(button), {
        height: SIZE_HEIGHTS[size],
        radius: "pill",
        labelSize: 14,
        weight: 500,
        hit: 44,
      }).filter((check) => !check.pass);
      await expect(failed).toEqual([]);
    }
    for (const icon of canvasElement.querySelectorAll<HTMLElement>(".gg-icon-button")) {
      const size = icon.getAttribute("data-size") as keyof typeof SIZE_HEIGHTS;
      const measured = measureElement(icon);
      await expect([measured.height, measured.corner]).toEqual([SIZE_HEIGHTS[size], "circle"]);
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
 * The cockpit's buttons keep its look whatever a call site or a shared piece
 * adds (DL-119), checked in the browser:
 * - a copy icon carrying `h-4 w-4` still draws the tier's glyph, 18px at 32px
 *   and 16px at 28px;
 * - a disabled or loading action with its own warning colors takes the
 *   neutral pair, as the warning action on a vault position does while pending;
 * - a shared piece's own button (`data-piece-control`, here a toast's action
 *   with its narrow, wrapping label) grows to hold the whole label, where the
 *   cockpit's own button stays on its 32px tier with its 6px reserve.
 */
export const CallSiteClassesLose: Story = {
  tags: ["storybook-ci"],
  render: () => (
    <div className="flex flex-col items-start gap-4">
      <div className="flex items-center gap-2">
        <IconButton
          size="sm"
          aria-label="Copy Garden Address"
          title="Copy Garden Address"
          icon={<RiFileCopyLine className="h-4 w-4" />}
          data-check="glyph-sm"
        />
        <IconButton
          size="compact"
          aria-label="Copy NFT Identifier"
          title="Copy NFT Identifier"
          icon={<RiFileCopyLine className="h-5 w-5" />}
          data-check="glyph-compact"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          emphasis="secondary"
          size="sm"
          disabled
          className="border-warning-base bg-warning-lighter text-warning-dark hover:bg-warning-light"
          data-check="pair"
        >
          Withdraw
        </Button>
        <Button
          type="button"
          emphasis="secondary"
          size="sm"
          loading
          className="border-warning-base bg-warning-lighter text-warning-dark hover:bg-warning-light"
          data-check="pair"
        >
          Withdrawing
        </Button>
      </div>
      <div className="flex w-[7.5rem] flex-col items-start gap-2">
        <Button
          type="button"
          emphasis="tertiary"
          size="sm"
          data-piece-control
          style={{ maxWidth: "100%", overflowWrap: "anywhere", whiteSpace: "normal" }}
          data-check="piece"
        >
          Try the submission again
        </Button>
        <Button type="button" emphasis="secondary" size="sm" data-check="own">
          Save
        </Button>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const one = (check: string) =>
      canvasElement.querySelector<HTMLElement>(`[data-check="${check}"]`) as HTMLElement;
    const glyph = (check: string) => one(check).querySelector("svg")?.getBoundingClientRect();
    await expect(glyph("glyph-sm")?.width).toBe(18);
    await expect(glyph("glyph-sm")?.height).toBe(18);
    await expect(glyph("glyph-compact")?.width).toBe(16);
    for (const action of canvasElement.querySelectorAll<HTMLElement>('[data-check="pair"]')) {
      const style = getComputedStyle(action);
      await expect(colorParts(style.backgroundColor).alpha).toBeCloseTo(0.12, 2);
      await expect(colorParts(style.color).alpha).toBeCloseTo(0.38, 2);
    }
    // The label's box, not scrollHeight, which counts the finger box's overhang.
    const piece = one("piece");
    const box = piece.getBoundingClientRect();
    const label = canvasElement.ownerDocument.createRange();
    label.selectNodeContents(piece);
    const text = label.getBoundingClientRect();
    await expect(box.height).toBeGreaterThan(SIZE_HEIGHTS.sm);
    await expect(text.top).toBeGreaterThanOrEqual(box.top);
    await expect(text.bottom).toBeLessThanOrEqual(box.bottom);
    await expect(getComputedStyle(piece).marginTop).toBe("0px");
    const own = one("own");
    await expect(own.getBoundingClientRect().height).toBe(SIZE_HEIGHTS.sm);
    await expect(getComputedStyle(own).marginTop).toBe("6px");
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
          className="admin-m3 flex flex-wrap gap-4 rounded-lg bg-bg-weak p-4"
        >
          {ALL_TONES.map(([tone, label]) => (
            <div key={tone} data-tone={tone} className="flex items-center gap-2">
              <Button type="button" size="compact">
                {label}
              </Button>
              <IconButton
                size="sm"
                emphasis="primary"
                aria-label={`Add in ${label}, ${theme}`}
                title={`Add in ${label}, ${theme}`}
                icon={<RiAddLine />}
              />
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
