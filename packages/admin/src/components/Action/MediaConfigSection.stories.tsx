import type { ActionInstructionConfig } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { MediaConfigSection } from "./MediaConfigSection";

type MediaConfig = ActionInstructionConfig["uiConfig"]["media"];

const EMPTY_CONFIG: MediaConfig = {
  title: "Capture Media",
  description: "",
  maxImageCount: 3,
  minImageCount: 1,
  required: true,
  needed: [],
  optional: [],
};

const POPULATED_CONFIG: MediaConfig = {
  title: "Capture Media",
  description: "Before and after shots of the restoration site.",
  maxImageCount: 6,
  minImageCount: 2,
  required: true,
  needed: ["Wide shot", "Close-up"],
  optional: ["Volunteer team", "Disposal truck"],
};

function MediaConfigHarness({ initial }: { initial: MediaConfig }) {
  const [config, setConfig] = useState<MediaConfig>(initial);
  return <MediaConfigSection config={config} onChange={setConfig} />;
}

const meta: Meta<typeof MediaConfigHarness> = {
  title: "Admin/Workflows/Action/MediaConfigSection",
  // storybook-quality-allow state-harness: owns local state while rendering the real MediaConfigSection.
  component: MediaConfigHarness,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Media capture configuration: title, description, min/max image count, required flag, and lists of required vs optional shot types.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof MediaConfigHarness>;

export const Empty: Story = {
  args: { initial: EMPTY_CONFIG },
};

export const WithShots: Story = {
  args: { initial: POPULATED_CONFIG },
};

export const OptionalOnly: Story = {
  args: {
    initial: {
      ...EMPTY_CONFIG,
      required: false,
      optional: ["Team photo", "Location panorama"],
    },
  },
};
