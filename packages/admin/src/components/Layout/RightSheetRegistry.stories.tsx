import {
  NOTIFICATIONS_SHEET_CONTENT_ID,
  PROFILE_SHEET_CONTENT_ID,
  RightSheet,
  SETTINGS_SHEET_CONTENT_ID,
  isAdminRightSheetContentId,
  toAccountSheetContentId,
  useAdminRightSheetDescriptor,
  type AdminRightSheetContentId,
} from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { useCallback, useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { STORYBOOK_ADMIN_SHELL_SEEDS } from "../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentity,
  withCanvasFrame,
  withRouter,
  withSeededQueryClient,
} from "../../../../shared/.storybook/decorators";
import { AccountProfilePanel } from "./AccountProfilePanel";
import { AccountSettingsPanel } from "./AccountSettingsPanel";

interface RightSheetRegistryHarnessProps {
  initialContentId: AdminRightSheetContentId | null;
}

const SHEET_OPTIONS: Array<{ id: AdminRightSheetContentId; label: string }> = [
  { id: PROFILE_SHEET_CONTENT_ID, label: "Profile" },
  { id: SETTINGS_SHEET_CONTENT_ID, label: "Settings" },
  { id: NOTIFICATIONS_SHEET_CONTENT_ID, label: "Notifications" },
];

function RightSheetRegistryHarness({ initialContentId }: RightSheetRegistryHarnessProps) {
  const [contentId, setContentId] = useState<AdminRightSheetContentId | null>(initialContentId);
  const [overlayRoot, setOverlayRoot] = useState<HTMLDivElement | null>(null);
  const renderAccountProfile = useCallback(() => <AccountProfilePanel />, []);
  const renderAccountSettings = useCallback(() => <AccountSettingsPanel />, []);
  const descriptor = useAdminRightSheetDescriptor({
    contentId,
    renderAccountProfile,
    renderAccountSettings,
  });

  const openRegisteredContent = (nextContentId: string) => {
    if (isAdminRightSheetContentId(nextContentId)) {
      setContentId(nextContentId);
    }
  };

  return (
    <div ref={setOverlayRoot} className="relative h-full overflow-hidden">
      <main className="main-scroll-area flex h-full flex-col gap-4 p-6">
        <section className="surface-section space-y-4">
          <div>
            <p className="text-label-sm uppercase text-text-soft">Registered right sheets</p>
            <h2 className="text-title-md text-text-strong">Account and notifications inspector</h2>
            <p className="mt-2 max-w-xl text-body-md text-text-sub">
              Opens the same descriptor hook used by CanvasLayout, then renders the resolved content
              in the shared RightSheet.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {SHEET_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => openRegisteredContent(option.id)}
                className="rounded-lg bg-[rgb(var(--m3-primary))] px-4 py-2 text-sm font-medium text-[rgb(var(--m3-on-primary))] transition-opacity hover:opacity-90"
              >
                Open {option.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setContentId(null)}
              className="rounded-lg border border-stroke-soft px-4 py-2 text-sm font-medium text-text-sub transition-colors hover:bg-bg-soft"
            >
              Close sheet
            </button>
          </div>

          <dl className="grid gap-3 text-sm text-text-sub sm:grid-cols-3">
            <div className="surface-inset p-3">
              <dt className="font-medium text-text-strong">Current content</dt>
              <dd data-testid="right-sheet-current">{contentId ?? "none"}</dd>
            </div>
            <div className="surface-inset p-3">
              <dt className="font-medium text-text-strong">Profile tab maps to</dt>
              <dd>{toAccountSheetContentId("profile")}</dd>
            </div>
            <div className="surface-inset p-3">
              <dt className="font-medium text-text-strong">Settings tab maps to</dt>
              <dd>{toAccountSheetContentId("settings")}</dd>
            </div>
          </dl>
        </section>
      </main>

      <RightSheet
        open={descriptor !== null}
        onClose={() => setContentId(null)}
        title={descriptor?.title}
        container={overlayRoot}
        width={descriptor?.width ?? "default"}
      >
        {descriptor?.content}
      </RightSheet>
    </div>
  );
}

const meta: Meta<typeof RightSheetRegistryHarness> = {
  title: "Admin/Shell/RightSheetRegistry",
  // storybook-quality-allow state-harness: owns open state while exercising the real descriptor hook and RightSheet.
  component: RightSheetRegistryHarness,
  tags: ["autodocs", "storybook-ci"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Composition story for the admin right-sheet registry. It exercises the real descriptor hook, separated profile/settings account panels, notification panel, and bounded RightSheet orchestration used by CanvasLayout.",
      },
    },
  },
  decorators: [
    withAdminIdentity,
    withSeededQueryClient(STORYBOOK_ADMIN_SHELL_SEEDS),
    withRouter(["/hub"]),
    withCanvasFrame({
      className: "admin-m3 workspace-canvas-grid",
      heightClassName: "h-[680px]",
      workspace: "profile",
    }),
  ],
  args: {
    initialContentId: PROFILE_SHEET_CONTENT_ID,
  },
  argTypes: {
    initialContentId: {
      control: "select",
      options: [
        PROFILE_SHEET_CONTENT_ID,
        SETTINGS_SHEET_CONTENT_ID,
        NOTIFICATIONS_SHEET_CONTENT_ID,
        null,
      ],
      description: "Registry content id opened when the story renders.",
    },
  },
};

export default meta;
type Story = StoryObj<typeof RightSheetRegistryHarness>;

export const Profile: Story = {};

export const Settings: Story = {
  args: {
    initialContentId: SETTINGS_SHEET_CONTENT_ID,
  },
};

export const Notifications: Story = {
  args: {
    initialContentId: NOTIFICATIONS_SHEET_CONTENT_ID,
  },
};

export const Closed: Story = {
  args: {
    initialContentId: null,
  },
};

export const StateCatalog: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);

    const profileSheet = await body.findByTestId("right-sheet");
    await expect(within(profileSheet).getByRole("heading", { name: "Profile" })).toBeVisible();
    await expect(within(profileSheet).queryByRole("tab")).not.toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: "Open Settings" }));
    const settingsSheet = await body.findByTestId("right-sheet");
    await expect(within(settingsSheet).getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(within(settingsSheet).getByRole("heading", { name: "Theme" })).toBeVisible();
    await expect(within(settingsSheet).queryByRole("tab")).not.toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: "Open Profile" }));
    const reopenedProfileSheet = await body.findByTestId("right-sheet");
    await expect(
      within(reopenedProfileSheet).getByRole("heading", { name: "Profile" })
    ).toBeVisible();

    await userEvent.click(canvas.getByRole("button", { name: "Open Notifications" }));
    const notificationsSheet = await body.findByTestId("right-sheet");
    const notificationsPanel = within(notificationsSheet);
    await expect(notificationsPanel.getByRole("heading", { name: "Notifications" })).toBeVisible();
    await expect(notificationsPanel.queryByText("Failed to load")).not.toBeInTheDocument();

    const closeButton = notificationsPanel.getByRole("button", { name: "Close" });
    const notificationActions = notificationsPanel
      .getAllByRole("button")
      .filter((button) => button !== closeButton);
    const hasEmptyState = notificationsPanel.queryByText("No notifications") !== null;
    await expect(hasEmptyState || notificationActions.length > 0).toBe(true);

    await userEvent.click(closeButton);
    await expect(canvas.getByTestId("right-sheet-current")).toHaveTextContent("none");
  },
};
