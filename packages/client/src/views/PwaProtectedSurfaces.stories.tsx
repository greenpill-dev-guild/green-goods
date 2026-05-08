import { SubmissionProgress, SyncIndicator } from "@green-goods/shared/components";
import { RiFilterLine, RiLeafLine, RiSeedlingLine, RiUserLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { expect, within } from "storybook/test";
import { withClientAppRuntime, withInstalledPwa } from "../../../shared/.storybook/decorators";
import tokens from "../../../shared/src/styles/design-md.generated.json";
import { OfflineIndicator } from "../components/Communication/Offline/OfflineIndicator";
import { FormProgress } from "../components/Communication/Progress/Progress";
import { AppBar } from "../components/Layout/AppBar";
import { StandardTabs, type StandardTab } from "../components/Navigation/Tabs/StandardTabs";

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const parts = [0, 2, 4].map((offset) => parseInt(clean.slice(offset, offset + 2), 16));
  return `rgb(${parts.join(", ")})`;
}

const tabs: StandardTab[] = [
  { id: "activity", label: "Activity", count: 6, icon: <RiLeafLine className="h-4 w-4" /> },
  { id: "work", label: "Work", count: 2, icon: <RiSeedlingLine className="h-4 w-4" /> },
  { id: "profile", label: "Profile", icon: <RiUserLine className="h-4 w-4" /> },
];

function TabsFixture() {
  const [activeTab, setActiveTab] = useState("activity");
  return (
    <StandardTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} variant="compact" />
  );
}

function PwaRouteFrame({ route, children }: { route: string; children: React.ReactNode }) {
  return (
    <MemoryRouter initialEntries={[route]}>
      <div className="min-h-[720px] bg-bg-white-0 pb-[calc(69px+env(safe-area-inset-bottom))] text-text-strong-950">
        {children}
        <AppBar />
      </div>
    </MemoryRouter>
  );
}

const meta: Meta = {
  title: "Client/PWA/ProtectedSurfaces",
  tags: ["autodocs", "storybook-ci"],
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile1" },
  },
  decorators: [withInstalledPwa(), withClientAppRuntime],
};

export default meta;
type Story = StoryObj;

export const Home: Story = {
  render: () => (
    <PwaRouteFrame route="/home">
      <div className="px-4 py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Home</h1>
          <button
            type="button"
            className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-primary text-primary"
            aria-label="Filters"
          >
            <RiFilterLine className="h-4 w-4" />
            <span
              data-testid="pwa-filter-badge"
              className="absolute -right-1.5 -top-1.5 inline-flex min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-accent-foreground"
            >
              2
            </span>
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-stroke-soft-200 bg-bg-weak-50 p-4">
          <p className="text-sm font-medium text-text-strong-950">Community garden queue</p>
          <div className="mt-3 h-2 rounded-full bg-bg-soft-200">
            <div
              data-testid="pwa-queue-progress"
              className="h-full w-2/3 rounded-full bg-primary"
            />
          </div>
        </div>

        <div className="mt-6">
          <TabsFixture />
        </div>
      </div>
    </PwaRouteFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = canvas.getByTestId("authenticated-nav");
    await expect(nav).toBeVisible();
    expect(nav.className).not.toContain("translate-y-full");
    const badge = canvas.getByTestId("pwa-filter-badge");
    const progress = canvas.getByTestId("pwa-queue-progress");
    expect(badge.className).toContain("text-primary-accent-foreground");
    expect(getComputedStyle(badge).color).toBe(hexToRgb(tokens.colors["on-tertiary"]));
    expect(getComputedStyle(badge).backgroundColor).toBe(hexToRgb(tokens.colors.tertiary));
    expect(getComputedStyle(progress).backgroundColor).toBe(hexToRgb(tokens.colors.tertiary));
  },
};

export const GardenWorkCapture: Story = {
  render: () => (
    <PwaRouteFrame route="/home/garden">
      <div className="px-4 py-6">
        <h1 className="text-lg font-semibold">Garden</h1>
        <div className="mt-5">
          <FormProgress currentStep={2} steps={["Details", "Media", "Review"]} />
        </div>
        <div className="mt-5 h-2 rounded-full bg-bg-soft-200" aria-hidden="true">
          <div data-testid="pwa-work-progress" className="h-full w-1/2 rounded-full bg-primary" />
        </div>
        <div className="mt-6">
          <SubmissionProgress
            progress={{
              stage: "uploading",
              stageProgress: 48,
              overallProgress: 31,
              message: "Uploading to IPFS...",
              totalFiles: 4,
              completedFiles: 2,
            }}
          />
        </div>
      </div>
    </PwaRouteFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = canvas.getByTestId("authenticated-nav");
    expect(nav.className).toContain("translate-y-full");
    await expect(canvas.getAllByRole("progressbar")[0]).toBeVisible();
    expect(getComputedStyle(canvas.getByTestId("pwa-work-progress")).backgroundColor).toBe(
      hexToRgb(tokens.colors.tertiary)
    );
  },
};

export const Profile: Story = {
  render: () => (
    <PwaRouteFrame route="/home/profile">
      <div className="px-4 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <RiUserLine className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Profile</h1>
            <p className="text-sm text-text-sub-600">Gardener identity</p>
          </div>
        </div>
        <div className="mt-5">
          <TabsFixture />
        </div>
      </div>
    </PwaRouteFrame>
  ),
};

export const OfflineAndSyncStatus: Story = {
  render: () => (
    <MemoryRouter initialEntries={["/home"]}>
      <div className="min-h-[720px] bg-bg-white-0 px-4 py-6">
        <OfflineIndicator testState="back-online" forceShow />
        <div className="mt-12">
          <SyncIndicator
            stats={{ total: 8, pending: 3, failed: 0, synced: 5 }}
            isProcessing={false}
            isOnline
            onSync={() => {}}
          />
        </div>
      </div>
    </MemoryRouter>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("offline-indicator")).toBeVisible();
    const backOnline = canvas.getByRole("status", { name: "App is back online" });
    expect(backOnline.className).toContain("bg-primary/95");
    expect(backOnline.className).toContain("text-primary-accent-foreground");
    await expect(canvas.getByText("Back Online")).toBeVisible();
  },
};
