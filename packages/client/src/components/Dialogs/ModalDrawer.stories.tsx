import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ModalDrawer, type ModalDrawerProps } from "./ModalDrawer";

const MODAL_DRAWER_MOBILE_VIEWPORT = {
  modalDrawerMobile390x844: {
    name: "Modal drawer mobile 390 x 844",
    styles: { width: "390px", height: "844px" },
    type: "mobile",
  },
} as const;

const SM_BREAKPOINT_PX = 640;
const CENTER_TOLERANCE_PX = 2;
const VIEWPORT_EDGE_TOLERANCE_PX = 1;
const MIN_TOUCH_TARGET_PX = 44;
const ACTIVITY_LOG_TIMES = [
  "09:00",
  "08:00",
  "07:00",
  "06:00",
  "05:00",
  "04:00",
  "03:00",
  "02:00",
  "01:00",
  "00:00",
];

async function waitForSurfaceSettled(surface: HTMLElement) {
  await Promise.all(
    (surface.getAnimations?.() ?? []).map((animation) => animation.finished.catch(() => undefined))
  );
}

async function expectRealEnterAnimation(surface: HTMLElement, keyframe: RegExp) {
  const style = getComputedStyle(surface);
  await expect(style.animationName).toMatch(keyframe);
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    await expect(style.animationDuration).not.toBe("0s");
  }
}

async function expectViewportCoveringElement(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  await expect(rect.left).toBeLessThanOrEqual(VIEWPORT_EDGE_TOLERANCE_PX);
  await expect(rect.top).toBeLessThanOrEqual(VIEWPORT_EDGE_TOLERANCE_PX);
  await expect(rect.right).toBeGreaterThanOrEqual(window.innerWidth - VIEWPORT_EDGE_TOLERANCE_PX);
  await expect(rect.bottom).toBeGreaterThanOrEqual(window.innerHeight - VIEWPORT_EDGE_TOLERANCE_PX);
}

async function expectTouchTarget(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  await expect(rect.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
  await expect(rect.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
}

function hasReducedMotionRule(): boolean {
  return Array.from(document.styleSheets).some((sheet) => {
    let rules: CSSRule[];
    try {
      rules = Array.from(sheet.cssRules ?? []);
    } catch {
      return false;
    }
    return rules.some(
      (rule) =>
        rule instanceof CSSMediaRule &&
        rule.conditionText.includes("prefers-reduced-motion") &&
        rule.cssText.includes("animation-duration: 0.01ms")
    );
  });
}

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
      description: "Additional CSS classes for the drawer panel",
    },
    contentClassName: {
      control: "text",
      description: "CSS classes for the inner content container (defaults to 'p-4')",
    },
    maxHeight: {
      control: "text",
      description: "Maximum height of the drawer. Uses h-modal (85dvh) by default.",
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
          This drawer slides up from the bottom of the screen with a manual focus trap, keyboard
          dismissal, and CSS keyframe animations matching the WorkDashboard pattern.
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
            Activity item {i + 1} - {ACTIVITY_LOG_TIMES[i % ACTIVITY_LOG_TIMES.length]}
          </div>
        ))}
      </div>
    </ModalDrawerDemo>
  ),
};

// storybook-quality-allow dark-mode: verifies drawer token contrast inside the real dark theme scope.
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

export const StateCatalog: Story = {
  render: () => (
    <div className="flex flex-col gap-6 p-4">
      <p className="text-sm text-text-sub-600">
        ModalDrawer is a bottom-sheet pattern matching the WorkDashboard modal. Click &ldquo;Open
        Drawer&rdquo; buttons below to see each variant. The Gallery shows the trigger buttons only
        since multiple portalled drawers cannot be rendered side-by-side.
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

export const MobileGeometry: Story = {
  tags: ["storybook-ci"],
  parameters: {
    viewport: {
      defaultViewport: "modalDrawerMobile390x844",
      viewports: MODAL_DRAWER_MOBILE_VIEWPORT,
    },
  },
  render: () => (
    <ModalDrawerDemo
      header={{ title: "Mobile drawer geometry", description: "Full-width bottom sheet" }}
    >
      <div className="space-y-3">
        <div className="p-4 rounded-lg bg-bg-weak-50">
          <p className="text-sm">Drawer content optimized for mobile geometry checks.</p>
        </div>
      </div>
    </ModalDrawerDemo>
  ),
  play: async ({ canvasElement }) => {
    await expect(window.innerWidth).toBeLessThan(SM_BREAKPOINT_PX);

    const canvas = within(canvasElement);
    await canvas.findByText("Mobile drawer geometry");
    const overlay = canvas.getByTestId("modal-drawer-overlay");
    const surface = canvas.getByTestId("modal-drawer");

    await expectViewportCoveringElement(overlay);
    await expectRealEnterAnimation(surface, /modalSlideIn/);
    await waitForSurfaceSettled(surface);

    await waitFor(async () => {
      const rect = surface.getBoundingClientRect();
      await expect(rect.width).toBeGreaterThan(0);
      await expect(rect.height).toBeGreaterThan(0);
      await expect(Math.abs(rect.bottom - window.innerHeight)).toBeLessThanOrEqual(
        CENTER_TOLERANCE_PX
      );
      await expect(rect.left).toBeGreaterThanOrEqual(-VIEWPORT_EDGE_TOLERANCE_PX);
      await expect(rect.right).toBeLessThanOrEqual(window.innerWidth + VIEWPORT_EDGE_TOLERANCE_PX);
    });

    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      window.innerWidth + VIEWPORT_EDGE_TOLERANCE_PX
    );
    await expectTouchTarget(canvas.getByTestId("modal-drawer-close"));
  },
};

export const ReducedMotionContract: Story = {
  tags: ["storybook-ci"],
  render: () => (
    <ModalDrawerDemo header={{ title: "Drawer reduced motion", description: "Motion guard" }}>
      <p className="text-sm text-text-sub-600">Reduced motion dampens drawer keyframes.</p>
    </ModalDrawerDemo>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const surface = await canvas.findByTestId("modal-drawer");

    await waitFor(async () => {
      await expect(getComputedStyle(surface).animationName).toMatch(/modalSlideIn/);
    });
    await expect(hasReducedMotionRule()).toBe(true);
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
