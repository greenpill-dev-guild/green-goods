import type { Meta, StoryObj } from "@storybook/react";
import type { AccountSheetTab } from "@green-goods/shared";
import { type ComponentProps, useState } from "react";
import { fn } from "storybook/test";
import { STORYBOOK_ADMIN_SHELL_SEEDS } from "../../../../shared/.storybook/adminFixtures";
import { withAdminIdentity, withSeededQueryClient } from "../../../../shared/.storybook/decorators";
import { AccountSurface } from "./AccountSurface";

type AccountSurfaceStoryArgs = ComponentProps<typeof AccountSurface> & {
  initialTab: AccountSheetTab;
};

function AccountSurfaceStory({ initialTab }: AccountSurfaceStoryArgs) {
  const [activeTab, setActiveTab] = useState<AccountSheetTab>(initialTab);

  return <AccountSurface activeTab={activeTab} onTabChange={setActiveTab} />;
}

const meta: Meta<AccountSurfaceStoryArgs> = {
  title: "Admin/Shell/AccountSurface",
  component: AccountSurface,
  tags: ["autodocs"],
  decorators: [
    withAdminIdentity,
    withSeededQueryClient(STORYBOOK_ADMIN_SHELL_SEEDS),
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
          "Real `AccountSurface` rendered with Storybook auth, wagmi, and deterministic query seeds. Use the initial tab control to inspect tab-panel composition.",
      },
    },
  },
  args: {
    activeTab: "profile",
    initialTab: "profile",
    onTabChange: fn(),
  },
  argTypes: {
    initialTab: {
      control: "inline-radio",
      options: ["profile", "settings"],
    },
  },
};

export default meta;
type Story = StoryObj<AccountSurfaceStoryArgs>;

export const ProfileTab: Story = {
  render: (args) => <AccountSurfaceStory {...args} />,
};

export const SettingsTab: Story = {
  render: (args) => <AccountSurfaceStory {...args} />,
  args: {
    initialTab: "settings",
  },
};
