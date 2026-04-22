import type { Meta, StoryObj } from "@storybook/react";
import {
  FIXTURE_IMAGE_AGROFORESTRY,
  FIXTURE_IMAGE_EDU,
  FIXTURE_IMAGE_SOLAR,
} from "../../../.storybook/fixtures";
import { ImagePreviewDialog } from "./ImagePreviewDialog";

const meta: Meta<typeof ImagePreviewDialog> = {
  title: "Shared/Feedback/ImagePreviewDialog",
  component: ImagePreviewDialog,
  tags: ["autodocs", "storybook-ci"],
  argTypes: {
    isOpen: {
      control: "boolean",
      description: "Whether the dialog is open",
    },
    onClose: {
      description: "Callback when the dialog is closed",
    },
    images: {
      control: "object",
      description: "Array of image URLs to preview",
    },
    initialIndex: {
      control: "number",
      description: "Index of the image to show initially",
    },
    className: {
      control: "text",
      description: "Additional class names for the overlay",
    },
  },
};

export default meta;
type Story = StoryObj<typeof ImagePreviewDialog>;

const sampleImages = [
  FIXTURE_IMAGE_AGROFORESTRY,
  FIXTURE_IMAGE_SOLAR,
  FIXTURE_IMAGE_EDU,
];

export const Default: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    images: sampleImages,
    initialIndex: 0,
  },
};

export const SingleImage: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    images: [FIXTURE_IMAGE_AGROFORESTRY],
    initialIndex: 0,
  },
};

export const StartAtSecondImage: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    images: sampleImages,
    initialIndex: 1,
  },
};

export const DarkMode: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    images: sampleImages,
    initialIndex: 0,
  },
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4">
        <Story />
      </div>
    ),
  ],
};

export const Gallery: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-secondary">
        The ImagePreviewDialog is a full-screen overlay. Each story above shows a different
        configuration (single image, multiple images, starting at a specific index). Open them
        individually to interact.
      </p>
      <ImagePreviewDialog isOpen={true} onClose={() => {}} images={sampleImages} initialIndex={0} />
    </div>
  ),
};
