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
          'The one action button. Emphasis sets fill, outline, and colour; the corner comes from the surface and is the same for every emphasis (DL-026, DL-028): the 16px field corner in the installed app and no corner on the public website (inside `data-site="website"`). Heights match the field scale (DL-023): lg 48, md 44, sm 40, compact 32 with a 48px hit area. A loading button stays focusable.',
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
    // The app corner is the 16px field corner for every emphasis (DL-028).
    await expect(px(style.borderTopLeftRadius)).toBe(16);
  },
};

export const Secondary: Story = {
  args: { emphasis: "secondary", children: "Cancel" },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Cancel" });
    await expect(px(getComputedStyle(button).borderTopLeftRadius)).toBe(16);
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

/** Every emphasis at every size, with the heights the scale promises and one app corner (16px; a capsule at compact). */
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
        await expect(px(getComputedStyle(button).borderTopLeftRadius)).toBe(16);
        // The two short sizes still reach a 48px hit area (DL-023).
        if (height < 44) {
          await expect(px(getComputedStyle(button, "::after").height)).toBe(48);
        }
      }
    }
  },
};

/** A field and its action share one height and one 16px corner (DL-022, DL-028). */
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
    await expect(px(getComputedStyle(button).borderTopLeftRadius)).toBe(16);
  },
};

/** On the public website every emphasis is square with a semibold label (DL-026, DL-028). */
export const WebsiteSurface: Story = {
  render: () => (
    <div data-site="website" className="flex flex-wrap items-center gap-3">
      {EMPHASES.map((emphasis) => (
        <Button key={emphasis} emphasis={emphasis}>
          {`Website ${emphasis}`}
        </Button>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    for (const emphasis of EMPHASES) {
      const button = within(canvasElement).getByRole("button", { name: `Website ${emphasis}` });
      const style = getComputedStyle(button);
      await expect(button.getBoundingClientRect().height).toBe(44);
      await expect(px(style.borderTopLeftRadius)).toBe(0);
      await expect(style.fontWeight).toBe("600");
    }
  },
};
