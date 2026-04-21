import type { Meta, StoryObj } from "@storybook/react";
import { FIXTURE_WORK_MEDIA } from "../../../../../shared/.storybook/fixtures";
import { MediaEvidence } from "./MediaEvidence";

const meta: Meta<typeof MediaEvidence> = {
  title: "Admin/Workflows/Hub/MediaEvidence",
  component: MediaEvidence,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Photo grid + audio-note list used when reviewing work detail. Photos open in a full-screen lightbox. Fixture images are data-url SVGs so stories run fully offline.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof MediaEvidence>;

export const PhotosOnly: Story = {
  args: {
    media: FIXTURE_WORK_MEDIA,
    actionTitle: "Riverbank cleanup",
  },
};

export const Empty: Story = {
  args: {
    media: [],
    actionTitle: "Riverbank cleanup",
  },
};

export const WithAudioNotes: Story = {
  args: {
    media: FIXTURE_WORK_MEDIA.slice(0, 2),
    // Audio CIDs aren't exercised by `resolveIPFSUrl` in Storybook — the
    // AudioPlayer renders its empty state, which is the reviewable
    // contract here.
    audioNoteCids: ["bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"],
    actionTitle: "Species survey",
  },
};
