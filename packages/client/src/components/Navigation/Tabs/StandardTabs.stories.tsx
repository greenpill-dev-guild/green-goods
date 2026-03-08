import { RiHomeLine, RiPlantLine, RiUserLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { StandardTabs, type StandardTabsProps } from "./StandardTabs";

/**
 * Interactive wrapper that manages active tab state.
 */
function TabsDemo(
  props: Omit<StandardTabsProps, "activeTab" | "onTabChange"> & { initialTab?: string }
) {
  const [activeTab, setActiveTab] = useState(props.initialTab ?? props.tabs[0]?.id ?? "");
  return <StandardTabs {...props} activeTab={activeTab} onTabChange={setActiveTab} />;
}

const basicTabs = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

const tabsWithCounts = [
  { id: "pending", label: "Pending", count: 5 },
  { id: "approved", label: "Approved", count: 12 },
  { id: "rejected", label: "Rejected", count: 0 },
];

const tabsWithIcons = [
  { id: "home", label: "Home", icon: <RiHomeLine className="w-4 h-4" /> },
  { id: "garden", label: "Garden", icon: <RiPlantLine className="w-4 h-4" /> },
  { id: "profile", label: "Profile", icon: <RiUserLine className="w-4 h-4" /> },
];

const tabsWithEmoji = [
  { id: "trees", label: "Trees", icon: "🌳", count: 24 },
  { id: "soil", label: "Soil", icon: "🪨", count: 8 },
  { id: "water", label: "Water", icon: "💧", count: 3 },
];

const tabsWithDisabled = [
  { id: "active", label: "Active" },
  { id: "draft", label: "Drafts", count: 2 },
  { id: "archived", label: "Archived", disabled: true },
];

const meta: Meta<typeof StandardTabs> = {
  title: "Client/Navigation/StandardTabs",
  component: StandardTabs,
  tags: ["autodocs"],
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
  argTypes: {
    tabs: {
      control: "object",
      description: "Array of tab definitions with id, label, optional icon/count/disabled",
    },
    activeTab: {
      control: "text",
      description: "ID of the currently active tab",
    },
    onTabChange: {
      description: "Callback fired with the new tab ID when a tab is clicked",
    },
    className: {
      control: "text",
      description: "Additional CSS classes for the tabs container",
    },
    triggerClassName: {
      control: "text",
      description: "Additional CSS classes applied to each tab button",
    },
    variant: {
      control: "select",
      options: ["default", "compact"],
      description: "Size variant. 'compact' reduces vertical padding.",
    },
    isLoading: {
      control: "boolean",
      description: "Shows an animated loading indicator on the active tab's bottom border",
    },
    scrollTargetSelector: {
      control: "text",
      description: "CSS selector for the container to scroll to top on tab change",
    },
  },
};

export default meta;
type Story = StoryObj<typeof StandardTabs>;

export const Default: Story = {
  render: () => <TabsDemo tabs={basicTabs} />,
};

export const WithCounts: Story = {
  render: () => <TabsDemo tabs={tabsWithCounts} />,
};

export const WithIcons: Story = {
  render: () => <TabsDemo tabs={tabsWithIcons} />,
};

export const WithEmoji: Story = {
  render: () => <TabsDemo tabs={tabsWithEmoji} />,
};

export const WithDisabled: Story = {
  render: () => <TabsDemo tabs={tabsWithDisabled} />,
};

export const Compact: Story = {
  render: () => <TabsDemo tabs={basicTabs} variant="compact" />,
};

export const Loading: Story = {
  render: () => <TabsDemo tabs={basicTabs} isLoading />,
};

export const LargeCount: Story = {
  render: () => (
    <TabsDemo
      tabs={[
        { id: "all", label: "All", count: 150 },
        { id: "mine", label: "Mine", count: 3 },
      ]}
    />
  ),
};

export const DarkMode: Story = {
  render: () => (
    <div data-theme="dark" className="bg-bg-white-0 p-4">
      <TabsDemo tabs={tabsWithCounts} />
    </div>
  ),
};

export const Gallery: Story = {
  render: () => (
    <div className="flex flex-col gap-6 max-w-sm">
      <div>
        <p className="text-xs text-text-sub-600 font-medium mb-2">Basic tabs</p>
        <TabsDemo tabs={basicTabs} />
      </div>

      <div>
        <p className="text-xs text-text-sub-600 font-medium mb-2">With counts</p>
        <TabsDemo tabs={tabsWithCounts} />
      </div>

      <div>
        <p className="text-xs text-text-sub-600 font-medium mb-2">With React icons</p>
        <TabsDemo tabs={tabsWithIcons} />
      </div>

      <div>
        <p className="text-xs text-text-sub-600 font-medium mb-2">With emoji icons</p>
        <TabsDemo tabs={tabsWithEmoji} />
      </div>

      <div>
        <p className="text-xs text-text-sub-600 font-medium mb-2">Compact variant</p>
        <TabsDemo tabs={basicTabs} variant="compact" />
      </div>

      <div>
        <p className="text-xs text-text-sub-600 font-medium mb-2">Loading state</p>
        <TabsDemo tabs={basicTabs} isLoading />
      </div>

      <div>
        <p className="text-xs text-text-sub-600 font-medium mb-2">With disabled tab</p>
        <TabsDemo tabs={tabsWithDisabled} />
      </div>
    </div>
  ),
};

export const Interactive: Story = {
  render: () => <TabsDemo tabs={tabsWithCounts} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify initial state - first tab is active
    const pendingTab = canvas.getByTestId("tab-pending");
    await expect(pendingTab).toBeVisible();

    // Verify count badge is present
    await expect(canvas.getByText("5")).toBeVisible();

    // Click on Approved tab
    const approvedTab = canvas.getByTestId("tab-approved");
    await userEvent.click(approvedTab);

    // Verify the count badge updates (12 badge visible)
    await expect(canvas.getByText("12")).toBeVisible();

    // Click on Rejected tab (no count badge since count is 0)
    const rejectedTab = canvas.getByTestId("tab-rejected");
    await userEvent.click(rejectedTab);
  },
};

export const Mobile: Story = {
  render: () => <TabsDemo tabs={tabsWithCounts} />,
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};
