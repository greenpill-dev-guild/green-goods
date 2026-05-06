import type { Meta, StoryObj } from "@storybook/react";
import { RiAddLine, RiLeafLine } from "@remixicon/react";
import { FabProvider, useFabConfig, useFabConfigValue } from "./FabContext";

function FabContextPreview({ hidden = false }: { hidden?: boolean }) {
  useFabConfig(
    hidden
      ? null
      : {
          icon: RiAddLine,
          label: "Create",
          actions: [
            {
              id: "submit-work",
              icon: RiLeafLine,
              label: "Submit work",
              labelId: "story.fab.submitWork",
            },
          ],
          onAction: () => {},
        }
  );

  const config = useFabConfigValue();

  return (
    <div className="space-y-4 rounded-xl border border-stroke-soft-200 bg-bg-white p-4">
      <div className="text-label-md text-text-strong-950">Declared FAB config</div>
      <pre className="overflow-x-auto rounded-lg bg-bg-weak p-3 text-xs text-text-sub-600">
        {JSON.stringify(
          config
            ? {
                label: config.label,
                actions: config.actions?.map((action) => action.label),
              }
            : null,
          null,
          2
        )}
      </pre>
    </div>
  );
}

const meta = {
  title: "Shared/Canvas/FabContext",
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <FabProvider>
      <FabContextPreview />
    </FabProvider>
  ),
};

export const Hidden: Story = {
  render: () => (
    <FabProvider>
      <FabContextPreview hidden />
    </FabProvider>
  ),
};
