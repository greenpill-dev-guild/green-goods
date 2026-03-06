import type { Meta, StoryObj } from "@storybook/react";
import { MemoryRouter } from "react-router-dom";
import { AppBar } from "./AppBar";

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
  tags: ["autodocs"],
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    layout: "fullscreen",
  },
  decorators: [withRouter(["/home"])],
};

export default meta;
type Story = StoryObj<typeof AppBar>;

export const Default: Story = {};

export const HomeActive: Story = {
  decorators: [withRouter(["/home"])],
};

export const GardenActive: Story = {
  decorators: [withRouter(["/garden"])],
};

export const ProfileActive: Story = {
  decorators: [withRouter(["/profile"])],
};

export const DarkMode: Story = {
  decorators: [
    withRouter(["/home"]),
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0">
        <Story />
      </div>
    ),
  ],
};

export const Gallery: Story = {
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
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};
