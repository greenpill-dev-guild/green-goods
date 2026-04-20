import {
  RiComputerLine,
  RiFileCopyLine,
  RiLogoutBoxLine,
  RiMoonLine,
  RiSettings3Line,
  RiSunLine,
} from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";

interface MockUserMenuProps {
  role: "deployer" | "operator" | "user";
  address?: string;
  open?: boolean;
  onOpenSettings?: () => void;
}

function MockUserMenu({
  role,
  address = "0x2aa6...35e",
  open = true,
  onOpenSettings,
}: MockUserMenuProps) {
  const roleInitial = role === "deployer" ? "D" : role === "operator" ? "O" : "U";

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-weak text-sm font-medium text-text-sub shadow-[var(--edge-rest)]"
        aria-label="User menu"
      >
        {roleInitial}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-overlay min-w-[220px] rounded-xl border border-stroke-soft bg-bg-white p-2 shadow-[var(--edge-rest),var(--elevation-2)]">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-soft text-xs font-medium text-text-sub">
              {roleInitial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium capitalize text-text-strong">{role}</div>
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-text-soft transition-colors hover:text-text-sub"
              >
                <span>{address}</span>
                <RiFileCopyLine className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="my-1 h-px bg-stroke-soft" />
          <div className="px-2 py-1 text-xs font-medium text-text-soft">Theme</div>
          <div className="flex gap-1 px-2 py-1">
            {[RiSunLine, RiMoonLine, RiComputerLine].map((Icon, index) => (
              <button
                key={index}
                type="button"
                className="flex flex-1 justify-center rounded-lg px-2 py-1.5 text-text-sub hover:bg-bg-weak"
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ))}
          </div>

          <div className="my-1 h-px bg-stroke-soft" />
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-text-sub hover:bg-bg-weak"
          >
            <RiSettings3Line className="h-4 w-4" aria-hidden="true" />
            More settings
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium text-error-base hover:bg-error-lighter"
          >
            <RiLogoutBoxLine className="h-4 w-4" aria-hidden="true" />
            Disconnect
          </button>
        </div>
      ) : null}
    </div>
  );
}

const meta: Meta<typeof MockUserMenu> = {
  title: "Admin/Layout/UserMenu",
  component: MockUserMenu,
  tags: ["autodocs"],
  args: {
    role: "operator",
    address: "0x2aa6...35e",
    open: true,
    onOpenSettings: fn(),
  },
  argTypes: {
    role: {
      control: "select",
      options: ["deployer", "operator", "user"],
    },
    open: {
      control: "boolean",
    },
  },
};

export default meta;
type Story = StoryObj<typeof MockUserMenu>;

export const Open: Story = {};

export const Closed: Story = {
  args: {
    open: false,
  },
};
