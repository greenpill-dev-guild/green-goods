import { RiCloseLine, RiShareLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "storybook/test";
import type { ButtonEmphasis, ButtonSize } from "./Button";
import { IconButton } from "./IconButton";

const EMPHASES: ButtonEmphasis[] = ["tertiary", "secondary", "primary"];
const SIZES: Array<[ButtonSize, number]> = [
  ["lg", 48],
  ["md", 44],
  ["sm", 40],
  ["compact", 32],
];

const meta = {
  title: "Shared/Primitives/IconButton",
  component: IconButton,
  tags: ["autodocs", "storybook-ci"],
  parameters: {
    docs: {
      description: {
        component:
          "A circular icon-only button for close, back, share, menu, and remove (DL-021). The accessible name is required. Sizes follow the Button scale; sm and compact keep a 48px hit area. Tertiary is transparent, secondary outlined, primary filled.",
      },
    },
  },
  args: {
    "aria-label": "Close",
    icon: <RiCloseLine aria-hidden="true" />,
    onClick: fn(),
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Close: Story = {
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Close" });
    const rect = button.getBoundingClientRect();
    await expect(rect.height).toBe(44);
    await expect(rect.width).toBe(44);
    await expect(Number.parseFloat(getComputedStyle(button).borderTopLeftRadius)).toBe(22);
  },
};

export const Loading: Story = {
  args: { "aria-label": "Refreshing", loading: true },
};

/** Every emphasis at every size. */
export const EmphasisCatalog: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {SIZES.map(([size]) => (
        <div key={size} className="flex items-center gap-4" data-size-row={size}>
          {EMPHASES.map((emphasis) => (
            <IconButton
              key={emphasis}
              aria-label={`Share ${emphasis} ${size}`}
              emphasis={emphasis}
              size={size}
              icon={<RiShareLine aria-hidden="true" />}
            />
          ))}
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    for (const [size, diameter] of SIZES) {
      const row = canvasElement.querySelector(`[data-size-row="${size}"]`);
      for (const button of Array.from(row?.querySelectorAll("button") ?? [])) {
        await expect(button.getBoundingClientRect().height).toBe(diameter);
        await expect(button.getBoundingClientRect().width).toBe(diameter);
      }
    }
  },
};
