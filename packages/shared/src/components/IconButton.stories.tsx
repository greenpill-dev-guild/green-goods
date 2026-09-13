import { RiCloseLine, RiShareLine, RiStopFill, RiTaskLine } from "@remixicon/react";
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

/** A capture tool while recording (Submit Work, the proof composer): the error fill. */
export const Recording: Story = {
  args: {
    "aria-label": "Stop Recording",
    "aria-pressed": true,
    emphasis: "primary",
    tone: "danger",
    size: "lg",
    icon: <RiStopFill aria-hidden="true" />,
  },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Stop Recording" });
    const probe = document.createElement("span");
    probe.style.backgroundColor = "rgb(var(--error-base))";
    canvasElement.appendChild(probe);
    await expect(getComputedStyle(button).backgroundColor).toBe(
      getComputedStyle(probe).backgroundColor
    );
    probe.remove();
  },
};

/** A header launcher: compact, outlined, with a count pinned to its corner. */
export const WithBadge: Story = {
  args: {
    "aria-label": "Open Your Work, 3 pending",
    emphasis: "secondary",
    size: "compact",
    icon: <RiTaskLine aria-hidden="true" />,
    badge: (
      <span
        data-testid="count"
        className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-bg-white-0 bg-primary-action px-1 text-xs font-semibold text-primary-action-foreground"
      >
        3
      </span>
    ),
  },
  render: (args) => (
    <div className="p-4">
      <IconButton {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Open Your Work, 3 pending" });
    const buttonRect = button.getBoundingClientRect();
    const badgeRect = canvas.getByTestId("count").getBoundingClientRect();
    await expect(buttonRect.height).toBe(32);
    // The count overhangs the top-right corner rather than covering the icon.
    await expect(badgeRect.top).toBeLessThan(buttonRect.top);
    await expect(badgeRect.right).toBeGreaterThan(buttonRect.right);
  },
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
