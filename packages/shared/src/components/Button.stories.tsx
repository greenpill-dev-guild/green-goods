import { RiArrowRightLine, RiDeleteBinLine, RiLinkM } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "storybook/test";
import { Button, type ButtonEmphasis, type ButtonSize } from "./Button";
import { TextInput } from "./Form/ControlPrimitives";

const EMPHASES: ButtonEmphasis[] = ["primary", "secondary", "tertiary"];
const SIZES: Array<[ButtonSize, number]> = [
  ["lg", 48],
  ["md", 44],
  ["sm", 40],
  ["compact", 32],
];

const px = (value: string) => Number.parseFloat(value);

const meta = {
  title: "Shared/Primitives/Button",
  component: Button,
  tags: ["autodocs", "storybook-ci"],
  parameters: {
    docs: {
      description: {
        component:
          "The one action button. Shape follows emphasis (DL-021): primary is a capsule, secondary the 12px squircle, tertiary text with a squircle fill on hover. Heights match the field scale (DL-023): lg 48, md 44, sm 40, compact 32 with a 48px hit area. A loading button stays focusable. `variant` is the legacy class contract kept for shared internals admin still renders.",
      },
    },
  },
  argTypes: {
    emphasis: { control: "select", options: EMPHASES },
    tone: { control: "select", options: ["default", "danger", "warning"] },
    size: { control: "select", options: SIZES.map(([size]) => size) },
    loading: { control: "boolean" },
  },
  args: {
    children: "Create Garden",
    onClick: fn(),
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Create Garden" });
    const style = getComputedStyle(button);
    await expect(button.getBoundingClientRect().height).toBe(44);
    // A capsule: the corner is half the height.
    await expect(px(style.borderTopLeftRadius)).toBe(22);
  },
};

export const Secondary: Story = {
  args: { emphasis: "secondary", children: "Cancel" },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Cancel" });
    await expect(px(getComputedStyle(button).borderTopLeftRadius)).toBe(12);
  },
};

export const Tertiary: Story = {
  args: { emphasis: "tertiary", children: "Show More" },
};

export const Destructive: Story = {
  args: {
    tone: "danger",
    children: "Remove Photo",
    leadingIcon: <RiDeleteBinLine className="h-4 w-4" aria-hidden="true" />,
  },
};

export const Loading: Story = {
  args: { loading: true, children: "Submitting Work" },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Submitting Work" });
    await expect(button).not.toBeDisabled();
    await expect(button).toHaveAttribute("aria-busy", "true");
    await expect(button).toHaveAttribute("aria-disabled", "true");
  },
};

export const AsLink: Story = {
  render: () => (
    <Button asChild emphasis="secondary" trailingIcon={<RiArrowRightLine className="h-4 w-4" />}>
      <a href="/">Explore Gardens</a>
    </Button>
  ),
};

/** Every emphasis at every size, with the heights and corners the scale promises. */
export const EmphasisCatalog: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {SIZES.map(([size]) => (
        <div key={size} className="flex flex-wrap items-center gap-3" data-size-row={size}>
          {EMPHASES.map((emphasis) => (
            <Button key={emphasis} emphasis={emphasis} size={size}>
              {`${emphasis} ${size}`}
            </Button>
          ))}
          <Button tone="danger" size={size}>{`danger ${size}`}</Button>
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    for (const [size, height] of SIZES) {
      const row = canvasElement.querySelector(`[data-size-row="${size}"]`);
      for (const button of Array.from(row?.querySelectorAll("button") ?? [])) {
        await expect(button.getBoundingClientRect().height).toBe(height);
        const radius = px(getComputedStyle(button).borderTopLeftRadius);
        const emphasis = button.getAttribute("data-emphasis");
        await expect(radius).toBe(emphasis === "primary" ? height / 2 : 12);
        // The two short sizes still reach a 48px hit area (DL-023).
        if (height < 44) {
          await expect(px(getComputedStyle(button, "::after").height)).toBe(48);
        }
      }
    }
  },
};

/** A field and its action share one height; the field is 16px, the action the 12px squircle. */
export const FieldPairing: Story = {
  render: () => (
    <div className="flex max-w-md items-start gap-2">
      <TextInput aria-label="Link" placeholder="https://" />
      <Button emphasis="secondary" leadingIcon={<RiLinkM className="h-4 w-4" aria-hidden="true" />}>
        Add Link
      </Button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole("textbox", { name: "Link" });
    const button = canvas.getByRole("button", { name: "Add Link" });
    await expect(field.getBoundingClientRect().height).toBe(44);
    await expect(button.getBoundingClientRect().height).toBe(44);
    await expect(px(getComputedStyle(field).borderTopLeftRadius)).toBe(16);
    await expect(px(getComputedStyle(button).borderTopLeftRadius)).toBe(12);
  },
};

/** The legacy `variant` path, kept for EmptyState and toasts that admin still renders. */
export const LegacyVariant: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary" size="sm">
        Legacy Primary
      </Button>
      <Button variant="ghost" size="sm">
        Legacy Ghost
      </Button>
    </div>
  ),
};
