import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, waitFor } from "storybook/test";
import {
  RiArrowDownSLine,
  RiComputerLine,
  RiLogoutBoxLine,
  RiMoonLine,
  RiSunLine,
  RiUserLine,
} from "@remixicon/react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useIntl } from "react-intl";
import { cn } from "@green-goods/shared";
import type { Address } from "@green-goods/shared";
import { AddressDisplay } from "../AddressDisplay";

// ─── Mock UserProfile ────────────────────────────────────────────────
// The real UserProfile calls useAuth, useRole, and useTheme which require
// full provider stacks. This isolated version accepts props instead.

type Theme = "light" | "dark" | "system";

interface MockUserProfileProps {
  /** User role to display */
  role: "deployer" | "operator" | "user";
  /** Wallet address */
  address: Address;
  /** Currently active theme */
  theme: Theme;
  /** Called when user picks a theme */
  onThemeChange?: (theme: Theme) => void;
  /** Called when user clicks disconnect */
  onDisconnect?: () => void;
}

function MockUserProfile({
  role,
  address,
  theme,
  onThemeChange,
  onDisconnect,
}: MockUserProfileProps) {
  const { formatMessage } = useIntl();

  const getThemeIcon = (mode: string) => {
    switch (mode) {
      case "light":
        return <RiSunLine className="mr-3 h-4 w-4" />;
      case "dark":
        return <RiMoonLine className="mr-3 h-4 w-4" />;
      default:
        return <RiComputerLine className="mr-3 h-4 w-4" />;
    }
  };

  const getThemeLabel = (mode: string) => {
    switch (mode) {
      case "light":
        return formatMessage({
          id: "app.admin.userProfile.lightMode",
          defaultMessage: "Light Mode",
        });
      case "dark":
        return formatMessage({
          id: "app.admin.userProfile.darkMode",
          defaultMessage: "Dark Mode",
        });
      default:
        return formatMessage({
          id: "app.admin.userProfile.system",
          defaultMessage: "System",
        });
    }
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center space-x-3 p-2 rounded-lg hover:bg-bg-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base">
          <div className="text-right">
            <div className="text-sm font-medium text-text-strong capitalize">{role}</div>
            <div className="text-xs">
              <AddressDisplay address={address} showCopyButton={false} />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 bg-bg-soft rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-text-sub">
                {role === "deployer" ? "D" : role === "operator" ? "O" : "U"}
              </span>
            </div>
            <RiArrowDownSLine
              className="h-4 w-4 text-text-soft transition-transform"
              aria-hidden="true"
            />
          </div>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="w-64 bg-bg-soft rounded-lg shadow-xl border border-stroke-sub z-50 ring-1 ring-black/5 animate-fade-in-up"
        >
          <DropdownMenu.Label className="px-4 py-3 border-b border-stroke-sub">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-bg-weak rounded-full flex items-center justify-center">
                <RiUserLine className="h-5 w-5 text-text-sub" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text-strong capitalize">
                  {formatMessage(
                    {
                      id: "app.admin.userProfile.roleAccount",
                      defaultMessage: "{role} Account",
                    },
                    { role }
                  )}
                </div>
                <div className="text-xs">
                  <AddressDisplay address={address} showCopyButton={true} />
                </div>
              </div>
            </div>
          </DropdownMenu.Label>

          <DropdownMenu.Group>
            <DropdownMenu.Label className="px-4 pt-3 pb-1 text-xs font-medium text-text-soft uppercase tracking-wider">
              {formatMessage({
                id: "app.admin.userProfile.theme",
                defaultMessage: "Theme",
              })}
            </DropdownMenu.Label>
            {(["light", "dark", "system"] as const).map((mode) => (
              <DropdownMenu.Item
                key={mode}
                onSelect={() => onThemeChange?.(mode)}
                className={cn(
                  "flex items-center mx-2 px-3 py-2 text-sm rounded-md transition-colors cursor-pointer outline-none",
                  theme === mode
                    ? "bg-success-lighter text-success-dark border border-success-light"
                    : "text-text-sub hover:bg-bg-weak data-[highlighted]:bg-bg-weak"
                )}
              >
                {getThemeIcon(mode)}
                <span className="flex-1 text-left">{getThemeLabel(mode)}</span>
                {theme === mode && <div className="w-2 h-2 bg-success-base rounded-full" />}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Group>

          <DropdownMenu.Separator className="border-t border-stroke-soft my-2" />

          <DropdownMenu.Item
            onSelect={() => onDisconnect?.()}
            className="flex items-center w-full px-4 py-2 text-sm text-error-base hover:bg-error-lighter data-[highlighted]:bg-error-lighter transition-colors cursor-pointer outline-none"
          >
            <RiLogoutBoxLine className="mr-3 h-4 w-4" />
            {formatMessage({
              id: "app.admin.userProfile.disconnect",
              defaultMessage: "Disconnect",
            })}
          </DropdownMenu.Item>

          <div className="py-1" />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

// ─── Meta ────────────────────────────────────────────────────────────

const MOCK_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as Address;

const meta: Meta<typeof MockUserProfile> = {
  title: "Admin/Layout/UserProfile",
  component: MockUserProfile,
  tags: ["autodocs"],
  args: {
    role: "deployer",
    address: MOCK_ADDRESS,
    theme: "light",
  },
  argTypes: {
    role: {
      control: "select",
      options: ["deployer", "operator", "user"],
      description: "The user's primary role in the system",
    },
    address: {
      control: "text",
      description: "Ethereum wallet address",
    },
    theme: {
      control: "select",
      options: ["light", "dark", "system"],
      description: "Currently active theme",
    },
    onThemeChange: {
      action: "themeChanged",
      description: "Callback when a theme option is selected",
    },
    onDisconnect: {
      action: "disconnected",
      description: "Callback when the user clicks disconnect",
    },
  },
};

export default meta;
type Story = StoryObj<typeof MockUserProfile>;

export const Default: Story = {};

export const Operator: Story = {
  args: {
    role: "operator",
    theme: "dark",
  },
};

export const User: Story = {
  args: {
    role: "user",
    theme: "system",
  },
};

export const Gallery: Story = {
  render: () => (
    <div className="flex flex-wrap gap-8 items-start">
      {(["deployer", "operator", "user"] as const).map((role) => (
        <div key={role} className="flex flex-col items-center gap-2">
          <p className="text-xs text-text-sub-600 capitalize">{role}</p>
          <MockUserProfile role={role} address={MOCK_ADDRESS} theme="light" />
        </div>
      ))}
    </div>
  ),
};

export const DarkMode: Story = {
  args: {
    role: "deployer",
    theme: "dark",
  },
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4">
        <Story />
      </div>
    ),
  ],
};

export const Interactive: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Open the dropdown
    const trigger = canvas.getByRole("button");
    await userEvent.click(trigger);

    // Verify the dropdown content appears (rendered in a portal)
    await waitFor(
      () => {
        const body = within(document.body);
        expect(body.getByText("deployer Account")).toBeVisible();
      },
      { timeout: 2000 }
    );

    // Verify theme options are present
    const body = within(document.body);
    expect(body.getByText("Light Mode")).toBeVisible();
    expect(body.getByText("Dark Mode")).toBeVisible();
    expect(body.getByText("System")).toBeVisible();

    // Verify disconnect button
    expect(body.getByText("Disconnect")).toBeVisible();
  },
};
