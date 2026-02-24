import type { Meta, StoryObj } from "@storybook/react";
import { expect, within, userEvent, waitFor } from "storybook/test";
import { ToastViewport } from "./ToastViewport";
import { toastService } from "./toast.service";

const meta: Meta<typeof ToastViewport> = {
  title: "Feedback/Toast",
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
      <p className="text-sm text-text-sub-600 mb-2">Click buttons to show different toast types:</p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => toastService.show({ status: "success", message: "Operation successful!" })}
          className="px-4 py-2 bg-success-base text-white rounded-lg hover:bg-success-dark transition-colors"
        >
          Success Toast
        </button>
        <button
          onClick={() => toastService.show({ status: "error", message: "Something went wrong." })}
          className="px-4 py-2 bg-error-base text-white rounded-lg hover:bg-error-dark transition-colors"
        >
          Error Toast
        </button>
        <button
          onClick={() => toastService.show({ status: "info", message: "Here's some information." })}
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
          const toastId = toastService.show({ status: "loading", message: "Processing..." });
          setTimeout(() => {
            toastService.dismiss(toastId);
            toastService.show({ status: "success", message: "Done!" });
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
      <p className="text-sm text-text-sub-600 mb-2">Click to show multiple toasts at once:</p>
      <button
        onClick={() => {
          toastService.show({ status: "success", message: "First notification" });
          setTimeout(
            () => toastService.show({ status: "info", message: "Second notification" }),
            200
          );
          setTimeout(
            () => toastService.show({ status: "info", message: "Third notification" }),
            400
          );
        }}
        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors w-fit"
      >
        Show Multiple
      </button>
    </div>
  ),
};

export const DarkMode: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-text-sub-600 mb-2">Click buttons to show toasts in dark mode:</p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => toastService.show({ status: "success", message: "Operation successful!" })}
          className="px-4 py-2 bg-success-base text-white rounded-lg hover:bg-success-dark transition-colors"
        >
          Success Toast
        </button>
        <button
          onClick={() => toastService.show({ status: "error", message: "Something went wrong." })}
          className="px-4 py-2 bg-error-base text-white rounded-lg hover:bg-error-dark transition-colors"
        >
          Error Toast
        </button>
      </div>
    </div>
  ),
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4 min-h-[400px] relative">
        <Story />
        <ToastViewport />
      </div>
    ),
  ],
};

// ─── Interactive play() test variants ───────────────────────────────

/**
 * Automated test: triggers a success toast and verifies it appears.
 */
export const InteractiveSuccess: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <button
        data-testid="trigger-success"
        onClick={() => toastService.show({ status: "success", message: "Operation successful!" })}
        className="px-4 py-2 bg-success-base text-white rounded-lg hover:bg-success-dark transition-colors w-fit"
      >
        Success Toast
      </button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click the success button
    const button = canvas.getByTestId("trigger-success");
    await userEvent.click(button);

    // Verify toast appears (react-hot-toast renders outside the canvas,
    // so we query the full document body)
    await waitFor(
      () => {
        const body = within(document.body);
        expect(body.getByText("Operation successful!")).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  },
};

/**
 * Automated test: triggers an error toast and verifies it appears.
 */
export const InteractiveError: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <button
        data-testid="trigger-error"
        onClick={() => toastService.show({ status: "error", message: "Something went wrong." })}
        className="px-4 py-2 bg-error-base text-white rounded-lg hover:bg-error-dark transition-colors w-fit"
      >
        Error Toast
      </button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const button = canvas.getByTestId("trigger-error");
    await userEvent.click(button);

    await waitFor(
      () => {
        const body = within(document.body);
        expect(body.getByText("Something went wrong.")).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  },
};

/**
 * Automated test: triggers an info toast and verifies it appears.
 */
export const InteractiveInfo: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <button
        data-testid="trigger-info"
        onClick={() => toastService.show({ status: "info", message: "Here's some information." })}
        className="px-4 py-2 bg-information-base text-white rounded-lg hover:bg-information-dark transition-colors w-fit"
      >
        Info Toast
      </button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const button = canvas.getByTestId("trigger-info");
    await userEvent.click(button);

    await waitFor(
      () => {
        const body = within(document.body);
        expect(body.getByText("Here's some information.")).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  },
};

/**
 * Automated test: triggers a loading toast, waits, then verifies
 * it transitions to a success toast.
 */
export const InteractiveLoading: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <button
        data-testid="trigger-loading"
        onClick={() => {
          const toastId = toastService.show({ status: "loading", message: "Processing..." });
          setTimeout(() => {
            toastService.dismiss(toastId);
            toastService.show({ status: "success", message: "Done!" });
          }, 1000);
        }}
        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors w-fit"
      >
        Start Loading
      </button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const button = canvas.getByTestId("trigger-loading");
    await userEvent.click(button);

    // Verify loading toast appears
    await waitFor(
      () => {
        const body = within(document.body);
        expect(body.getByText("Processing...")).toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    // Wait for the loading toast to resolve to success
    await waitFor(
      () => {
        const body = within(document.body);
        expect(body.getByText("Done!")).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};
