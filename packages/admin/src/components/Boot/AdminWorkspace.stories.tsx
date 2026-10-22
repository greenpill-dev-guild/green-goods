import messages from "@green-goods/shared/i18n/en.json";
import { useApp } from "@green-goods/shared/providers/App";
import type { Meta, StoryObj } from "@storybook/react";
import { IntlProvider } from "react-intl";
import { Route, Routes } from "react-router-dom";
import { expect, within } from "storybook/test";
import { CanvasLayout } from "@/components/Layout/CanvasLayout";
import { STORYBOOK_ADMIN_SHELL_SEEDS } from "../../../../shared/.storybook/adminFixtures";
import { installAdminWorkspaceStoryMocks } from "../../../../shared/.storybook/adminWorkspaceMocks";
import {
  withAdminIdentity,
  withRouter,
  withSeededQueryClient,
} from "../../../../shared/.storybook/decorators";
import AdminWorkspace from "./AdminWorkspace";

function SeededWorkspaceRoute() {
  const app = useApp();
  return (
    <section className="surface-section space-y-2 p-6" data-testid="workspace-story-content">
      <h1 className="text-title-md font-semibold text-text-strong">Storybook workspace fixture</h1>
      <p className="body-sm text-text-sub">
        Real AdminWorkspace, AppProvider and CanvasLayout. Fictional garden and auth data; the
        production router entry is substituted.
      </p>
      <p className="body-xs text-text-sub">App provider locale: {app.locale}</p>
    </section>
  );
}
function SeededAppRoutes() {
  return (
    <IntlProvider locale="en" messages={messages}>
      <Routes>
        <Route element={<CanvasLayout />}>
          <Route path="/hub/*" element={<SeededWorkspaceRoute />} />
        </Route>
      </Routes>
    </IntlProvider>
  );
}
const meta: Meta<typeof AdminWorkspace> = {
  title: "Admin/Boot/AdminWorkspace",
  component: AdminWorkspace,
  tags: ["autodocs"],
  decorators: [
    withAdminIdentity,
    withSeededQueryClient(STORYBOOK_ADMIN_SHELL_SEEDS),
    withRouter(["/hub"]),
  ],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Renders the actual AdminWorkspace wrapper, actual AppProvider and actual CanvasLayout with existing deterministic query seeds and fictional DevAuth/Wagmi contexts. The preview-registered App spy replaces only the production RouterProvider entry with the seeded memory route; the route fixture has a synchronous English catalogue, and analytics initialization is an inert spy. This is wrapper/provider/shell composition evidence, not production route boot, authentication, member signing or live network compatibility.",
      },
    },
  },
  beforeEach: () => {
    const language = localStorage.getItem("gg-language");
    localStorage.setItem("gg-language", "en");
    const resetMocks = installAdminWorkspaceStoryMocks(SeededAppRoutes);
    return () => {
      resetMocks();
      if (language === null) localStorage.removeItem("gg-language");
      else localStorage.setItem("gg-language", language);
    };
  },
};
export default meta;
type Story = StoryObj<typeof AdminWorkspace>;
export const SeededWorkspace: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("banner")).toHaveAttribute("data-component", "AppBar");
    await expect(
      await canvas.findByRole("heading", { name: "Storybook workspace fixture" })
    ).toBeVisible();
    await expect(canvas.getByText("App provider locale: en")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Botanic Commons" })).toBeVisible();
  },
};
