import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { expect, within } from "storybook/test";
import { withClientAppRuntime } from "../../../shared/.storybook/decorators";
import { SiteHeader } from "../components/Navigation/SiteHeader";
import Landing from "./Landing";

function PublicBrowserFrame({ route, children }: { route: string; children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={[route]}>
      <div className="min-h-[720px] bg-bg-white-0 text-text-strong-950">
        <SiteHeader onConnectWallet={() => {}} />
        {children}
      </div>
    </MemoryRouter>
  );
}

const meta = {
  title: "Client/Public/BrowserSurfaces",
  tags: ["autodocs", "storybook-ci"],
  parameters: {
    layout: "fullscreen",
  },
  decorators: [withClientAppRuntime],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const LandingRoute: Story = {
  render: () => (
    <PublicBrowserFrame route="/landing">
      <Landing />
    </PublicBrowserFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("banner")).toBeVisible();
    await expect(canvas.getByRole("link", { name: /green goods logo/i })).toBeVisible();
    await expect(
      canvas.getByRole("heading", {
        name: /from good intentions to green\s+outcomes/i,
      })
    ).toBeVisible();
    expect(canvas.queryByTestId("authenticated-nav")).not.toBeInTheDocument();
  },
};

export const GardensRouteShell: Story = {
  render: () => (
    <PublicBrowserFrame route="/gardens">
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-semibold text-text-strong-950">Gardens</h1>
        <p className="mt-2 max-w-2xl text-base text-text-sub-600">
          Explore local gardens, open funding opportunities, and verified work from community
          stewards.
        </p>
      </main>
    </PublicBrowserFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
    expect(canvas.queryByTestId("authenticated-nav")).not.toBeInTheDocument();
  },
};
