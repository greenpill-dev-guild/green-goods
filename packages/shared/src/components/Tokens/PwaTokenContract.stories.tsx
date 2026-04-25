import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import tokens from "../../styles/design-md.generated.json";

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const parts = [0, 2, 4].map((offset) => parseInt(clean.slice(offset, offset + 2), 16));
  return `rgb(${parts.join(", ")})`;
}

function TokenRow({ theme }: { theme: "light" | "dark" }) {
  return (
    <div data-theme={theme} className="bg-bg-white-0 p-4 text-text-strong-950">
      <div className="flex items-center gap-3">
        <span
          data-testid={`${theme}-accent`}
          className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-primary px-2 text-xs font-semibold text-primary-accent-foreground"
        >
          6
        </span>
        <span data-testid={`${theme}-active`} className="text-sm font-medium text-primary">
          Active nav
        </span>
        <button
          data-testid={`${theme}-action`}
          type="button"
          className="rounded-full bg-primary-action px-4 py-2 text-sm font-medium text-primary-action-foreground hover:bg-primary-action-hover"
        >
          Fund garden
        </button>
      </div>
      <div className="mt-4 h-2 rounded-full bg-bg-soft-200">
        <div data-testid={`${theme}-progress`} className="h-full w-2/3 rounded-full bg-primary" />
      </div>
    </div>
  );
}

const meta: Meta = {
  title: "Shared/Tokens/PwaTokenContract",
  tags: ["autodocs", "storybook-ci"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Generated DesignMD token contract for the protected installed-PWA accent and action aliases.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const AccentAndActionAliases: Story = {
  render: () => (
    <div className="w-[360px] overflow-hidden rounded-lg border border-stroke-soft-200">
      <TokenRow theme="light" />
      <TokenRow theme="dark" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const accent = canvas.getByTestId("light-accent");
    const action = canvas.getByTestId("light-action");
    const active = canvas.getByTestId("light-active");
    const progress = canvas.getByTestId("light-progress");

    expect(getComputedStyle(accent).backgroundColor).toBe(hexToRgb(tokens.colors.tertiary));
    expect(getComputedStyle(active).color).toBe(hexToRgb(tokens.colors.tertiary));
    expect(getComputedStyle(progress).backgroundColor).toBe(hexToRgb(tokens.colors.tertiary));
    expect(getComputedStyle(action).backgroundColor).toBe(
      hexToRgb(tokens.colors["tertiary-action"])
    );
    expect(getComputedStyle(action).color).toBe(hexToRgb(tokens.colors["on-tertiary-action"]));
  },
};
