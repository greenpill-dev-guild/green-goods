import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { fn } from "storybook/test";
import { withAdminPrimitiveFrame, withI18n } from "../../../../../shared/.storybook/decorators";
import {
  stagedWorkPhoto,
  stagedWorkPhotos,
  stagedWorkVideo,
} from "../../../../../shared/.storybook/workPhotoFixtures";
import { SubmitWorkPhotos, type SubmitWorkPhotosProps } from "./SubmitWorkPhotos";

/** Owns the staged list, so removing a tile moves the count as it does in the flow. */
function StagedPhotos({ images: staged, minRequired }: Omit<SubmitWorkPhotosProps, "onRemove">) {
  const [images, setImages] = useState(staged);
  return (
    <SubmitWorkPhotos
      images={images}
      minRequired={minRequired}
      onRemove={(index) => setImages((current) => current.filter((_, item) => item !== index))}
    />
  );
}

// The step around these tiles, at each count, is in SubmitWorkStepContent's media
// stories; the flow's real dialog host is SubmitWorkPanel's MediaStep.
const meta = {
  title: "Admin/Workflows/Garden/SubmitWorkPhotos",
  component: SubmitWorkPhotos,
  tags: ["autodocs"],
  decorators: [withI18n, withAdminPrimitiveFrame],
  args: { images: [], minRequired: 2, onRemove: fn() },
  render: ({ images, minRequired }) => <StagedPhotos images={images} minRequired={minRequired} />,
} satisfies Meta<typeof SubmitWorkPhotos>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One of two: the count stays amber and says how many the action still needs. */
export const BelowRequirement: Story = {
  args: { images: stagedWorkPhotos(1) },
};

/**
 * Worst case: a name longer than its tile, and a video, which has no still to
 * open. The count matches what the Next button checks, so it counts the video.
 */
export const LongNamesAndVideo: Story = {
  args: {
    images: [
      stagedWorkPhoto("IMG_20261003_174512_east-beds-before-mulching-wide-angle.jpg", 3_870_000),
      stagedWorkVideo("walkthrough-of-the-east-beds.mp4"),
      ...stagedWorkPhotos(1),
    ],
  },
};
