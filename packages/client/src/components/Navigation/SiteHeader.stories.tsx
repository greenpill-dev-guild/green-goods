import type { Meta, StoryObj } from "@storybook/react";
import { MemoryRouter } from "react-router-dom";
import { expect, fn, userEvent, within } from "storybook/test";
import { withClientAppRuntime } from "../../../../shared/.storybook/decorators";
import { SiteHeader } from "./SiteHeader";

const withRouter = (initialEntry = "/gardens") => {
  return (Story: React.ComponentType) => (
    <MemoryRouter initialEntries={[initialEntry]}>
      <div className="min-h-80 bg-bg-white-0 text-text-strong-950">
        <Story />
      </div>
    </MemoryRouter>
  );
};

const meta = {
  title: "Client/Public/SiteHeader",
  component: SiteHeader,
  tags: ["autodocs", "storybook-ci"],
  args: {
    onConnectWallet: fn(),
  },
  parameters: {
    layout: "fullscreen",
  },
  decorators: [withClientAppRuntime, withRouter()],
} satisfies Meta<typeof SiteHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DesktopNavigation: Story = {
  parameters: {
    viewport: { defaultViewport: "desktop" },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
    expect(canvas.queryByTestId("authenticated-nav")).not.toBeInTheDocument();
  },
};

export const MobileDrawer: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Open menu" }));
    await expect(canvas.getByRole("dialog")).toBeVisible();
    await expect(canvas.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Connect Wallet" }));
    await expect(args.onConnectWallet).toHaveBeenCalledTimes(1);
    expect(canvas.queryByRole("dialog")).not.toBeInTheDocument();
  },
};
