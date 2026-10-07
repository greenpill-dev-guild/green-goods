import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, within } from "storybook/test";
import tokens from "../../styles/design-md.generated.json";
import { Switch } from "../Form/ControlPrimitives";

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const parts = [0, 2, 4].map((offset) => parseInt(clean.slice(offset, offset + 2), 16));
  return `rgb(${parts.join(", ")})`;
}

function TokenRow({ theme }: { theme: "light" | "dark" }) {
  const [checked, setChecked] = useState(true);

  return (
    <div
      data-testid={`${theme}-row`}
      data-theme={theme}
      className="p-4"
      style={{
        backgroundColor: "rgb(var(--bg-white-0))",
        color: "rgb(var(--text-strong-950))",
      }}
    >
      <p className="mb-3 text-xs font-medium capitalize">{theme}</p>
      <div className="flex items-center gap-3">
        <span
          data-testid={`${theme}-accent`}
          aria-hidden="true"
          className="h-2.5 w-2.5 rounded-full bg-primary"
        />
        <span
          data-testid={`${theme}-count`}
          className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-primary-action px-2 text-xs font-semibold text-primary-action-foreground"
        >
          6
        </span>
        <span
          data-testid={`${theme}-active`}
          className="text-sm font-medium text-primary-on-surface"
        >
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
        <div
          data-testid={`${theme}-progress`}
          className="h-full w-2/3 rounded-full bg-primary-on-surface"
        />
      </div>
      <div className="mt-4 flex items-center gap-4">
        <Switch
          checked={checked}
          onCheckedChange={setChecked}
          aria-label={`Selection switch (${theme})`}
          data-testid={`${theme}-switch`}
        />
        <input
          type="checkbox"
          defaultChecked
          aria-label={`Selection checkbox (${theme})`}
          data-testid={`${theme}-checkbox`}
          className="h-5 w-5 accent-primary-on-surface"
        />
        <input
          type="radio"
          defaultChecked
          name={`${theme}-selection`}
          aria-label={`Selection radio (${theme})`}
          data-testid={`${theme}-radio`}
          className="h-5 w-5 accent-primary-on-surface"
        />
        <span
          data-testid={`${theme}-selected`}
          className="rounded-lg border-2 border-primary-on-surface px-2 py-1 text-sm text-primary-on-surface"
        >
          Selected
        </span>
      </div>
    </div>
  );
}

const meta: Meta = {
  title: "Shared/Tokens/PwaTokenContract",
  tags: ["autodocs", "storybook-ci"],
  globals: { theme: "light" },
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Theme-aware PWA foregrounds and selection controls, with separate contrast-safe filled actions and brand decoration.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

function expectPwaAliasRow(canvas: ReturnType<typeof within>, theme: "light" | "dark") {
  const accent = canvas.getByTestId(`${theme}-accent`);
  const count = canvas.getByTestId(`${theme}-count`);
  const action = canvas.getByTestId(`${theme}-action`);
  const active = canvas.getByTestId(`${theme}-active`);
  const progress = canvas.getByTestId(`${theme}-progress`);
  const selectionSwitch = canvas.getByTestId(`${theme}-switch`);
  const checkbox = canvas.getByTestId(`${theme}-checkbox`);
  const radio = canvas.getByTestId(`${theme}-radio`);
  const selected = canvas.getByTestId(`${theme}-selected`);
  const interactiveColor = hexToRgb(
    theme === "light" ? tokens.colors["tertiary-action"] : tokens.colors.tertiary
  );

  // Brand decoration retains its palette; controls share the readable foreground for their theme.
  expect(getComputedStyle(accent).backgroundColor).toBe(hexToRgb(tokens.colors.tertiary));
  expect(getComputedStyle(count).backgroundColor).toBe(hexToRgb(tokens.colors["tertiary-action"]));
  expect(getComputedStyle(count).color).toBe(hexToRgb(tokens.colors["on-tertiary-action"]));
  expect(getComputedStyle(active).color).toBe(interactiveColor);
  expect(getComputedStyle(progress).backgroundColor).toBe(interactiveColor);
  expect(getComputedStyle(selectionSwitch).backgroundColor).toBe(interactiveColor);
  expect(getComputedStyle(checkbox).accentColor).toBe(interactiveColor);
  expect(getComputedStyle(radio).accentColor).toBe(interactiveColor);
  expect(getComputedStyle(selected).borderColor).toBe(interactiveColor);
  expect(getComputedStyle(action).backgroundColor).toBe(hexToRgb(tokens.colors["tertiary-action"]));
  expect(getComputedStyle(action).color).toBe(hexToRgb(tokens.colors["on-tertiary-action"]));
}

export const AccentAndActionAliases: Story = {
  render: () => (
    <div className="w-[360px] overflow-hidden rounded-lg border border-stroke-soft-200">
      <TokenRow theme="light" />
      <TokenRow theme="dark" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expectPwaAliasRow(canvas, "light");
    expectPwaAliasRow(canvas, "dark");
  },
};
