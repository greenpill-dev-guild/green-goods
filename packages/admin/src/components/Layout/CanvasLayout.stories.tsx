import {
  AppBar,
  GardenChip,
  MainSheet,
  NavigationBar,
  RightSheet,
  type ToolbarSlot,
} from "@green-goods/shared";
import { RiAppsLine, RiHammerLine, RiSeedlingLine, RiTeamLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useMemo, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import {
  STORYBOOK_ADMIN_DEPLOYER_SEEDS,
  STORYBOOK_ADMIN_SHELL_SEEDS,
} from "../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentity,
  withAdminIdentityRole,
  withCanvasFrame,
  withRouter,
  withSeededQueryClient,
} from "../../../../shared/.storybook/decorators";
import {
  expectAdminShellDarkPalette,
  withTemporaryDocumentTheme,
} from "../../views/storybookPaletteAssertions";
import { CanvasLayout } from "./CanvasLayout";

const gardens = [
  { id: "garden-1", name: "Comunidad Verde" },
  { id: "garden-2", name: "Jardim Botafogo" },
];

interface MockCanvasLayoutProps {
  empty?: boolean;
  activePath: string;
}

function CanvasLayoutVisualHarness({ empty = false, activePath }: MockCanvasLayoutProps) {
  const [selectedGarden, setSelectedGarden] = useState(gardens[0]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const slots = useMemo<ToolbarSlot[]>(
    () => [
      {
        id: "hub",
        label: "Hub",
        labelId: "cockpit.nav.hub",
        icon: RiAppsLine,
        path: "/hub",
        visible: true,
      },
      {
        id: "garden",
        label: "Garden",
        labelId: "cockpit.nav.garden",
        icon: RiSeedlingLine,
        path: "/garden",
        visible: !empty,
      },
      {
        id: "community",
        label: "Community",
        labelId: "cockpit.nav.community",
        icon: RiTeamLine,
        path: "/community",
        visible: !empty,
      },
      {
        id: "actions",
        label: "Actions",
        labelId: "app.admin.nav.actions",
        icon: RiHammerLine,
        path: "/actions",
        visible: true,
      },
    ],
    [empty]
  );

  const gardenChip = (
    <GardenChip
      gardens={empty ? [] : gardens}
      selectedGarden={empty ? null : selectedGarden}
      onSelectGarden={(garden) => garden && setSelectedGarden(garden)}
      onCreateGarden={fn()}
    />
  );

  return (
    <>
      <div className="canvas-area-top">
        <AppBar
          gardenChip={gardenChip}
          onOpenSearch={fn()}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenProfile={fn()}
        />
      </div>
      <MainSheet isReceded={settingsOpen}>
        <main className="h-full overflow-y-auto p-6">
          {empty ? (
            <section className="flex min-h-full items-center justify-center text-center">
              <div>
                <h2 className="text-title-md text-text-strong">No garden access yet</h2>
                <p className="mt-2 text-body-md text-text-sub">
                  Create a garden or ask an owner to add your wallet.
                </p>
              </div>
            </section>
          ) : (
            <section className="space-y-4">
              <h2 className="text-title-md text-text-strong">Hub workbench</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-bg-soft p-4 shadow-[var(--edge-rest)]">
                  Pending review
                </div>
                <div className="rounded-xl bg-bg-soft p-4 shadow-[var(--edge-rest)]">
                  Ready to certify
                </div>
              </div>
            </section>
          )}
        </main>
      </MainSheet>
      <div className="canvas-area-bottom">
        <NavigationBar slots={slots} activePath={activePath} onNavigate={fn()} />
      </div>
      <RightSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Settings">
        <div className="p-5 text-sm text-text-sub">Account settings and network details.</div>
      </RightSheet>
    </>
  );
}

function StorybookRouteContent({ title }: { title: string }) {
  return (
    <section className="space-y-4 p-6" data-testid="storybook-route-content">
      <div>
        <p className="text-label-sm text-text-soft">Storybook route</p>
        <h1 className="text-title-lg text-text-strong">{title}</h1>
      </div>
      <div className="surface-section p-4">
        <p className="text-body-md text-text-sub">
          Real CanvasLayout shell content rendered through React Router outlet.
        </p>
      </div>
    </section>
  );
}

function RealCanvasLayoutStory() {
  return (
    <Routes>
      <Route element={<CanvasLayout />}>
        <Route path="/hub/*" element={<StorybookRouteContent title="Hub workbench" />} />
        <Route path="/garden/*" element={<StorybookRouteContent title="Garden overview" />} />
        <Route
          path="/community/*"
          element={<StorybookRouteContent title="Community operations" />}
        />
        <Route path="/actions/*" element={<StorybookRouteContent title="Action registry" />} />
        <Route path="/profile/*" element={<StorybookRouteContent title="Profile" />} />
      </Route>
    </Routes>
  );
}

type CanvasLayoutStoryArgs = MockCanvasLayoutProps;
type AdminWorkspaceTone = "hub" | "garden" | "community" | "actions";

const DARK_TONE_HUES: Record<AdminWorkspaceTone, string> = {
  hub: "240",
  garden: "145",
  community: "50",
  actions: "30",
};

function getCanvasLayoutRoot(canvasElement: HTMLElement): HTMLElement {
  const root = canvasElement.querySelector<HTMLElement>('[data-component="CanvasLayout"]');
  expect(root).not.toBeNull();
  return root as HTMLElement;
}

function expectDarkCanvasTone(root: HTMLElement, tone: AdminWorkspaceTone) {
  const toneCanvas = window.getComputedStyle(root).getPropertyValue("--tone-canvas").trim();

  expect(root).toHaveAttribute("data-tone", tone);
  expect(toneCanvas).toContain("oklch(20%");
  expect(toneCanvas).toContain(DARK_TONE_HUES[tone]);
}

const meta: Meta<CanvasLayoutStoryArgs> = {
  title: "Admin/Shell/CanvasLayout",
  component: CanvasLayout,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Admin canvas shell coverage. The CI story renders the real CanvasLayout through router, auth, wagmi, and seeded React Query providers; the visual harness stories keep focused shell state catalogs available without satisfying CI coverage.",
      },
    },
  },
  args: {
    empty: false,
    activePath: "/hub",
  },
  argTypes: {
    empty: {
      control: "boolean",
      description: "Show the no-garden state inside the canvas.",
    },
    activePath: {
      control: "select",
      options: ["/hub", "/garden", "/community", "/actions"],
    },
  },
};

export default meta;
type Story = StoryObj<CanvasLayoutStoryArgs>;

export const RealProviderShell: Story = {
  tags: ["storybook-ci"],
  render: () => <RealCanvasLayoutStory />,
  decorators: [
    withAdminIdentity,
    withSeededQueryClient(STORYBOOK_ADMIN_SHELL_SEEDS),
    withRouter(["/hub/work"]),
    withCanvasFrame({
      className: "p-0",
      heightClassName: "h-[760px]",
      workspace: "hub",
    }),
  ],
  parameters: {
    docs: {
      description: {
        story:
          "CI-covered real CanvasLayout composition. It exercises auth, router outlet rendering, garden selection, navigation chrome, right-sheet orchestration, and the real CommandPalette entry point against deterministic Storybook seeds.",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("banner")).toHaveAttribute("data-component", "AppBar");
    await expect(await canvas.findByRole("heading", { name: "Hub workbench" })).toBeVisible();
    await expect(await canvas.findByRole("button", { name: "Botanic Commons" })).toBeVisible();

    const searchButton = canvas.queryByRole("button", { name: "Open search" });
    if (searchButton) {
      await userEvent.click(searchButton);
      const body = within(document.body);
      const palette = await body.findByRole("dialog", { name: "Command palette" });
      const paletteCanvas = within(palette);
      const searchInput = await paletteCanvas.findByPlaceholderText(
        /search pages, gardens, actions/i
      );
      await expect(searchInput).toBeInTheDocument();
      await userEvent.type(searchInput, "rain");
      const rioMatches = await paletteCanvas.findAllByText("Rio Rainforest Lab");
      await expect(rioMatches.length).toBeGreaterThan(0);
      await userEvent.keyboard("{Escape}");
    }

    const settingsTrigger = canvas.queryByRole("button", { name: "Open settings" });
    const sheetHeading = settingsTrigger ? "Settings" : "Notifications";
    await userEvent.click(settingsTrigger ?? canvas.getByRole("button", { name: "Notifications" }));
    const rightSheet = await canvas.findByTestId("right-sheet");
    const sheetLayer = await canvas.findByTestId("canvas-sheet-layer");
    const mainSheet = await canvas.findByTestId("main-sheet");

    await expect(rightSheet).toHaveAttribute("data-component", "RightSheet");
    await expect(rightSheet).toHaveAttribute("data-boundary", "bounded");
    await expect(sheetLayer).toHaveAttribute("data-state", "right");
    await waitFor(() => expect(mainSheet).toHaveAttribute("data-state", "receded"));
    await expect(within(rightSheet).getByRole("heading", { name: sheetHeading })).toBeVisible();
    await userEvent.click(within(rightSheet).getByRole("button", { name: "Close" }));
  },
};

export const DarkRouteToneContract: Story = {
  tags: ["storybook-ci"],
  render: () => <RealCanvasLayoutStory />,
  decorators: [
    withAdminIdentityRole("deployer"),
    withSeededQueryClient(STORYBOOK_ADMIN_DEPLOYER_SEEDS),
    withRouter(["/hub"]),
    withCanvasFrame({
      className: "p-0",
      heightClassName: "h-[760px]",
      workspace: "hub",
    }),
  ],
  parameters: {
    docs: {
      description: {
        story:
          "Browser-level dark canvas tone contract for the canonical admin routes. Proves document-level [data-theme='dark'] still reaches the CanvasLayout [data-tone] root.",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("banner");
    const root = getCanvasLayoutRoot(canvasElement);

    await withTemporaryDocumentTheme("dark", async () => {
      await waitFor(() => expectDarkCanvasTone(root, "hub"));
      await waitFor(() => expectAdminShellDarkPalette(canvasElement));

      const routeCases = [
        { label: "Garden", tone: "garden" },
        { label: "Community", tone: "community" },
        { label: "Actions", tone: "actions" },
        { label: "Hub", tone: "hub" },
      ] as const;

      for (const route of routeCases) {
        await userEvent.click(canvas.getByRole("button", { name: route.label }));
        await waitFor(() => expectDarkCanvasTone(root, route.tone));
        await waitFor(() => expectAdminShellDarkPalette(canvasElement));
      }
    });
  },
};

export const Populated: Story = {
  tags: ["visual-harness"],
  render: (args) => <CanvasLayoutVisualHarness {...args} />,
  decorators: [
    withCanvasFrame({
      className: "admin-m3 workspace-canvas-grid",
      heightClassName: "h-[680px]",
      workspace: "hub",
    }),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("banner")).toHaveAttribute("data-component", "AppBar");
    await userEvent.click(canvas.getByRole("button", { name: /open settings/i }));
    await expect(await canvas.findByTestId("right-sheet")).toHaveAttribute(
      "data-component",
      "RightSheet"
    );
    await userEvent.click(canvas.getByTestId("right-sheet-close"));
  },
};

export const Empty: Story = {
  tags: ["visual-harness"],
  render: (args) => <CanvasLayoutVisualHarness {...args} />,
  decorators: [
    withCanvasFrame({
      className: "admin-m3 workspace-canvas-grid",
      heightClassName: "h-[680px]",
      workspace: "hub",
    }),
  ],
  args: {
    empty: true,
  },
};

export const Mobile: Story = {
  tags: ["visual-harness"],
  render: (args) => <CanvasLayoutVisualHarness {...args} />,
  decorators: [
    withCanvasFrame({
      className: "admin-m3 workspace-canvas-grid",
      heightClassName: "h-[680px]",
      workspace: "hub",
    }),
  ],
  args: {
    activePath: "/garden",
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};
