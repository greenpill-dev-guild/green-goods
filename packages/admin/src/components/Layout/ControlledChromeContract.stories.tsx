import {
  AppBar,
  GardenChip,
  MainSheet,
  NavigationBar,
  RightSheet,
  type ToolbarSlot,
} from "@green-goods/shared";
import { RiAddLine, RiAppsLine, RiHammerLine, RiSeedlingLine, RiTeamLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, fn, within } from "storybook/test";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { expectAdminShellDarkPalette } from "../../views/storybookPaletteAssertions";

interface ControlledChromeContractProps {
  theme: "light" | "dark";
}

const slots: ToolbarSlot[] = [
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
    visible: true,
  },
  {
    id: "community",
    label: "Community",
    labelId: "cockpit.nav.community",
    icon: RiTeamLine,
    path: "/community",
    visible: true,
  },
  {
    id: "actions",
    label: "Actions",
    labelId: "app.admin.nav.actions",
    icon: RiHammerLine,
    path: "/actions",
    visible: true,
  },
];

function chromeBackdropValue(element: Element): string {
  const styles = window.getComputedStyle(element);
  return (
    styles.getPropertyValue("backdrop-filter") ||
    styles.getPropertyValue("-webkit-backdrop-filter") ||
    "none"
  );
}

function expectTransparentAppBar(element: Element) {
  const styles = window.getComputedStyle(element);
  expect(styles.backgroundImage).toBe("none");
  expect(styles.backgroundColor === "transparent" || styles.backgroundColor.endsWith(", 0)")).toBe(
    true
  );
  expect(styles.borderBottomWidth).toBe("0px");
  expect(styles.boxShadow).toBe("none");
  expect(chromeBackdropValue(element)).toBe("none");
}

function ControlledChromeContract({ theme }: ControlledChromeContractProps) {
  const garden = { id: "rio", name: "Rio Rainforest Lab" };
  const [sheetLayer, setSheetLayer] = useState<HTMLDivElement | null>(null);

  return (
    <div
      className="admin-m3 workspace-canvas workspace-canvas-grid h-full min-h-[680px]"
      data-theme={theme}
      data-tone="hub"
      data-workspace="hub"
    >
      <div className="canvas-area-top">
        <AppBar
          gardenChip={
            <GardenChip
              gardens={[garden]}
              selectedGarden={garden}
              onSelectGarden={fn()}
              onCreateGarden={fn()}
            />
          }
          onOpenSearch={fn()}
          onOpenNotifications={fn()}
          onOpenSettings={fn()}
          onOpenProfile={fn()}
        />
      </div>

      <MainSheet isReceded={false}>
        <main className="main-scroll-area mx-auto h-full w-full max-w-[960px] overflow-y-auto px-5 pt-4">
          <section className="canvas-route-card surface-section p-5" data-testid="solid-content">
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-label-md text-text-soft">Dense route surface</p>
                <h1 className="text-title-lg text-text-strong">Controlled Chrome Boundary</h1>
                <p className="mt-2 max-w-2xl text-body-md text-text-sub">
                  Route cards, form panels, records, and tables stay solid while persistent chrome
                  carries the subtle liquid material.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="surface-card p-4">
                  <p className="text-label-md text-text-soft">Record panel</p>
                  <p className="mt-1 text-title-sm text-text-strong">Solid material</p>
                </div>
                <div className="surface-card p-4">
                  <p className="text-label-md text-text-soft">Form panel</p>
                  <p className="mt-1 text-title-sm text-text-strong">No glass wash</p>
                </div>
              </div>
            </div>
          </section>
        </main>
      </MainSheet>

      <div className="canvas-area-bottom">
        <NavigationBar
          slots={slots}
          activePath="/hub"
          onNavigate={fn()}
          fab={{
            icon: RiAddLine,
            label: "Actions",
            actions: [
              {
                id: "edit-domains",
                icon: RiSeedlingLine,
                label: "Edit domains",
                labelId: "cockpit.garden.action.editDomains",
              },
              {
                id: "add-member",
                icon: RiTeamLine,
                label: "Add member",
                labelId: "cockpit.garden.action.addMember",
              },
            ],
            onAction: fn(),
          }}
        />
      </div>

      <div
        ref={setSheetLayer}
        className="admin-canvas-sheet-layer pointer-events-none absolute inset-0 z-raised overflow-hidden"
        data-component="CanvasLayout"
        data-slot="sheet-layer"
      />
      {sheetLayer ? (
        <RightSheet open onClose={fn()} title="Settings" container={sheetLayer}>
          <div className="p-4 text-body-sm text-text-sub">Sheet shell material boundary</div>
        </RightSheet>
      ) : null}
    </div>
  );
}

const meta = {
  title: "Admin/Shell/ControlledChromeContract",
  component: ControlledChromeContract,
  tags: ["autodocs"],
  args: {
    theme: "light",
  },
  argTypes: {
    theme: {
      control: "inline-radio",
      options: ["light", "dark"],
    },
  },
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Executable admin material contract: AppBar root stays transparent, Navigation/FAB and sheet shells carry Controlled Chrome, and dense route content stays solid in light and dark themes.",
      },
    },
  },
  decorators: [
    withCanvasFrame({
      className: "p-0",
      heightClassName: "h-[720px]",
      workspace: "hub",
    }),
  ],
} satisfies Meta<typeof ControlledChromeContract>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LightContract: Story = {
  tags: ["storybook-ci"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const appBar = await canvas.findByRole("banner");
    const nav = await canvas.findByRole("navigation");
    const sheet = await canvas.findByTestId("right-sheet");
    const content = await canvas.findByTestId("solid-content");

    await expect(appBar).toHaveAttribute("data-component", "AppBar");
    expectTransparentAppBar(appBar);
    expectAdminShellDarkPalette(canvasElement);
    expect(chromeBackdropValue(nav)).toContain("blur");
    expect(chromeBackdropValue(sheet)).toContain("blur");
    expect(chromeBackdropValue(content)).toBe("none");
    expect(content.className).not.toMatch(/glass|backdrop/i);
  },
};

export const DarkContract: Story = {
  tags: ["storybook-ci"],
  args: {
    theme: "dark",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const appBar = await canvas.findByRole("banner");
    const nav = await canvas.findByRole("navigation");
    const sheet = await canvas.findByTestId("right-sheet");
    const content = await canvas.findByTestId("solid-content");

    await expect(appBar).toHaveAttribute("data-component", "AppBar");
    expectTransparentAppBar(appBar);
    expectAdminShellDarkPalette(canvasElement);
    expect(chromeBackdropValue(nav)).toContain("blur");
    expect(chromeBackdropValue(sheet)).toContain("blur");
    expect(chromeBackdropValue(content)).toBe("none");
    expect(content.className).not.toMatch(/glass|backdrop/i);
  },
};
