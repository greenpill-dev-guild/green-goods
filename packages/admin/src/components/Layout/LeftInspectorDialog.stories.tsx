import type { Meta, StoryObj } from "@storybook/react";
import { useMemo } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { withAdminPrimitiveFrame } from "../../../../shared/.storybook/decorators";
import { LeftInspectorDialog } from "./LeftInspectorDialog";
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
