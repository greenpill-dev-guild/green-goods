import { RiUserLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import {
  FIXTURE_IMAGE_AGROFORESTRY,
  FIXTURE_IMAGE_EDU,
  FIXTURE_IMAGE_SOLAR,
} from "../../../.storybook/fixtures";
import { ImageWithFallback } from "./ImageWithFallback";

const meta: Meta<typeof ImageWithFallback> = {
  title: "Shared/Display/ImageWithFallback",
  component: ImageWithFallback,
  tags: ["autodocs", "storybook-ci"],
  argTypes: {
    src: {
      control: "text",
      description: "Image source URL",
    },
    alt: {
      control: "text",
      description: "Alt text for the image",
    },
  },
};

export default meta;
type Story = StoryObj<typeof ImageWithFallback>;

export const Default: Story = {
  args: {
    src: FIXTURE_IMAGE_AGROFORESTRY,
    alt: "Sample image",
    className: "w-32 h-32 rounded-lg object-cover",
  },
};

export const WithError: Story = {
  args: {
    src: "",
    alt: "Image that will fail",
    className: "w-32 h-32 rounded-lg",
  },
};

export const CustomFallbackIcon: Story = {
  args: {
    src: "",
    alt: "User avatar",
    className: "w-32 h-32 rounded-full",
    fallbackIcon: RiUserLine,
  },
};

export const StateCatalog: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-4">
      <ImageWithFallback
        src={FIXTURE_IMAGE_AGROFORESTRY}
        alt="Image 1"
        className="w-24 h-24 rounded-lg object-cover"
      />
      <ImageWithFallback src="" alt="Image 2 (will fail)" className="w-24 h-24 rounded-lg" />
      <ImageWithFallback
        src={FIXTURE_IMAGE_SOLAR}
        alt="Image 3"
        className="w-24 h-24 rounded-lg object-cover"
      />
    </div>
  ),
};

export const AvatarStyle: Story = {
  render: () => (
    <div className="flex gap-4">
      <ImageWithFallback
        src={FIXTURE_IMAGE_AGROFORESTRY}
        alt="User 1"
        className="w-12 h-12 rounded-full object-cover"
        fallbackIcon={RiUserLine}
      />
      <ImageWithFallback
        src=""
        alt="User 2"
        className="w-12 h-12 rounded-full"
        fallbackIcon={RiUserLine}
      />
      <ImageWithFallback
        src={FIXTURE_IMAGE_EDU}
        alt="User 3"
        className="w-12 h-12 rounded-full object-cover"
        fallbackIcon={RiUserLine}
      />
    </div>
  ),
};
