import type { Meta, StoryObj } from "@storybook/react";
import { MemoryRouter } from "react-router-dom";
import { expect, within } from "storybook/test";
import { withClientAppRuntime } from "../../../../../shared/.storybook/decorators";
import { OfflineIndicator } from "./OfflineIndicator";

const withRouter = (Story: React.ComponentType) => (
  <MemoryRouter initialEntries={["/home"]}>
    <div className="min-h-40 bg-bg-white-0 pt-10 text-text-strong-950">
      <Story />
      <p className="px-4 text-sm text-text-sub-600">Status bar frame</p>
    </div>
  </MemoryRouter>
);

const meta = {
  title: "Client/PWA/OfflineIndicator",
  component: OfflineIndicator,
  tags: ["autodocs", "storybook-ci"],
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile1" },
  },
  decorators: [withClientAppRuntime, withRouter],
} satisfies Meta<typeof OfflineIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Offline: Story = {
  args: {
    forceShow: true,
    testState: "offline",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("offline-indicator")).toBeVisible();
    await expect(canvas.getByText("Offline Mode")).toBeVisible();
  },
};

export const BackOnline: Story = {
  args: {
    forceShow: true,
    testState: "back-online",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("offline-indicator")).toBeVisible();
    await expect(canvas.getByRole("status", { name: "App is back online" })).toBeVisible();
    await expect(canvas.getByText("Back Online")).toBeVisible();
  },
};

export const InstallPrompt: Story = {
  args: {
    testState: "install",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("offline-indicator")).toBeVisible();
    await expect(canvas.getByText("Install for full experience.")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Profile" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Dismiss" })).toBeVisible();
  },
};
