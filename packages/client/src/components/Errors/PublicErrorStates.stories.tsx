import type { Meta, StoryObj } from "@storybook/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { expect, fn, waitFor, within } from "storybook/test";
import { withClientAppRuntime } from "../../../../shared/.storybook/decorators";
import PublicShell from "../../routes/PublicShell";
import Root from "../../routes/Root";
import { AppScreenError } from "./AppScreenError";
import { PublicPageError } from "./PublicPageError";
import { PublicSiteError } from "./PublicSiteError";

const HERO_ENTRANCE = { timeout: 3000 };

/** The failed page in the frame a reader sees it in: the real root, shell and header. */
function PageInSite({ offline = false, path = "/impact" }: { offline?: boolean; path?: string }) {
  const router = createMemoryRouter(
    [
      {
        element: <Root />,
        children: [
          {
            element: <PublicShell />,
            children: [
              { path: "impact", element: <PublicPageError offline={offline} onReload={fn()} /> },
              {
                path: "agent/reporting/permissions",
                element: <AppScreenError shell="focused" offline={offline} onReload={fn()} />,
              },
            ],
          },
        ],
      },
    ],
    { initialEntries: [path] }
  );

  return <RouterProvider router={router} />;
}

const meta = {
  title: "Client/Public/ErrorStates",
  tags: ["autodocs", "storybook-ci"],
  parameters: { layout: "fullscreen" },
  decorators: [withClientAppRuntime],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** A page failed to render. The site's header and footer stay; the page says so and offers a way on. */
export const PageError: Story = {
  render: () => <PageInSite />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("navigation", { name: "Main navigation" })).toBeVisible();
    // The hero's card fades up on arrival, so its contents are looked up until they show.
    await waitFor(
      () =>
        expect(
          canvas.getByRole("heading", { level: 1, name: "This page could not be loaded" })
        ).toBeVisible(),
      HERO_ENTRANCE
    );
    await waitFor(
      () => expect(canvas.getByRole("button", { name: "Reload" })).toBeVisible(),
      HERO_ENTRANCE
    );
    await expect(canvas.getByRole("link", { name: "Browse Gardens" })).toBeVisible();
  },
};

/** The page's code could not be fetched without a connection. It reloads itself on reconnect. */
export const PageErrorOffline: Story = {
  render: () => <PageInSite offline />,
};

/** The site's own frame failed, so nothing but the card can be trusted to render. */
export const SiteError: Story = {
  render: () => <PublicSiteError onReload={fn()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { level: 1, name: "This page could not be loaded" })
    ).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Reload" })).toBeVisible();
  },
};

/** A reporting ceremony page failed. Its focused bar stays, and the state is drawn as the app draws. */
export const CeremonyPageError: Story = {
  globals: { viewport: { value: "mobile" } },
  render: () => <PageInSite path="/agent/reporting/permissions" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole("heading", { level: 1, name: "This screen didn't load" })
    ).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Reload" })).toBeVisible();
    expect(canvas.queryByRole("navigation", { name: "Main navigation" })).toBeNull();
  },
};
