import type { Meta, StoryObj } from "@storybook/react";
import { resolveHubSheetSelection } from "@green-goods/shared/hooks/admin-ui/hub/hub.workbenchModel";
import { useMemo, useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { withAdminPrimitiveFrame } from "../../../../shared/.storybook/decorators";
import { LeftInspectorDialog } from "./LeftInspectorDialog";
import { releaseStuckDialogArtifacts } from "./dialogCloseSafetyNet";
import { LeftSheetProvider, useLeftSheetConfig, type LeftSheetConfig } from "./leftSheetChannel";

const onClose = fn();

function OpenInspector({ fallbackTone }: { fallbackTone: "hub" | "garden" }) {
  const config = useMemo<LeftSheetConfig>(
    () => ({
      title: "Review work",
      content: (
        <div className="space-y-2">
          <h3 className="text-title-sm text-text-strong">Canopy transect upload</h3>
          <p className="text-body-md text-text-sub">
            Confirm the evidence before approving this work.
          </p>
        </div>
      ),
      onClose,
      tone: fallbackTone,
      size: "md",
    }),
    [fallbackTone]
  );
  useLeftSheetConfig(config);

  return <LeftInspectorDialog fallbackTone={fallbackTone} />;
}

const meta = {
  title: "Admin/Shell/LeftInspectorDialog",
  component: LeftInspectorDialog,
  tags: ["autodocs", "storybook-ci"],
  parameters: {
    docs: {
      description: {
        component:
          "The CanvasLayout inspector host. It renders route-owned descriptor content through the canonical AdminDialog and forwards close events to the descriptor.",
      },
    },
  },
  decorators: [withAdminPrimitiveFrame],
  args: {
    fallbackTone: "hub",
  },
  render: (args) => (
    <LeftSheetProvider>
      <OpenInspector fallbackTone={args.fallbackTone === "garden" ? "garden" : "hub"} />
    </LeftSheetProvider>
  ),
} satisfies Meta<typeof LeftInspectorDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  play: async () => {
    const body = within(document.body);
    const dialog = await body.findByRole("dialog", { name: "Review work" });
    await waitFor(() => expect(within(dialog).getByText("Canopy transect upload")).toBeVisible());
    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await expect(onClose).toHaveBeenCalled();
  },
};

function RetainedWorkInspector() {
  const [routeWorkId, setRouteWorkId] = useState<string>();
  const selection = resolveHubSheetSelection({
    routeWorkId,
    activeWorkDetailId: "retained-work",
    hasSelectedCertification: false,
  });
  const hasSelection = Boolean(selection);
  const config = useMemo<LeftSheetConfig | null>(
    () =>
      hasSelection
        ? {
            title: "Review retained work",
            content: <p>Canopy transect upload</p>,
            tone: "hub",
            onClose: () => {
              setRouteWorkId(undefined);
              requestAnimationFrame(() => releaseStuckDialogArtifacts(document));
            },
          }
        : null,
    [hasSelection]
  );
  useLeftSheetConfig(config);
  return (
    <>
      <button type="button" onClick={() => setRouteWorkId("retained-work")}>
        View work
      </button>
      <LeftInspectorDialog fallbackTone="hub" />
    </>
  );
}

export const RetainedSelectionClose: Story = {
  render: () => (
    <LeftSheetProvider>
      <RetainedWorkInspector />
    </LeftSheetProvider>
  ),
  play: async () => {
    const body = within(document.body);
    // Both close gestures must release the portal and expose the workspace.
    for (const gesture of ["button", "escape"]) {
      await userEvent.click(body.getByRole("button", { name: "View work" }));
      const dialog = await body.findByRole("dialog", { name: "Review retained work" });
      await Promise.all(dialog.getAnimations().map((animation) => animation.finished));
      if (gesture === "button") {
        await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));
      } else {
        await userEvent.keyboard("{Escape}");
      }
      await waitFor(() => {
        expect(document.querySelector('[role="dialog"]')).toBeNull();
        expect(body.getByRole("button", { name: "View work" })).toBeVisible();
        expect(document.body.style.pointerEvents).toBe("");
      });
    }
  },
};
