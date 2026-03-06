import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { ToastViewport } from "./ToastViewport";
import { toastService } from "./toast.service";

const meta: Meta<typeof ToastViewport> = {
  title: "Feedback/ToastViewport",
  component: ToastViewport,
  tags: ["autodocs"],
  argTypes: {
    position: {
      control: "select",
      options: [
        "top-left",
        "top-center",
        "top-right",
        "bottom-left",
        "bottom-center",
        "bottom-right",
      ],
      description: "Position of the toast container on screen",
    },
  },
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof ToastViewport>;

function ToastTrigger({ viewport }: { viewport?: React.ReactNode }) {
  return (
    <div className="relative h-[300px] w-full bg-bg-white-0 p-8">
      {viewport ?? <ToastViewport />}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => toastService.success({ title: "Operation completed" })}
          className="rounded-lg bg-success-base px-3 py-2 text-sm font-medium text-white"
        >
          Success
        </button>
        <button
          type="button"
          onClick={() => toastService.error({ title: "Something went wrong" })}
          className="rounded-lg bg-error-base px-3 py-2 text-sm font-medium text-white"
        >
          Error
        </button>
        <button
          type="button"
          onClick={() => toastService.info({ title: "Here is an update" })}
          className="rounded-lg bg-information-base px-3 py-2 text-sm font-medium text-white"
        >
          Info
        </button>
      </div>
    </div>
  );
}

export const Default: Story = {
  render: () => <ToastTrigger />,
};

export const BottomRight: Story = {
  render: () => <ToastTrigger viewport={<ToastViewport position="bottom-right" />} />,
};

export const Interactive: Story = {
  render: () => <ToastTrigger />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const successBtn = canvas.getByText("Success");
    await userEvent.click(successBtn);
    await expect(successBtn).toBeVisible();
  },
};

export const DarkMode: Story = {
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4">
        <Story />
      </div>
    ),
  ],
  render: () => <ToastTrigger />,
};
