import { type Address, cn } from "@green-goods/shared";
import { RiArrowRightSLine, RiMenuLine, RiSearchLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useIntl } from "react-intl";
import { expect, within } from "storybook/test";

// ─── Mock Header ─────────────────────────────────────────────────────
// The real Header uses useUIStore, getChainName, DEFAULT_CHAIN_ID, and
// child components that depend on providers. This isolated version uses
// props and inline mock subcomponents.

interface MockHeaderProps {
  /** Network chain label */
  chainLabel: string;
  /** Breadcrumb segments to display */
  breadcrumbs: { label: string; href: string }[];
  /** User role text */
  role: "deployer" | "operator" | "user";
  /** Truncated wallet address to show */
  displayAddress: string;
  /** Called when mobile menu button is clicked */
  onMenuOpen?: () => void;
}

function MockHeader({
  chainLabel,
  breadcrumbs,
  role,
  displayAddress,
  onMenuOpen,
}: MockHeaderProps) {
  const { formatMessage } = useIntl();

  return (
    <header className="bg-bg-soft shadow-sm border-b border-stroke-sub">
      <div className="flex items-center justify-between h-16 px-6">
        {/* Mobile menu button */}
        <button
          onClick={onMenuOpen}
          aria-label="Open navigation menu"
          className="lg:hidden min-h-11 min-w-11 p-2 rounded-md text-text-soft hover:text-text-sub focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base"
        >
          <RiMenuLine className="h-6 w-6" />
        </button>

        {/* Breadcrumbs */}
        <div className="flex-1 min-w-0 hidden lg:block">
          {breadcrumbs.length > 1 && (
            <nav
              aria-label={formatMessage({
                id: "app.admin.nav.breadcrumb",
                defaultMessage: "Breadcrumb",
              })}
            >
              <ol className="flex items-center gap-1 text-sm min-w-0">
                {breadcrumbs.map((segment, index) => {
                  const isLast = index === breadcrumbs.length - 1;
                  return (
                    <li key={segment.href} className="flex items-center gap-1 min-w-0">
                      {index > 0 && (
                        <RiArrowRightSLine
                          className="h-4 w-4 shrink-0 text-text-soft"
                          aria-hidden="true"
                        />
                      )}
                      {isLast ? (
                        <span className="truncate font-medium text-text-strong" aria-current="page">
                          {segment.label}
                        </span>
                      ) : (
                        <a
                          href={segment.href}
                          onClick={(e) => e.preventDefault()}
                          className="truncate text-text-sub hover:text-text-strong transition-colors"
                        >
                          {segment.label}
                        </a>
                      )}
                    </li>
                  );
                })}
              </ol>
            </nav>
          )}
        </div>

        {/* Spacer for mobile */}
        <div className="flex-1 lg:hidden" />

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Search button */}
          <button
            aria-label="Search"
            className="min-h-11 min-w-11 p-2 rounded-md text-text-soft hover:text-text-sub hover:bg-bg-weak transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base"
          >
            <RiSearchLine className="h-5 w-5" />
          </button>

          {/* Chain badge */}
          <div className="px-3 py-2 rounded-md border border-stroke-sub bg-bg-white text-sm text-text-strong">
            {chainLabel}
          </div>

          {/* User profile trigger */}
          <button className="flex items-center space-x-3 p-2 rounded-lg hover:bg-bg-soft transition-colors">
            <div className="text-right">
              <div className="text-sm font-medium text-text-strong capitalize">{role}</div>
              <div className="text-xs font-mono text-text-sub">{displayAddress}</div>
            </div>
            <div className="h-8 w-8 bg-bg-soft rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-text-sub">
                {role === "deployer" ? "D" : role === "operator" ? "O" : "U"}
              </span>
            </div>
          </button>
        </div>
      </div>
    </header>
  );
}

// ─── Meta ────────────────────────────────────────────────────────────

const meta: Meta<typeof MockHeader> = {
  title: "Admin/Layout/Header",
  component: MockHeader,
  tags: ["autodocs"],
  args: {
    chainLabel: "Sepolia",
    breadcrumbs: [
      { label: "Gardens", href: "/gardens" },
      { label: "Community Forest", href: "/gardens/0x1234" },
      { label: "Vault", href: "/gardens/0x1234/vault" },
    ],
    role: "deployer",
    displayAddress: "0xd8dA...6045",
  },
  argTypes: {
    chainLabel: {
      control: "select",
      options: ["Sepolia", "Arbitrum One", "Celo"],
      description: "Network name displayed in the chain badge",
    },
    breadcrumbs: {
      control: "object",
      description: "Breadcrumb segments (label + href pairs)",
    },
    role: {
      control: "select",
      options: ["deployer", "operator", "user"],
      description: "User role displayed in the profile area",
    },
    displayAddress: {
      control: "text",
      description: "Truncated wallet address",
    },
    onMenuOpen: {
      action: "menuOpened",
      description: "Callback for mobile menu button",
    },
  },
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof MockHeader>;

export const Default: Story = {};

export const ShallowBreadcrumbs: Story = {
  args: {
    breadcrumbs: [
      { label: "Gardens", href: "/gardens" },
      { label: "Create", href: "/gardens/create" },
    ],
  },
};

export const NoBreadcrumbs: Story = {
  name: "Dashboard (no breadcrumbs)",
  args: {
    breadcrumbs: [{ label: "Dashboard", href: "/dashboard" }],
  },
};

export const ArbitrumChain: Story = {
  args: {
    chainLabel: "Arbitrum One",
    role: "operator",
    displayAddress: "0xaBcD...eF01",
  },
};

export const Gallery: Story = {
  render: () => (
    <div className="flex flex-col gap-0">
      {[
        {
          label: "Deep breadcrumbs",
          props: {
            chainLabel: "Sepolia",
            breadcrumbs: [
              { label: "Gardens", href: "/gardens" },
              { label: "Community Forest", href: "/gardens/0x1234" },
              { label: "Vault", href: "/gardens/0x1234/vault" },
            ],
            role: "deployer" as const,
            displayAddress: "0xd8dA...6045",
          },
        },
        {
          label: "Shallow breadcrumbs",
          props: {
            chainLabel: "Arbitrum One",
            breadcrumbs: [
              { label: "Actions", href: "/actions" },
              { label: "Plant Trees", href: "/actions/plant-trees" },
            ],
            role: "operator" as const,
            displayAddress: "0xaBcD...eF01",
          },
        },
        {
          label: "No breadcrumbs (dashboard)",
          props: {
            chainLabel: "Celo",
            breadcrumbs: [{ label: "Dashboard", href: "/dashboard" }],
            role: "user" as const,
            displayAddress: "0x9876...5432",
          },
        },
      ].map(({ label, props }) => (
        <div key={label}>
          <p className="text-xs text-text-sub-600 px-4 py-1 bg-bg-weak-50">{label}</p>
          <MockHeader {...props} />
        </div>
      ))}
    </div>
  ),
  parameters: {
    layout: "fullscreen",
  },
};

export const DarkMode: Story = {
  args: {
    chainLabel: "Sepolia",
    breadcrumbs: [
      { label: "Gardens", href: "/gardens" },
      { label: "Community Forest", href: "/gardens/0x1234" },
    ],
    role: "deployer",
    displayAddress: "0xd8dA...6045",
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

    // Verify the chain badge
    await expect(canvas.getByText("Sepolia")).toBeVisible();

    // Verify breadcrumbs are rendered
    await expect(canvas.getByText("Gardens")).toBeVisible();
    await expect(canvas.getByText("Community Forest")).toBeVisible();
    await expect(canvas.getByText("Vault")).toBeVisible();

    // Verify user profile area
    await expect(canvas.getByText("deployer")).toBeVisible();
    await expect(canvas.getByText("0xd8dA...6045")).toBeVisible();

    // Verify breadcrumb nav landmark
    const breadcrumbNav = canvas.getByRole("navigation", {
      name: /breadcrumb/i,
    });
    await expect(breadcrumbNav).toBeVisible();

    // Verify last breadcrumb has aria-current
    const lastCrumb = canvas.getByText("Vault");
    await expect(lastCrumb).toHaveAttribute("aria-current", "page");
  },
};
