import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { AccountTabList } from "./AccountSurface";
import type { AccountSheetTab } from "./accountSheet.events";

interface MockAccountSurfaceProps {
  initialTab: AccountSheetTab;
}

function MockAccountSurface({ initialTab }: MockAccountSurfaceProps) {
  const [activeTab, setActiveTab] = useState<AccountSheetTab>(initialTab);

  return (
    <div className="max-w-xl rounded-xl bg-bg-white p-4 shadow-[var(--edge-rest),var(--elevation-1)]">
      <AccountTabList activeTab={activeTab} onTabChange={setActiveTab} />
      <div
        id="account-panel"
        role="tabpanel"
        aria-labelledby={`account-tab-${activeTab}`}
        className="mt-4 rounded-xl bg-bg-soft p-4 text-sm text-text-sub shadow-[var(--edge-rest)]"
      >
        {activeTab === "settings" ? (
          <div>
            <h3 className="text-sm font-semibold text-text-strong">Settings</h3>
            <p className="mt-1">Theme, network, and disconnect controls.</p>
          </div>
        ) : (
          <div>
            <h3 className="text-sm font-semibold text-text-strong">Profile</h3>
            <p className="mt-1">Wallet identity, role, and ENS details.</p>
          </div>
        )}
      </div>
    </div>
  );
}

const meta: Meta<typeof MockAccountSurface> = {
  title: "Admin/Shell/AccountSurface",
  component: MockAccountSurface,
  tags: ["autodocs"],
  args: {
    initialTab: "profile",
  },
  argTypes: {
    initialTab: {
      control: "inline-radio",
      options: ["profile", "settings"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof MockAccountSurface>;

export const ProfileTab: Story = {};

export const SettingsTab: Story = {
  args: {
    initialTab: "settings",
  },
};
