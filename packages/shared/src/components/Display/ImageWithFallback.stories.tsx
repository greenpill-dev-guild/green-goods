import type { Meta, StoryObj } from "@storybook/react";
import { RiUserLine, RiImageLine } from "@remixicon/react";
import { ImageWithFallback } from "./ImageWithFallback";

const meta: Meta<typeof ImageWithFallback> = {
  title: "Components/Display/ImageWithFallback",
  component: ImageWithFallback,
  tags: ["autodocs"],
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
    src: "https://picsum.photos/200/200",
    alt: "Sample image",
    className: "w-32 h-32 rounded-lg object-cover",
  },
};

export const WithError: Story = {
  args: {
    src: "https://invalid-url.com/nonexistent.jpg",
    alt: "Image that will fail",
    className: "w-32 h-32 rounded-lg",
  },
};

export const CustomFallbackIcon: Story = {
  args: {
    src: "https://invalid-url.com/nonexistent.jpg",
    alt: "User avatar",
    className: "w-32 h-32 rounded-full",
    fallbackIcon: RiUserLine,
  },
};

export const Gallery: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-4">
      <ImageWithFallback
        src="https://picsum.photos/200/200?random=1"
        alt="Image 1"
        className="w-24 h-24 rounded-lg object-cover"
      />
      <ImageWithFallback
        src="https://invalid-url.com/fail.jpg"
        alt="Image 2 (will fail)"
        className="w-24 h-24 rounded-lg"
      />
      <ImageWithFallback
        src="https://picsum.photos/200/200?random=2"
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
        src="https://picsum.photos/100/100?random=1"
        alt="User 1"
        className="w-12 h-12 rounded-full object-cover"
        fallbackIcon={RiUserLine}
      />
      <ImageWithFallback
        src="https://invalid-url.com/fail.jpg"
        alt="User 2"
        className="w-12 h-12 rounded-full"
        fallbackIcon={RiUserLine}
      />
      <ImageWithFallback
        src="https://picsum.photos/100/100?random=2"
        alt="User 3"
        className="w-12 h-12 rounded-full object-cover"
        fallbackIcon={RiUserLine}
      />
    </div>
  ),
};
