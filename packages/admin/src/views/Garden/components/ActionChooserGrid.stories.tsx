import { type Action, Capital, Domain } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { withAdminPrimitiveFrame, withI18n } from "../../../../../shared/.storybook/decorators";
import { ActionChooserGrid } from "./ActionChooserGrid";

function makeAction(overrides: Partial<Action>): Action {
  return {
    id: "42161-1",
    slug: "agro.site_assessment_before",
    title: "Site Assessment (Before)",
    startTime: 0,
    endTime: 0,
    instructions: "",
    capitals: [Capital.LIVING, Capital.SOCIAL],
    media: [],
    domain: Domain.AGRO,
    createdAt: 0,
    description: "Document baseline site conditions before regenerative work begins.",
    inputs: [],
    mediaInfo: { title: "Before photos", required: true, minImageCount: 2, maxImageCount: 4 },
    ...overrides,
  };
}

const ACTIONS: Action[] = [
  makeAction({}),
  makeAction({
    id: "42161-2",
    slug: "agro.site_assessment_after",
    title: "Site Assessment (After)",
    description: "Capture site conditions after the work is complete to evidence change.",
    capitals: [Capital.LIVING],
    mediaInfo: { title: "After photos", required: true, minImageCount: 2, maxImageCount: 4 },
  }),
  makeAction({
    id: "42161-3",
    slug: "agro.observation",
    title: "Observation",
    description: "Log an ad-hoc observation — a species, the weather, or a quick field note.",
    capitals: [Capital.INTELLECTUAL, Capital.EXPERIENTIAL],
    mediaInfo: { title: "Optional photos", required: false },
  }),
];

const meta: Meta<typeof ActionChooserGrid> = {
  title: "Admin/Workflows/Garden/ActionChooserGrid",
  component: ActionChooserGrid,
  tags: ["autodocs"],
  decorators: [withI18n, withAdminPrimitiveFrame],
  parameters: {
    docs: {
      description: {
        component:
          "The Choose step of Submit Work — a scannable grid of selectable action cards (title, description, capitals, photo requirement) that replaces the legacy <select>.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ActionChooserGrid>;

function ChooserHarness({ initialId = "" }: { initialId?: string }) {
  const [selectedActionId, setSelectedActionId] = useState(initialId);
  return (
    <ActionChooserGrid
      actions={ACTIONS}
      selectedActionId={selectedActionId}
      onSelect={setSelectedActionId}
      groupLabel="Action"
    />
  );
}

export const Unselected: Story = {
  tags: ["storybook-ci"],
  // storybook-quality-allow state-harness: ChooserHarness owns selection state while rendering the real ActionChooserGrid.
  render: () => <ChooserHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const cards = canvas.getAllByRole("radio");
    expect(cards).toHaveLength(3);
    await userEvent.click(canvas.getByRole("radio", { name: /Observation/ }));
    await expect(canvas.getByRole("radio", { name: /Observation/ })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  },
};

export const Selected: Story = {
  // storybook-quality-allow state-harness: ChooserHarness owns selection state while rendering the real ActionChooserGrid.
  render: () => <ChooserHarness initialId="42161-2" />,
};

export const Disabled: Story = {
  render: () => (
    <ActionChooserGrid
      actions={ACTIONS}
      selectedActionId="42161-1"
      onSelect={() => {}}
      disabled
      groupLabel="Action"
    />
  ),
};
