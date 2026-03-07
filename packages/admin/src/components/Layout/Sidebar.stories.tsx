import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { cn } from "@green-goods/shared";
import {
  RiBankLine,
  RiCloseLine,
  RiDashboardLine,
  RiHammerFill,
  RiLogoutBoxLine,
  RiPlantLine,
  RiSettings3Line,
  RiUploadLine,
} from "@remixicon/react";
import { useIntl } from "react-intl";

// ─── Mock Sidebar ────────────────────────────────────────────────────
// The real Sidebar uses useAuth, useRole, useUIStore, useLocation, and
// react-router Link. This isolated version accepts props instead.

type UserRole = "deployer" | "operator" | "user";

interface NavItem {
  i18nKey: string;
  defaultMessage: string;
  href: string;
  icon: typeof RiDashboardLine;
  roles: string[];
}

const generalNav: NavItem[] = [
  {
    i18nKey: "app.admin.nav.dashboard",
    defaultMessage: "Dashboard",
    href: "/dashboard",
    icon: RiDashboardLine,
    roles: ["deployer", "operator", "user"],
  },
  {
    i18nKey: "app.admin.nav.gardens",
    defaultMessage: "Gardens",
    href: "/gardens",
    icon: RiPlantLine,
    roles: ["deployer", "operator", "user"],
  },
  {
    i18nKey: "app.admin.nav.treasury",
    defaultMessage: "Endowments",
    href: "/endowments",
    icon: RiBankLine,
    roles: ["deployer", "operator"],
  },
  {
    i18nKey: "app.admin.nav.actions",
    defaultMessage: "Actions",
    href: "/actions",
    icon: RiHammerFill,
    roles: ["deployer", "operator"],
  },
];

const adminNav: NavItem[] = [
  {
    i18nKey: "app.admin.nav.contracts",
    defaultMessage: "Contracts",
    href: "/contracts",
    icon: RiSettings3Line,
    roles: ["deployer"],
  },
  {
    i18nKey: "app.admin.nav.deployment",
    defaultMessage: "Deployment",
    href: "/deployment",
    icon: RiUploadLine,
    roles: ["deployer"],
  },
];

interface MockSidebarProps {
  /** User role — controls which nav items appear */
  role: UserRole;
  /** Currently active route path */
  activePath: string;
  /** Whether sidebar is visible (mobile slide-in) */
  isOpen: boolean;
  /** Called when the sidebar requests closing */
  onClose?: () => void;
  /** Called when sign out is clicked */
  onSignOut?: () => void;
}

function MockSidebar({ role, activePath, isOpen, onClose, onSignOut }: MockSidebarProps) {
  const { formatMessage } = useIntl();

  const filteredGeneral = generalNav.filter((item) => item.roles.includes(role));
  const filteredAdmin = adminNav.filter((item) => item.roles.includes(role));

  const renderNavItem = (item: NavItem) => {
    const isActive =
      activePath === item.href || (item.href !== "/dashboard" && activePath.startsWith(item.href));
    const label = formatMessage({
      id: item.i18nKey,
      defaultMessage: item.defaultMessage,
    });

    return (
      <a
        key={item.i18nKey}
        href={item.href}
        onClick={(e) => {
          e.preventDefault();
          onClose?.();
        }}
        className={cn(
          "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
          isActive
            ? "bg-primary-alpha-16 text-primary-darker"
            : "text-text-sub hover:bg-bg-weak hover:text-text-strong"
        )}
      >
        <item.icon className="mr-3 h-5 w-5" />
        {label}
      </a>
    );
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <div
        data-testid="sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-bg-white shadow-lg transform transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0 lg:static lg:inset-0"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-stroke-soft shadow-sm">
            <div className="flex items-center gap-2">
              <img src="/green-goods-logo.png" alt="" className="h-5 w-auto" />
              <h1 className="font-heading text-lg font-semibold text-text-strong">Green Goods</h1>
            </div>
            <button
              onClick={onClose}
              aria-label="Close navigation menu"
              className="lg:hidden p-2 rounded-md text-text-soft hover:text-text-sub focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base"
            >
              <RiCloseLine className="h-6 w-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1" aria-label="Main navigation">
            {filteredGeneral.map(renderNavItem)}

            {filteredAdmin.length > 0 && (
              <>
                <div className="pt-4 pb-2">
                  <span className="px-3 subheading-xs text-text-soft">
                    {formatMessage({
                      id: "app.admin.sidebar.admin",
                      defaultMessage: "Admin",
                    })}
                  </span>
                </div>
                {filteredAdmin.map(renderNavItem)}
              </>
            )}
          </nav>

          {/* Footer — mobile sign out */}
          <div className="p-4 border-t border-stroke-soft lg:hidden">
            <button
              onClick={onSignOut}
              className="flex items-center w-full px-3 py-2 text-sm font-medium text-text-sub rounded-md hover:bg-bg-weak hover:text-text-strong transition-colors"
            >
              <RiLogoutBoxLine className="mr-3 h-5 w-5" />
              {formatMessage({
                id: "app.admin.sidebar.signOut",
                defaultMessage: "Sign Out",
              })}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Meta ────────────────────────────────────────────────────────────

const meta: Meta<typeof MockSidebar> = {
  title: "Admin/Layout/Sidebar",
  component: MockSidebar,
  tags: ["autodocs"],
  args: {
    role: "deployer",
    activePath: "/gardens",
    isOpen: true,
  },
  argTypes: {
    role: {
      control: "select",
      options: ["deployer", "operator", "user"],
      description: "User role — controls which navigation items are visible",
    },
    activePath: {
      control: "select",
      options: ["/dashboard", "/gardens", "/endowments", "/actions", "/contracts", "/deployment"],
      description: "Currently active route (highlights the matching nav item)",
    },
    isOpen: {
      control: "boolean",
      description: "Whether the sidebar is open (relevant for mobile slide-in behavior)",
    },
    onClose: {
      action: "closed",
      description: "Callback when the sidebar requests closing",
    },
    onSignOut: {
      action: "signedOut",
      description: "Callback when sign out is clicked",
    },
  },
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof MockSidebar>;

export const Default: Story = {};

export const OperatorRole: Story = {
  args: {
    role: "operator",
    activePath: "/endowments",
  },
};

export const UserRole: Story = {
  args: {
    role: "user",
    activePath: "/dashboard",
  },
};

export const Collapsed: Story = {
  name: "Collapsed (Mobile)",
  args: {
    isOpen: false,
  },
};

export const Gallery: Story = {
  render: () => (
    <div className="flex gap-8">
      {(["deployer", "operator", "user"] as const).map((role) => (
        <div
          key={role}
          className="relative h-[500px] w-64 overflow-hidden border border-stroke-soft-200 rounded-lg"
        >
          <p className="text-xs text-text-sub-600 p-2 bg-bg-weak-50 capitalize">{role}</p>
          <MockSidebar role={role} activePath="/gardens" isOpen={true} />
        </div>
      ))}
    </div>
  ),
  parameters: {
    layout: "padded",
  },
};

export const DarkMode: Story = {
  args: {
    role: "deployer",
    activePath: "/gardens",
    isOpen: true,
  },
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 min-h-screen">
        <Story />
      </div>
    ),
  ],
};

export const Interactive: Story = {
  args: {
    isOpen: true,
    role: "deployer",
    activePath: "/dashboard",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify the sidebar is visible
    const sidebar = canvas.getByTestId("sidebar");
    await expect(sidebar).toBeVisible();

    // Verify navigation items are present
    await expect(canvas.getByText("Dashboard")).toBeVisible();
    await expect(canvas.getByText("Gardens")).toBeVisible();
    await expect(canvas.getByText("Endowments")).toBeVisible();
    await expect(canvas.getByText("Actions")).toBeVisible();

    // Verify admin section is visible for deployer role
    await expect(canvas.getByText("Admin")).toBeVisible();
    await expect(canvas.getByText("Contracts")).toBeVisible();
    await expect(canvas.getByText("Deployment")).toBeVisible();

    // Verify active state — Dashboard should be highlighted
    const dashboardLink = canvas.getByText("Dashboard").closest("a");
    await expect(dashboardLink).toHaveClass("bg-primary-alpha-16");
  },
};
