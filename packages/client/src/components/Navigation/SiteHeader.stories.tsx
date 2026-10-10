import type { Meta, StoryObj } from "@storybook/react";
import { MemoryRouter } from "react-router-dom";
import { expect, userEvent, waitFor, within } from "storybook/test";
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
  parameters: {
    layout: "fullscreen",
  },
  decorators: [withClientAppRuntime, withRouter()],
} satisfies Meta<typeof SiteHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DesktopNavigation: Story = {
  globals: { viewport: { value: "desktop" } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvas.getByRole("navigation", { name: "Main navigation" })).toBeVisible()
    );
    expect(canvas.queryByTestId("authenticated-nav")).not.toBeInTheDocument();
  },
};

export const MobileDrawer: Story = {
  globals: { viewport: { value: "mobile" } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const portal = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Open Menu" }));
    const drawer = portal.getByRole("dialog", { name: "Open Menu" });
    await expect(drawer).toBeVisible();
    expect(canvasElement.ownerDocument.documentElement).toHaveClass("modal-open");
    expect(canvasElement.ownerDocument.body.style.position).toBe("fixed");
    await expect(portal.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    expect(getComputedStyle(drawer).animationName).toBe(
      reducedMotion ? "none" : "public-nav-enter"
    );
    await Promise.all(drawer.getAnimations().map((animation) => animation.finished));
    await userEvent.keyboard("{Escape}");
    if (!reducedMotion) {
      expect(drawer).toBeInTheDocument();
      expect(getComputedStyle(drawer).animationName).toBe("public-nav-exit");
      expect(canvasElement.ownerDocument.documentElement).toHaveClass("modal-open");
    }
    await waitFor(() => expect(portal.queryByRole("dialog")).not.toBeInTheDocument());
    expect(canvasElement.ownerDocument.documentElement).not.toHaveClass("modal-open");
    await expect(canvas.getByRole("button", { name: "Open Menu" })).toHaveFocus();
    await userEvent.click(canvas.getByRole("button", { name: "Open Menu" }));
    await userEvent.click(portal.getByRole("link", { name: "Install App" }));
    await waitFor(() =>
      expect(portal.queryByRole("dialog", { name: "Open Menu" })).not.toBeInTheDocument()
    );
  },
};
