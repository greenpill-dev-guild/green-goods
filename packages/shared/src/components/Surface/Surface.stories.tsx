import type { Meta, StoryObj } from "@storybook/react";
import { RiArrowRightLine, RiLeafLine } from "@remixicon/react";
import { Surface } from "./Surface";

const meta: Meta<typeof Surface> = {
  title: "Shared/Primitives/Surface",
  component: Surface,
  tags: ["autodocs"],
  argTypes: {
    elevation: {
      control: "select",
      options: ["ground", "raised", "floating", "overlay"],
    },
    padding: {
      control: "select",
      options: ["none", "compact", "default", "spacious"],
    },
    radius: {
      control: "select",
      options: ["md", "lg", "xl"],
    },
    interactive: {
      control: "boolean",
    },
    colorAccent: {
      control: "select",
      options: ["primary", "success", "warning", "error", "info"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Surface>;

export const Default: Story = {
  args: {
    elevation: "raised",
    padding: "default",
    radius: "lg",
  },
  render: (args) => (
    <div className="max-w-xl">
      <Surface {...args}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-lighter text-success-dark">
            <RiLeafLine className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-label-md text-text-strong-950">Shared surfaces</h3>
            <p className="text-paragraph-sm text-text-sub-600">
              Use `Surface` as the default shell for new shared and admin layouts.
            </p>
          </div>
        </div>
      </Surface>
    </div>
  ),
};

export const ComposedSections: Story = {
  render: () => (
    <div className="max-w-xl">
      <Surface elevation="raised">
        <Surface.Header>
          <div>
            <h3 className="text-label-md text-text-strong-950">Garden treasury</h3>
            <p className="text-paragraph-sm text-text-sub-600">Operational summary</p>
          </div>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-stroke-soft-200 text-text-sub-600 transition-colors hover:text-text-strong-950"
            aria-label="Open details"
          >
            <RiArrowRightLine className="h-4 w-4" />
          </button>
        </Surface.Header>
        <Surface.Body className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-bg-weak p-4">
            <div className="text-label-sm text-text-sub-600">Deposited</div>
            <div className="mt-1 text-title-sm text-text-strong-950">2,450 DAI</div>
          </div>
          <div className="rounded-lg bg-bg-weak p-4">
            <div className="text-label-sm text-text-sub-600">APY</div>
            <div className="mt-1 text-title-sm text-text-strong-950">4.82%</div>
          </div>
        </Surface.Body>
        <Surface.Footer className="justify-between">
          <span className="text-paragraph-sm text-text-sub-600">Last sync 4 minutes ago</span>
          <span className="text-label-sm text-success-dark">Healthy</span>
        </Surface.Footer>
      </Surface>
    </div>
  ),
};

export const ElevationGallery: Story = {
  render: () => (
    <div className="grid gap-4 sm:grid-cols-2">
      {(["ground", "raised", "floating", "overlay"] as const).map((elevation) => (
        <Surface key={elevation} elevation={elevation} padding="default">
          <div className="space-y-2">
            <div className="text-label-md text-text-strong-950 capitalize">{elevation}</div>
            <div className="text-paragraph-sm text-text-sub-600">
              Tonal elevation and shadow treatment for {elevation} surfaces.
            </div>
          </div>
        </Surface>
      ))}
    </div>
  ),
};

export const Interactive: Story = {
  render: () => (
    <div className="max-w-sm">
      <Surface as="button" elevation="raised" padding="default" interactive>
        <div className="flex items-center justify-between gap-4 text-left">
          <div>
            <div className="text-label-md text-text-strong-950">Open queue details</div>
            <div className="text-paragraph-sm text-text-sub-600">
              Interactive surfaces keep motion and elevation consistent.
            </div>
          </div>
          <RiArrowRightLine className="h-5 w-5 text-text-sub-600" />
        </div>
      </Surface>
    </div>
  ),
};
