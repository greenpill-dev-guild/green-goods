import { useActiveGarden } from "@green-goods/shared/hooks/garden/useActiveGarden";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect } from "react";
import { MemoryRouter } from "react-router-dom";
import { expect, mocked, userEvent, within } from "storybook/test";
import { withClientAppRuntime, withInstalledPwa } from "../../../../shared/.storybook/decorators";
import { activeGarden, memberGarden, TAS_HUB } from "../../../../shared/.storybook/homeFixtures";
import { AppBar } from "./AppBar";

/** Registers one open sheet for the story's lifetime, the way every sheet does while open. */
function WithSheetOpen({ children }: { children: React.ReactNode }) {
  useEffect(() => useUIStore.getState().registerOpenSheet(), []);
  return <>{children}</>;
}

/**
 * AppBar requires react-router context (useLocation, Link) and several shared hooks:
 * - useYourWorkCount (the job queue and drafts on this device)
 * - useUIStore (Zustand)
 * - useActiveGarden, which every story but one answers with an entered garden
 *
 * We provide a MemoryRouter decorator and let the global QueryClientProvider
 * handle queries (they return defaults). The Zustand store initializes with
 * drawers closed by default.
 */
const withRouter = (initialEntries: string[] = ["/home"]) => {
  return (Story: React.ComponentType) => (
    <MemoryRouter initialEntries={initialEntries}>
      <div className="relative h-[200px] bg-bg-canvas">
        <Story />
      </div>
    </MemoryRouter>
  );
};

/**
 * The active tab carries the cockpit's pill in the app's green (F6): its icon slot paints
 * the green container, and no other tab's slot paints anything. The bar keeps its 69px,
 * the height #app-scroll and AppScreenError reserve for it.
 */
async function expectActivePill(canvasElement: HTMLElement, active: RegExp) {
  const nav = within(canvasElement).getByTestId("authenticated-nav");
  await expect(nav.getBoundingClientRect().height).toBe(69);
  const container = getComputedStyle(nav)
    .getPropertyValue("--primary-container")
    .trim()
    .split(/\s+/)
    .join(", ");
  for (const link of within(nav).getAllByRole("link")) {
    const pill = link.querySelector<HTMLElement>("[data-slot='icon']");
    if (!pill) throw new Error("A tab has no icon slot");
    const isActive = active.test(link.textContent ?? "");
    await expect(link.getAttribute("aria-current")).toBe(isActive ? "page" : null);
    const paint = getComputedStyle(pill).backgroundColor;
    if (isActive) await expect(paint).toBe(`rgb(${container})`);
    // An inactive slot is fully transparent: its computed colour ends in a zero alpha.
    else await expect(paint).toMatch(/, 0\)$/);
  }
}

const meta: Meta<typeof AppBar> = {
  title: "Client/Layout/AppBar",
  component: AppBar,
  tags: ["autodocs", "storybook-ci"],
  globals: { viewport: { value: "mobile" } },
  parameters: {
    layout: "fullscreen",
  },
  decorators: [withInstalledPwa(), withClientAppRuntime],
  beforeEach: () => {
    mocked(useActiveGarden).mockReturnValue(
      activeGarden("ready", [memberGarden(TAS_HUB, ["gardener"])], TAS_HUB.id)
    );
  },
};

export default meta;
type Story = StoryObj<typeof AppBar>;

export const Default: Story = {
  decorators: [withRouter(["/home"])],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = canvas.getByTestId("authenticated-nav");
    await expect(nav).toBeVisible();
    expect(nav.className).not.toContain("translate-y-full");
  },
};

export const HomeActive: Story = {
  decorators: [withRouter(["/home"])],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = canvas.getByTestId("authenticated-nav");
    expect(nav.className).not.toContain("translate-y-full");
    await expectActivePill(canvasElement, /home/i);
  },
};

/** Before a garden is entered the bar waits, off screen and out of reach (DL-155). */
export const HiddenBeforeAGardenIsEntered: Story = {
  decorators: [withRouter(["/home"])],
  beforeEach: () => {
    mocked(useActiveGarden).mockReturnValue(activeGarden("none"));
  },
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByTestId("authenticated-nav");
    await expect(nav.className).toContain("translate-y-full");
    await expect(nav.inert).toBe(true);
  },
};

export const HiddenOnGardenRoute: Story = {
  decorators: [withRouter(["/home/garden"])],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = canvas.getByTestId("authenticated-nav");
    expect(nav.className).toContain("translate-y-full");
  },
};

export const ProfileActive: Story = {
  decorators: [withRouter(["/home/profile"])],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = canvas.getByTestId("authenticated-nav");
    expect(nav.className).not.toContain("translate-y-full");
    await expectActivePill(canvasElement, /profile/i);
  },
};

/**
 * Keyboard focus rings every tab in the app's focus role (DL-098), the active tab included:
 * one solid 2px ring with a 2px offset in `--focus-ring`, green in light and mint in dark.
 */
export const KeyboardFocus: Story = {
  decorators: [withRouter(["/home"])],
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByTestId("authenticated-nav");
    const ring = getComputedStyle(nav)
      .getPropertyValue("--focus-ring")
      .trim()
      .split(/\s+/)
      .join(", ");
    const links = within(nav).getAllByRole("link");
    const current = links.filter((link) => link.getAttribute("aria-current") === "page");
    await expect(current).toHaveLength(1);
    for (const link of links) {
      await userEvent.tab();
      await expect(link).toHaveFocus();
      await expect(link.matches(":focus-visible")).toBe(true);
      const style = getComputedStyle(link);
      await expect(style.outlineStyle).toBe("solid");
      await expect(style.outlineWidth).toBe("2px");
      await expect(style.outlineOffset).toBe("2px");
      await expect(style.outlineColor).toBe(`rgb(${ring})`);
    }
  },
};

export const HiddenOnWorkDetailRoute: Story = {
  decorators: [withRouter(["/home/1/work/2"])],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = canvas.getByTestId("authenticated-nav");
    expect(nav.className).toContain("translate-y-full");
  },
};

export const HiddenWhenSheetOpen: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Any open sheet or dialog hides the bottom nav (DL-015): sheets register themselves while open, so there is no list to keep in sync.",
      },
    },
  },
  decorators: [
    (Story) => (
      <WithSheetOpen>
        <Story />
      </WithSheetOpen>
    ),
    withRouter(["/home"]),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = canvas.getByTestId("authenticated-nav");
    expect(nav.className).toContain("translate-y-full");
  },
};

export const StateCatalog: Story = {
  // StateCatalog mounts its own MemoryRouter per panel, so it skips the
  // meta-level router-providing decorator entirely.
  render: () => (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-xs text-text-sub-600 font-medium mb-2 px-4">Home tab active</p>
        <MemoryRouter initialEntries={["/home"]}>
          <div className="relative h-[80px] border border-stroke-soft-200 rounded-lg overflow-hidden">
            <AppBar />
          </div>
        </MemoryRouter>
      </div>

      <div>
        <p className="text-xs text-text-sub-600 font-medium mb-2 px-4">Garden tab active</p>
        <MemoryRouter initialEntries={["/home/garden"]}>
          <div className="relative h-[80px] border border-stroke-soft-200 rounded-lg overflow-hidden">
            <AppBar />
          </div>
        </MemoryRouter>
      </div>

      <div>
        <p className="text-xs text-text-sub-600 font-medium mb-2 px-4">Profile tab active</p>
        <MemoryRouter initialEntries={["/home/profile"]}>
          <div className="relative h-[80px] border border-stroke-soft-200 rounded-lg overflow-hidden">
            <AppBar />
          </div>
        </MemoryRouter>
      </div>
    </div>
  ),
};

export const Mobile: Story = {
  decorators: [withRouter(["/home"])],
  globals: { viewport: { value: "mobile" } },
};
