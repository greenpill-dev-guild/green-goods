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
import { expect, fn, userEvent, within } from "storybook/test";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";

const gardens = [
  { id: "garden-1", name: "Comunidad Verde" },
  { id: "garden-2", name: "Jardim Botafogo" },
];

interface MockCanvasLayoutProps {
  empty?: boolean;
  activePath: string;
}

function MockCanvasLayout({ empty = false, activePath }: MockCanvasLayoutProps) {
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

const meta: Meta<typeof MockCanvasLayout> = {
  title: "Admin/Shell/CanvasLayout",
  component: MockCanvasLayout,
  tags: ["autodocs", "storybook-ci"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "State catalog for the admin canvas shell: AppBar, MainSheet, NavigationBar, and a right-sheet recession state inside the Storybook-owned canvas frame.",
      },
    },
  },
  decorators: [
    withCanvasFrame({
      className: "admin-m3 workspace-canvas-grid",
      heightClassName: "h-[680px]",
      workspace: "hub",
    }),
  ],
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
type Story = StoryObj<typeof MockCanvasLayout>;

export const Populated: Story = {
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
  args: {
    empty: true,
  },
};

export const Mobile: Story = {
  args: {
    activePath: "/garden",
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};
