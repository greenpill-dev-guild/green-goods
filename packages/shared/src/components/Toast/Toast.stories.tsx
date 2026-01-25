import type { Meta, StoryObj } from "@storybook/react";
import { ToastViewport } from "./ToastViewport";
import { toastService } from "./toast.service";

const meta: Meta<typeof ToastViewport> = {
  title: "Components/Toast",
  component: ToastViewport,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="min-h-[400px] relative">
        <Story />
        <ToastViewport />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ToastViewport>;

/**
 * Toast notifications demo.
 * Click the buttons to trigger different toast types.
 */
export const Demo: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-text-sub-600 mb-2">
        Click buttons to show different toast types:
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => toastService.show({ type: "success", message: "Operation successful!" })}
          className="px-4 py-2 bg-success-base text-white rounded-lg hover:bg-success-dark transition-colors"
        >
          Success Toast
        </button>
        <button
          onClick={() => toastService.show({ type: "error", message: "Something went wrong." })}
          className="px-4 py-2 bg-error-base text-white rounded-lg hover:bg-error-dark transition-colors"
        >
          Error Toast
        </button>
        <button
          onClick={() => toastService.show({ type: "warning", message: "Please check your input." })}
          className="px-4 py-2 bg-warning-base text-white rounded-lg hover:bg-warning-dark transition-colors"
        >
          Warning Toast
        </button>
        <button
          onClick={() => toastService.show({ type: "info", message: "Here's some information." })}
          className="px-4 py-2 bg-information-base text-white rounded-lg hover:bg-information-dark transition-colors"
        >
          Info Toast
        </button>
      </div>
    </div>
  ),
};

/**
 * Loading toast with promise resolution
 */
export const LoadingToast: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-text-sub-600 mb-2">
        Demonstrates a loading toast that resolves after 2 seconds:
      </p>
      <button
        onClick={() => {
          const toastId = toastService.show({ type: "loading", message: "Processing..." });
          setTimeout(() => {
            toastService.dismiss(toastId);
            toastService.show({ type: "success", message: "Done!" });
          }, 2000);
        }}
        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors w-fit"
      >
        Start Loading
      </button>
    </div>
  ),
};

/**
 * Multiple toasts stacked
 */
export const MultipleToasts: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-text-sub-600 mb-2">
        Click to show multiple toasts at once:
      </p>
      <button
        onClick={() => {
          toastService.show({ type: "success", message: "First notification" });
          setTimeout(() => toastService.show({ type: "info", message: "Second notification" }), 200);
          setTimeout(() => toastService.show({ type: "warning", message: "Third notification" }), 400);
        }}
        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors w-fit"
      >
        Show Multiple
      </button>
    </div>
  ),
};
