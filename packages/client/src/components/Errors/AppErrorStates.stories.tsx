import type { Meta, StoryObj } from "@storybook/react";
import { MemoryRouter } from "react-router-dom";
import { expect, fn, within } from "storybook/test";
import { withClientAppRuntime, withInstalledPwa } from "../../../../shared/.storybook/decorators";
import { AppBar } from "../Layout/AppBar";
import { AppLaunchError } from "./AppLaunchError";
import { AppScreenError } from "./AppScreenError";

/** The failed screen where the app shows it: inside the scroller, over the real bottom bar. */
function ScreenInApp({ route, children }: { route: string; children: React.ReactNode }) {
  return (
    <MemoryRouter initialEntries={[route]}>
      <div className="bg-bg-white-0 pb-[calc(69px+env(safe-area-inset-bottom))] text-text-strong-950">
        {children}
        <AppBar />
      </div>
    </MemoryRouter>
  );
}

const meta: Meta = {
  title: "Client/PWA/ErrorStates",
  tags: ["autodocs", "storybook-ci"],
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile" } },
  decorators: [withInstalledPwa({ heightClassName: "min-h-dvh" }), withClientAppRuntime],
};

export default meta;
type Story = StoryObj;

/** A tab's screen failed. The bottom bar stays, so the other tabs are one tap away. */
export const ScreenError: Story = {
  render: () => (
    <ScreenInApp route="/home">
      <AppScreenError onReload={fn()} />
    </ScreenInApp>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { level: 1, name: "This screen didn't load" })
    ).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Reload" })).toBeVisible();
    expect(canvas.getByTestId("authenticated-nav").className).not.toContain("translate-y-full");
  },
};

/** A garden's page hides the bottom bar, so the failed screen carries its own way back. */
export const ScreenErrorWithoutBottomBar: Story = {
  render: () => (
    <ScreenInApp route="/home/0x1111111111111111111111111111111111111111">
      <AppScreenError onReload={fn()} onBack={fn()} />
    </ScreenInApp>
  ),
};

/** The screen's code could not be fetched without a connection. It reloads itself on reconnect. */
export const ScreenErrorOffline: Story = {
  render: () => (
    <ScreenInApp route="/home">
      <AppScreenError offline onReload={fn()} />
    </ScreenInApp>
  ),
};

/** The app could not start, or its shell failed: the loading screen, saying so, with one action. */
export const LaunchError: Story = {
  render: () => <AppLaunchError onReload={fn()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "Green Goods couldn't open." })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Reload" })).toBeVisible();
  },
};

/** The app's code could not be fetched without a connection. It reloads itself on reconnect. */
export const LaunchErrorOffline: Story = {
  render: () => <AppLaunchError offline onReload={fn()} />,
};

/** The app is reloading itself onto a new build: the loading screen, with nothing to press. */
export const LaunchUpdating: Story = {
  render: () => <AppLaunchError updating />,
};
