import { cn } from "@green-goods/shared";
import {
  RiArrowRightSLine,
  RiBankLine,
  RiDashboardLine,
  RiHammerFill,
  RiMenuLine,
  RiPlantLine,
  RiSearchLine,
  RiSettings3Line,
  RiUploadLine,
} from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useIntl } from "react-intl";
import { expect, within } from "storybook/test";

// ─── Mock DashboardLayout ────────────────────────────────────────────
// Composes inline sidebar + header + content area without requiring
// React Router, Zustand stores, or data-fetching hooks.

interface MockDashboardLayoutProps {
  /** User role — controls sidebar navigation items */
  role: "deployer" | "operator" | "user";
  /** Currently active route */
  activePath: string;
  /** Chain label shown in header */
  chainLabel: string;
  /** Breadcrumb segments */
  breadcrumbs: { label: string; href: string }[];
  /** Content to render in the main area */
  children?: React.ReactNode;
}

interface NavItem {
  label: string;
  href: string;
  icon: typeof RiDashboardLine;
  roles: string[];
}

const generalNav: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: RiDashboardLine,
    roles: ["deployer", "operator", "user"],
  },
  {
    label: "Gardens",
    href: "/gardens",
    icon: RiPlantLine,
    roles: ["deployer", "operator", "user"],
  },
  { label: "Endowments", href: "/endowments", icon: RiBankLine, roles: ["deployer", "operator"] },
  { label: "Actions", href: "/actions", icon: RiHammerFill, roles: ["deployer", "operator"] },
];

const adminNavItems: NavItem[] = [
  { label: "Contracts", href: "/contracts", icon: RiSettings3Line, roles: ["deployer"] },
  { label: "Deployment", href: "/deployment", icon: RiUploadLine, roles: ["deployer"] },
];

function MockDashboardLayout({
  role,
  activePath,
  chainLabel,
  breadcrumbs,
  children,
}: MockDashboardLayoutProps) {
  const { formatMessage } = useIntl();

  const filteredGeneral = generalNav.filter((item) => item.roles.includes(role));
  const filteredAdmin = adminNavItems.filter((item) => item.roles.includes(role));

  const renderNavItem = (item: NavItem) => {
    const isActive =
      activePath === item.href || (item.href !== "/dashboard" && activePath.startsWith(item.href));
    return (
      <a
        key={item.href}
        href={item.href}
        onClick={(e) => e.preventDefault()}
        className={cn(
          "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
          isActive
            ? "bg-primary-alpha-16 text-primary-darker"
            : "text-text-sub hover:bg-bg-weak hover:text-text-strong"
        )}
      >
        <item.icon className="mr-3 h-5 w-5" />
        {item.label}
      </a>
    );
  };

  return (
    <div className="flex h-screen bg-bg-weak">
      {/* Skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-primary-base focus:text-primary-foreground focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Skip to content
      </a>

      {/* Sidebar */}
      <div className="w-64 bg-bg-white shadow-lg flex flex-col">
        <div className="flex items-center gap-2 h-16 px-6 border-b border-stroke-soft shadow-sm">
          <img src="/green-goods-logo.png" alt="" className="h-5 w-auto" />
          <h1 className="font-heading text-lg font-semibold text-text-strong">Green Goods</h1>
        </div>
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
      </div>

      {/* Main column */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-bg-soft shadow-sm border-b border-stroke-sub">
          <div className="flex items-center justify-between h-16 px-6">
            <button
              aria-label="Open navigation menu"
              className="lg:hidden min-h-11 min-w-11 p-2 rounded-md text-text-soft"
            >
              <RiMenuLine className="h-6 w-6" />
            </button>

            <div className="flex-1 min-w-0 hidden lg:block">
              {breadcrumbs.length > 1 && (
                <nav aria-label="Breadcrumb">
                  <ol className="flex items-center gap-1 text-sm">
                    {breadcrumbs.map((seg, i) => {
                      const isLast = i === breadcrumbs.length - 1;
                      return (
                        <li key={seg.href} className="flex items-center gap-1">
                          {i > 0 && (
                            <RiArrowRightSLine
                              className="h-4 w-4 text-text-soft"
                              aria-hidden="true"
                            />
                          )}
                          {isLast ? (
                            <span className="font-medium text-text-strong" aria-current="page">
                              {seg.label}
                            </span>
                          ) : (
                            <a
                              href={seg.href}
                              onClick={(e) => e.preventDefault()}
                              className="text-text-sub hover:text-text-strong transition-colors"
                            >
                              {seg.label}
                            </a>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </nav>
              )}
            </div>

            <div className="flex-1 lg:hidden" />

            <div className="flex items-center gap-2">
              <button
                aria-label="Search"
                className="min-h-11 min-w-11 p-2 rounded-md text-text-soft hover:text-text-sub"
              >
                <RiSearchLine className="h-5 w-5" />
              </button>
              <div className="px-3 py-2 rounded-md border border-stroke-sub bg-bg-white text-sm text-text-strong">
                {chainLabel}
              </div>
              <div className="flex items-center space-x-3 p-2 rounded-lg">
                <div className="text-right">
                  <div className="text-sm font-medium text-text-strong capitalize">{role}</div>
                  <div className="text-xs font-mono text-text-sub">0xd8dA...6045</div>
                </div>
                <div className="h-8 w-8 bg-bg-soft rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-text-sub">
                    {role === "deployer" ? "D" : role === "operator" ? "O" : "U"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content area */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto"
          style={{ overscrollBehaviorY: "contain", WebkitOverflowScrolling: "touch" }}
        >
          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

// ─── Placeholder content ─────────────────────────────────────────────

function PlaceholderContent({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-text-strong">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {["Active Gardens", "Total Members", "Pending Actions"].map((stat) => (
          <div key={stat} className="bg-bg-white rounded-xl border border-stroke-soft p-6">
            <p className="text-sm text-text-sub">{stat}</p>
            <p className="text-3xl font-bold text-text-strong mt-1">
              {Math.floor(Math.random() * 100)}
            </p>
          </div>
        ))}
      </div>
      <div className="bg-bg-white rounded-xl border border-stroke-soft p-6 h-64 flex items-center justify-center">
        <p className="text-text-soft">Content area placeholder</p>
      </div>
    </div>
  );
}

// ─── Meta ────────────────────────────────────────────────────────────

const meta: Meta<typeof MockDashboardLayout> = {
  title: "Admin/Layout/DashboardLayout",
  component: MockDashboardLayout,
  tags: ["autodocs"],
  args: {
    role: "deployer",
    activePath: "/gardens",
    chainLabel: "Sepolia",
    breadcrumbs: [
      { label: "Gardens", href: "/gardens" },
      { label: "Community Forest", href: "/gardens/0x1234" },
    ],
    children: <PlaceholderContent title="Garden Detail" />,
  },
  argTypes: {
    role: {
      control: "select",
      options: ["deployer", "operator", "user"],
      description: "User role — controls sidebar items and profile badge",
    },
    activePath: {
      control: "select",
      options: ["/dashboard", "/gardens", "/endowments", "/actions", "/contracts", "/deployment"],
      description: "Active route path (highlights matching sidebar item)",
    },
    chainLabel: {
      control: "select",
      options: ["Sepolia", "Arbitrum One", "Celo"],
      description: "Network label in the header",
    },
    breadcrumbs: {
      control: "object",
      description: "Breadcrumb segments shown in the header",
    },
  },
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof MockDashboardLayout>;

export const Default: Story = {};

export const DashboardView: Story = {
  args: {
    activePath: "/dashboard",
    breadcrumbs: [{ label: "Dashboard", href: "/dashboard" }],
    children: <PlaceholderContent title="Dashboard" />,
  },
};

export const OperatorView: Story = {
  args: {
    role: "operator",
    activePath: "/endowments",
    breadcrumbs: [{ label: "Endowments", href: "/endowments" }],
    children: <PlaceholderContent title="Endowments" />,
  },
};

export const UserView: Story = {
  args: {
    role: "user",
    activePath: "/gardens",
    breadcrumbs: [{ label: "Gardens", href: "/gardens" }],
    children: <PlaceholderContent title="Gardens" />,
  },
};

export const Gallery: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {(["deployer", "operator", "user"] as const).map((role) => (
        <div
          key={role}
          className="border border-stroke-soft-200 rounded-lg overflow-hidden h-[350px]"
        >
          <p className="text-xs text-text-sub-600 p-2 bg-bg-weak-50 capitalize">{role} view</p>
          <div className="h-[320px]">
            <MockDashboardLayout
              role={role}
              activePath="/gardens"
              chainLabel="Sepolia"
              breadcrumbs={[
                { label: "Gardens", href: "/gardens" },
                { label: "Community Forest", href: "/gardens/0x1234" },
              ]}
            >
              <PlaceholderContent title={`${role} Dashboard`} />
            </MockDashboardLayout>
          </div>
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
    breadcrumbs: [
      { label: "Gardens", href: "/gardens" },
      { label: "Community Forest", href: "/gardens/0x1234" },
    ],
    children: <PlaceholderContent title="Garden Detail" />,
  },
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0">
        <Story />
      </div>
    ),
  ],
};

export const Interactive: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify sidebar branding
    await expect(canvas.getByText("Green Goods")).toBeVisible();

    // Verify sidebar navigation
    const nav = canvas.getByRole("navigation", { name: /main navigation/i });
    await expect(nav).toBeVisible();
    await expect(within(nav).getByText("Gardens")).toBeVisible();

    // Verify the main content area is accessible via skip link target
    const mainContent = canvasElement.querySelector("#main-content");
    expect(mainContent).not.toBeNull();

    // Verify chain badge
    await expect(canvas.getByText("Sepolia")).toBeVisible();

    // Verify breadcrumbs
    await expect(canvas.getByText("Community Forest")).toBeVisible();
  },
};
