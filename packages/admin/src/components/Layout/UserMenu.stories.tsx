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
import { STORYBOOK_ADMIN_SHELL_SEEDS } from "../../../../shared/.storybook/adminFixtures";
import { withAdminIdentity, withSeededQueryClient } from "../../../../shared/.storybook/decorators";
import { UserMenu } from "./UserMenu";

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

const meta: Meta<typeof UserMenu> = {
  title: "Admin/Shell/UserMenu",
  component: UserMenu,
  tags: ["autodocs"],
  decorators: [
    withAdminIdentity,
    withSeededQueryClient(STORYBOOK_ADMIN_SHELL_SEEDS),
    (Story) => (
      <div className="flex justify-end p-16">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Real `UserMenu` rendered with Storybook auth, theme, and deterministic query seeds. The open dropdown reference is an explicit visual harness because the production component owns Radix menu state.",
      },
    },
  },
  args: {
    onOpenSettings: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof UserMenu>;

export const Closed: Story = {};

export const Open: Story = {
  tags: ["visual-harness"],
  render: () => <MockUserMenu role="operator" address="0x2aa6...35e" open onOpenSettings={fn()} />,
  parameters: {
    docs: {
      description: {
        story:
          "Visual harness for the open menu panel. The closed/default story above renders the real production dropdown trigger.",
      },
    },
  },
};
