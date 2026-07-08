import { RiComputerLine, RiMoonLine, RiSunLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, within } from "storybook/test";
import { withAdminIdentity } from "../../../../shared/.storybook/decorators";
import { AccountSettingsPanel } from "./AccountSettingsPanel";

type ThemeValue = "light" | "dark" | "system";

interface MockAccountSettingsPanelProps {
  initialTheme: ThemeValue;
  network: string;
}

const themeOptions = [
  { value: "light" as const, label: "Light", icon: RiSunLine },
  { value: "dark" as const, label: "Dark", icon: RiMoonLine },
  { value: "system" as const, label: "System", icon: RiComputerLine },
];

function MockAccountSettingsPanel({ initialTheme, network }: MockAccountSettingsPanelProps) {
  const [theme, setTheme] = useState<ThemeValue>(initialTheme);

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <section className="space-y-4 rounded-xl bg-bg-white p-4 shadow-[var(--edge-rest),var(--elevation-1)]">
        <div>
          <h2 className="text-sm font-semibold text-text-strong">Theme</h2>
          <p className="mt-1 text-sm text-text-sub">
            Choose the canvas atmosphere for long review sessions.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {themeOptions.map(({ value, label, icon: Icon }) => {
            const active = theme === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={
                  active
                    ? "flex items-center justify-between rounded-lg bg-primary-alpha-10 px-4 py-3 text-sm font-medium text-primary-dark shadow-[var(--edge-rest)]"
                    : "flex items-center justify-between rounded-lg bg-bg-soft px-4 py-3 text-sm font-medium text-text-sub shadow-[var(--edge-rest)] transition-colors hover:bg-bg-weak"
                }
              >
                {label}
                <Icon className="h-4 w-4" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3 rounded-xl bg-bg-white p-4 shadow-[var(--edge-rest),var(--elevation-1)]">
        <h2 className="text-sm font-semibold text-text-strong">Network</h2>
        <div className="rounded-xl bg-bg-soft px-4 py-3 text-sm font-medium text-text-strong">
          {network}
        </div>
      </section>
    </div>
  );
}

const meta: Meta<typeof AccountSettingsPanel> = {
  title: "Admin/Shell/AccountSettingsPanel",
  component: AccountSettingsPanel,
  tags: ["autodocs"],
  decorators: [
    withAdminIdentity,
    (Story) => (
      <div className="mx-auto max-w-xl p-4">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Real `AccountSettingsPanel` rendered with Storybook auth and theme state — Appearance, Language, Network, and About sections (identity actions live in the Account panel). Static selected-theme references are marked as visual harnesses.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AccountSettingsPanel>;

export const Default: Story = {
  tags: ["storybook-ci"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = canvasElement.querySelector('[data-component="SheetBody"]');
    const footer = canvasElement.querySelector('[data-component="SheetFooter"]');

    await expect(body).not.toBeNull();
    // Disconnect moved to the Account panel — settings hold preferences only.
    await expect(footer).toBeNull();
    await expect(await canvas.findByRole("heading", { name: "Theme" })).toBeVisible();
    await expect(await canvas.findByRole("heading", { name: "Language" })).toBeVisible();
    await expect(await canvas.findByRole("heading", { name: "Network" })).toBeVisible();
    await expect(await canvas.findByRole("heading", { name: "About" })).toBeVisible();
    await expect(canvas.getByRole("radio", { name: "English" })).toBeVisible();
    await expect(canvas.getByRole("link", { name: /Documentation/ })).toBeVisible();
    await expect(canvas.queryByText("Disconnect")).not.toBeInTheDocument();
  },
};

export const DarkSelected: Story = {
  tags: ["visual-harness"],
  render: () => <MockAccountSettingsPanel initialTheme="dark" network="Sepolia" />,
  parameters: {
    docs: {
      description: {
        story:
          "Visual harness for the selected dark theme row. Use the global Storybook theme toolbar for actual light/dark rendering.",
      },
    },
  },
};
