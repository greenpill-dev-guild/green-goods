import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { SheetErrorBoundary } from "./SheetErrorBoundary";

function ThrowOnRender(): never {
  throw new Error("Storybook sheet content failed");
}

const meta: Meta<typeof SheetErrorBoundary> = {
  title: "Canvas/SheetErrorBoundary",
  component: SheetErrorBoundary,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof SheetErrorBoundary>;

export const Healthy: Story = {
  args: {
    children: (
      <div className="rounded-lg border border-stroke-soft bg-bg-white p-4">
        Sheet content loaded normally.
      </div>
    ),
  },
};

export const ErrorFallback: Story = {
  args: {
    onClose: fn(),
    children: <ThrowOnRender />,
  },
};
