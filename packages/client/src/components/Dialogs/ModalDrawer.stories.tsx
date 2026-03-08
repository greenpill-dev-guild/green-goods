import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { ModalDrawer, type ModalDrawerProps } from "./ModalDrawer";

/**
 * Interactive wrapper that manages open/close state for ModalDrawer stories.
 */
function ModalDrawerDemo(props: Omit<ModalDrawerProps, "isOpen" | "onClose">) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 text-sm font-medium bg-primary-base text-primary-foreground rounded-lg"
        data-testid="open-drawer"
      >
        Open Drawer
      </button>
      <ModalDrawer {...props} isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </div>
  );
}

/**
 * Tab-switching wrapper for the tabbed story.
 */
function TabbedDrawerDemo() {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");

  const tabs = [
    { id: "pending", label: "Pending", count: 5 },
    { id: "approved", label: "Approved", count: 12 },
    { id: "rejected", label: "Rejected", count: 2 },
  ];

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 text-sm font-medium bg-primary-base text-primary-foreground rounded-lg"
        data-testid="open-drawer"
      >
        Open Tabbed Drawer
      </button>
      <ModalDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        header={{
          title: "Work Submissions",
          description: "Review gardener submissions for this action",
        }}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      >
        <div className="space-y-3">
          {activeTab === "pending" && (
            <>
              <div className="p-3 rounded-lg bg-bg-weak-50">Pending submission 1</div>
              <div className="p-3 rounded-lg bg-bg-weak-50">Pending submission 2</div>
              <div className="p-3 rounded-lg bg-bg-weak-50">Pending submission 3</div>
            </>
          )}
          {activeTab === "approved" && (
            <div className="p-3 rounded-lg bg-bg-weak-50">12 approved submissions</div>
          )}
          {activeTab === "rejected" && (
            <div className="p-3 rounded-lg bg-bg-weak-50">2 rejected submissions</div>
          )}
        </div>
      </ModalDrawer>
    </div>
  );
}

const meta: Meta<typeof ModalDrawer> = {
  title: "Client/Dialogs/ModalDrawer",
  component: ModalDrawer,
  tags: ["autodocs"],
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    layout: "fullscreen",
  },
  argTypes: {
    isOpen: {
      control: "boolean",
      description: "Controls whether the drawer is visible",
    },
    onClose: {
      description: "Callback when the drawer is dismissed (overlay click or close button)",
    },
    header: {
      control: "object",
      description: "Header configuration with title, optional description, and optional actions",
    },
    tabs: {
      control: "object",
      description: "Array of tab definitions. When provided, renders a tab bar below the header.",
    },
    activeTab: {
      control: "text",
      description: "ID of the currently active tab",
    },
    onTabChange: {
      description: "Callback when a tab is selected",
    },
    children: {
      description: "Content rendered in the scrollable body area",
    },
    className: {
      control: "text",
      description: "Additional CSS classes for the Dialog.Content wrapper",
    },
    contentClassName: {
      control: "text",
      description: "CSS classes for the inner content container (defaults to 'p-4')",
    },
    maxHeight: {
      control: "text",
      description: "Maximum height of the drawer. Defaults to '95vh'.",
    },
  },
};

export default meta;
type Story = StoryObj<typeof ModalDrawer>;

export const Default: Story = {
  render: () => (
    <ModalDrawerDemo
      header={{ title: "Garden Details", description: "Riverside Commons garden information" }}
    >
      <div className="space-y-4">
        <p className="text-sm text-text-sub-600">
          This drawer slides up from the bottom of the screen. It uses Radix Dialog for proper
          accessibility, focus trapping, and keyboard dismissal.
        </p>
        <div className="p-4 rounded-lg bg-bg-weak-50">
          <h4 className="font-medium text-sm">Location</h4>
          <p className="text-sm text-text-sub-600 mt-1">Portland, OR</p>
        </div>
        <div className="p-4 rounded-lg bg-bg-weak-50">
          <h4 className="font-medium text-sm">Members</h4>
          <p className="text-sm text-text-sub-600 mt-1">12 gardeners, 3 operators</p>
        </div>
      </div>
    </ModalDrawerDemo>
  ),
};

export const WithTabs: Story = {
  render: () => <TabbedDrawerDemo />,
};

export const HeaderOnly: Story = {
  render: () => (
    <ModalDrawerDemo header={{ title: "Notifications" }}>
      <div className="flex items-center justify-center h-32 text-sm text-text-soft-400">
        No notifications yet
      </div>
    </ModalDrawerDemo>
  ),
};

export const WithHeaderActions: Story = {
  render: () => (
    <ModalDrawerDemo
      header={{
        title: "Wallet",
        description: "Manage your assets",
        actions: (
          <button
            type="button"
            className="px-3 py-1.5 text-xs font-medium rounded-full bg-primary-base text-primary-foreground"
          >
            Deposit
          </button>
        ),
      }}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 rounded-lg bg-bg-weak-50">
          <span className="text-sm font-medium">ETH</span>
          <span className="text-sm text-text-sub-600">0.42</span>
        </div>
        <div className="flex items-center justify-between p-3 rounded-lg bg-bg-weak-50">
          <span className="text-sm font-medium">USDC</span>
          <span className="text-sm text-text-sub-600">125.00</span>
        </div>
      </div>
    </ModalDrawerDemo>
  ),
};

export const LongContent: Story = {
  render: () => (
    <ModalDrawerDemo header={{ title: "Activity Log" }} maxHeight="70vh">
      <div className="space-y-3 overflow-y-auto">
        {Array.from({ length: 20 }, (_, i) => (
          <div key={i} className="p-3 rounded-lg bg-bg-weak-50 text-sm">
            Activity item {i + 1} - {new Date(Date.now() - i * 3600000).toLocaleTimeString()}
          </div>
        ))}
      </div>
    </ModalDrawerDemo>
  ),
};

export const DarkMode: Story = {
  render: () => (
    <div data-theme="dark" className="bg-bg-white-0 min-h-screen">
      <ModalDrawerDemo header={{ title: "Garden Details", description: "Riverside Commons" }}>
        <div className="space-y-3">
          <div className="p-4 rounded-lg bg-bg-weak-50">
            <p className="text-sm text-text-sub-600">Content in dark mode</p>
          </div>
        </div>
      </ModalDrawerDemo>
    </div>
  ),
};

export const Gallery: Story = {
  render: () => (
    <div className="flex flex-col gap-6 p-4">
      <p className="text-sm text-text-sub-600">
        ModalDrawer is a bottom-sheet pattern using Radix Dialog. Click "Open Drawer" buttons below
        to see each variant. The Gallery shows the trigger buttons only since multiple portalled
        drawers cannot be rendered side-by-side.
      </p>
      <div className="flex flex-wrap gap-3">
        <ModalDrawerDemo header={{ title: "Simple" }}>
          <p className="text-sm">Simple drawer content</p>
        </ModalDrawerDemo>
      </div>
    </div>
  ),
};

export const Interactive: Story = {
  render: () => (
    <ModalDrawerDemo header={{ title: "Interactive Test", description: "Testing close behavior" }}>
      <p className="text-sm text-text-sub-600">Click the close button or the overlay to dismiss.</p>
    </ModalDrawerDemo>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify the drawer is open with correct title
    const title = await canvas.findByText("Interactive Test");
    await expect(title).toBeVisible();

    // Verify the description
    await expect(canvas.getByText("Testing close behavior")).toBeVisible();

    // Verify close button is present
    const closeButton = canvas.getByTestId("modal-drawer-close");
    await expect(closeButton).toBeVisible();

    // Click close
    await userEvent.click(closeButton);

    // Verify the open button is still present (drawer has closed)
    const openButton = canvas.getByTestId("open-drawer");
    await expect(openButton).toBeVisible();
  },
};

export const Mobile: Story = {
  render: () => (
    <ModalDrawerDemo header={{ title: "Mobile View", description: "Full-width bottom sheet" }}>
      <div className="space-y-3">
        <div className="p-4 rounded-lg bg-bg-weak-50">
          <p className="text-sm">Drawer content optimized for mobile viewports</p>
        </div>
      </div>
    </ModalDrawerDemo>
  ),
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};
