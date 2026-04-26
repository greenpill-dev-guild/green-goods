import { useUIStore } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect } from "react";
import { MemoryRouter } from "react-router-dom";
import { expect, within } from "storybook/test";
import { withClientAppRuntime, withInstalledPwa } from "../../../../shared/.storybook/decorators";
import { AppBar } from "./AppBar";

function WithDrawerOpen({
  drawer,
  children,
}: {
  drawer: "isWorkDashboardOpen" | "isGardenFilterOpen" | "isEndowmentDrawerOpen";
  children: React.ReactNode;
}) {
  useEffect(() => {
    useUIStore.setState({ [drawer]: true });
    return () => {
      useUIStore.setState({ [drawer]: false });
    };
  }, [drawer]);
  return <>{children}</>;
}

/**
 * AppBar requires react-router context (useLocation, Link) and several shared hooks:
 * - usePendingWorksCount (TanStack Query)
 * - useUIStore (Zustand)
 *
 * We provide a MemoryRouter decorator and let the global QueryClientProvider
 * handle queries (they return defaults). The Zustand store initializes with
 * drawers closed by default.
 */
const withRouter = (initialEntries: string[] = ["/home"]) => {
  return (Story: React.ComponentType) => (
    <MemoryRouter initialEntries={initialEntries}>
      <div className="relative h-[200px] bg-bg-white-0">
        <Story />
      </div>
    </MemoryRouter>
  );
};

const meta: Meta<typeof AppBar> = {
  title: "Client/Layout/AppBar",
  component: AppBar,
  tags: ["autodocs", "storybook-ci"],
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    layout: "fullscreen",
  },
  decorators: [withInstalledPwa(), withClientAppRuntime],
};

export default meta;
type Story = StoryObj<typeof AppBar>;

export const Default: Story = {
  decorators: [withRouter(["/home"])],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = canvas.getByTestId("authenticated-nav");
    await expect(nav).toBeVisible();
    expect(nav.className).not.toContain("translate-y-full");
  },
};

export const HomeActive: Story = {
  decorators: [withRouter(["/home"])],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = canvas.getByTestId("authenticated-nav");
    expect(nav.className).not.toContain("translate-y-full");
  },
};

export const HiddenOnGardenRoute: Story = {
  decorators: [withRouter(["/garden"])],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = canvas.getByTestId("authenticated-nav");
    expect(nav.className).toContain("translate-y-full");
  },
};

export const ProfileActive: Story = {
  decorators: [withRouter(["/profile"])],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = canvas.getByTestId("authenticated-nav");
    expect(nav.className).not.toContain("translate-y-full");
  },
};

export const HiddenOnWorkDetailRoute: Story = {
  decorators: [withRouter(["/home/1/work/2"])],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = canvas.getByTestId("authenticated-nav");
    expect(nav.className).toContain("translate-y-full");
  },
};

export const HiddenWhenWorkDashboardOpen: Story = {
  decorators: [
    (Story) => (
      <WithDrawerOpen drawer="isWorkDashboardOpen">
        <Story />
      </WithDrawerOpen>
    ),
    withRouter(["/home"]),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = canvas.getByTestId("authenticated-nav");
    expect(nav.className).toContain("translate-y-full");
  },
};

export const HiddenWhenGardenFilterOpen: Story = {
  decorators: [
    (Story) => (
      <WithDrawerOpen drawer="isGardenFilterOpen">
        <Story />
      </WithDrawerOpen>
    ),
    withRouter(["/home"]),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = canvas.getByTestId("authenticated-nav");
    expect(nav.className).toContain("translate-y-full");
  },
};

export const HiddenWhenEndowmentDrawerOpen: Story = {
  decorators: [
    (Story) => (
      <WithDrawerOpen drawer="isEndowmentDrawerOpen">
        <Story />
      </WithDrawerOpen>
    ),
    withRouter(["/home"]),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = canvas.getByTestId("authenticated-nav");
    expect(nav.className).toContain("translate-y-full");
  },
};

export const StateCatalog: Story = {
  // StateCatalog mounts its own MemoryRouter per panel, so it skips the
  // meta-level router-providing decorator entirely.
  render: () => (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-xs text-text-sub-600 font-medium mb-2 px-4">Home tab active</p>
        <MemoryRouter initialEntries={["/home"]}>
          <div className="relative h-[80px] border border-stroke-soft-200 rounded-lg overflow-hidden">
            <AppBar />
          </div>
        </MemoryRouter>
      </div>

      <div>
        <p className="text-xs text-text-sub-600 font-medium mb-2 px-4">Garden tab active</p>
        <MemoryRouter initialEntries={["/garden/list"]}>
          <div className="relative h-[80px] border border-stroke-soft-200 rounded-lg overflow-hidden">
            <AppBar />
          </div>
        </MemoryRouter>
      </div>

      <div>
        <p className="text-xs text-text-sub-600 font-medium mb-2 px-4">Profile tab active</p>
        <MemoryRouter initialEntries={["/profile"]}>
          <div className="relative h-[80px] border border-stroke-soft-200 rounded-lg overflow-hidden">
            <AppBar />
          </div>
        </MemoryRouter>
      </div>
    </div>
  ),
};

export const Mobile: Story = {
  decorators: [withRouter(["/home"])],
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};
