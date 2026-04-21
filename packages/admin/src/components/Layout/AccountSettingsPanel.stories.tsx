import { RiComputerLine, RiLogoutBoxLine, RiMoonLine, RiSunLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

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

      <section className="rounded-xl bg-bg-white p-2 shadow-[var(--edge-rest),var(--elevation-1)]">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-sm font-medium text-error-base transition-colors hover:bg-error-lighter"
        >
          Disconnect
          <RiLogoutBoxLine className="h-4 w-4" aria-hidden="true" />
        </button>
      </section>
    </div>
  );
}

const meta: Meta<typeof MockAccountSettingsPanel> = {
  title: "Admin/Shell/AccountSettingsPanel",
  component: MockAccountSettingsPanel,
  tags: ["autodocs"],
  args: {
    initialTheme: "system",
    network: "Sepolia",
  },
  argTypes: {
    initialTheme: {
      control: "inline-radio",
      options: ["light", "dark", "system"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof MockAccountSettingsPanel>;

export const Default: Story = {};

export const DarkSelected: Story = {
  args: {
    initialTheme: "dark",
  },
};
