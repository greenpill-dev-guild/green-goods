import type { Meta, StoryObj } from "@storybook/react";
import { expect, within, userEvent } from "storybook/test";
import { ErrorBoundary } from "./ErrorBoundary";

/**
 * Component that deliberately throws an error to trigger the ErrorBoundary.
 * Must throw during render (not in an effect or handler).
 */
const ThrowError = ({ message = "Test error for Storybook" }: { message?: string }) => {
  throw new Error(message);
};

/**
 * Normal child content that renders without errors.
 */
const SafeChild = () => (
  <div className="rounded-lg border border-stroke-soft-200 bg-bg-white-0 p-6 text-center">
    <p className="text-sm text-text-strong-950">
      This content renders normally inside the ErrorBoundary.
    </p>
  </div>
);

const meta: Meta<typeof ErrorBoundary> = {
  title: "Feedback/ErrorBoundary",
  component: ErrorBoundary,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "React Error Boundary that catches JavaScript errors in child components and displays a fallback UI. Supports custom fallback components, error callbacks, context labels, and reset handlers.",
      },
    },
  },
  argTypes: {
    children: {
      control: false,
      description: "Child components to wrap",
    },
    fallback: {
      control: false,
      description: "Optional fallback component to render on error",
    },
    onError: {
      description: "Called when an error is caught (for logging or reporting)",
    },
    context: {
      control: "text",
      description: "Optional context label for logging (e.g., 'HypercertWizard')",
    },
    onReset: {
      description: "Custom reset handler called instead of re-rendering",
    },
  },
};

export default meta;
type Story = StoryObj<typeof ErrorBoundary>;

export const Default: Story = {
  args: {
    children: <SafeChild />,
    context: "StoryExample",
  },
  parameters: {
    docs: {
      description: {
        story: "When children render without errors, they are displayed normally.",
      },
    },
  },
};

export const WithError: Story = {
  args: {
    children: <ThrowError />,
    context: "FailingComponent",
  },
  parameters: {
    docs: {
      description: {
        story:
          "When a child throws during render, the default fallback UI is shown with an alert icon, error message, and Try Again button.",
      },
    },
  },
};

export const WithCustomFallbackElement: Story = {
  args: {
    children: <ThrowError />,
    fallback: (
      <div className="rounded-lg border border-warning-base bg-warning-lighter p-6 text-center">
        <p className="text-sm font-medium text-warning-dark">
          Custom fallback: Something went wrong
        </p>
        <p className="text-xs text-warning-dark/70 mt-1">This is a custom ReactNode fallback.</p>
      </div>
    ),
    context: "CustomFallback",
  },
};

export const WithCustomFallbackFunction: Story = {
  args: {
    children: <ThrowError message="Database connection lost" />,
    fallback: (error: Error, reset: () => void) => (
      <div className="rounded-lg border border-error-base bg-error-lighter p-6">
        <p className="text-sm font-semibold text-error-dark">Caught: {error.message}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-3 rounded-full bg-error-base px-4 py-1.5 text-sm font-medium text-white hover:bg-error-dark transition"
        >
          Reset
        </button>
      </div>
    ),
    context: "FunctionFallback",
  },
  parameters: {
    docs: {
      description: {
        story:
          "When fallback is a function, it receives the caught error and a reset callback. This allows the fallback UI to display error details and offer recovery.",
      },
    },
  },
};

export const WithContext: Story = {
  args: {
    children: <ThrowError message="Failed to load garden data" />,
    context: "GardenDetailView",
  },
  parameters: {
    docs: {
      description: {
        story:
          "The context prop is used for logging/reporting. It appears in the logger output but does not affect the visual UI.",
      },
    },
  },
};

export const Gallery: Story = {
  render: () => (
    <div className="flex flex-col gap-6 max-w-lg">
      <div>
        <p className="text-xs text-text-soft-400 mb-2">Children render normally</p>
        <ErrorBoundary context="Gallery-Normal">
          <SafeChild />
        </ErrorBoundary>
      </div>
      <div>
        <p className="text-xs text-text-soft-400 mb-2">Default error fallback</p>
        <ErrorBoundary context="Gallery-Error">
          <ThrowError />
        </ErrorBoundary>
      </div>
      <div>
        <p className="text-xs text-text-soft-400 mb-2">Custom element fallback</p>
        <ErrorBoundary
          context="Gallery-CustomElement"
          fallback={
            <div className="rounded-lg border border-warning-base bg-warning-lighter p-4 text-center text-sm text-warning-dark">
              Custom element fallback
            </div>
          }
        >
          <ThrowError />
        </ErrorBoundary>
      </div>
      <div>
        <p className="text-xs text-text-soft-400 mb-2">Custom function fallback</p>
        <ErrorBoundary
          context="Gallery-CustomFn"
          fallback={(error, reset) => (
            <div className="rounded-lg border border-error-base bg-error-lighter p-4">
              <p className="text-sm text-error-dark">Error: {error.message}</p>
              <button
                type="button"
                onClick={reset}
                className="mt-2 text-xs font-medium text-error-base hover:underline"
              >
                Try again
              </button>
            </div>
          )}
        >
          <ThrowError message="Custom error message" />
        </ErrorBoundary>
      </div>
    </div>
  ),
};

export const DarkMode: Story = {
  args: {
    children: <ThrowError />,
    context: "DarkModeExample",
  },
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4">
        <Story />
      </div>
    ),
  ],
};

export const DarkModeGallery: Story = {
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <div className="flex flex-col gap-6 max-w-lg">
      <ErrorBoundary context="DarkGallery-Normal">
        <SafeChild />
      </ErrorBoundary>
      <ErrorBoundary context="DarkGallery-Error">
        <ThrowError />
      </ErrorBoundary>
    </div>
  ),
};

export const Interactive: Story = {
  args: {
    children: <ThrowError />,
    context: "InteractiveTest",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify the error fallback is displayed
    const alert = canvas.getByRole("alert");
    expect(alert).toBeInTheDocument();

    // Verify the heading
    expect(canvas.getByText("Something went wrong")).toBeInTheDocument();

    // Verify the description
    expect(canvas.getByText("An unexpected error occurred. Please try again.")).toBeInTheDocument();

    // Verify the try again button exists
    const tryAgainButton = canvas.getByRole("button", { name: /try again/i });
    expect(tryAgainButton).toBeInTheDocument();

    // Click try again (this will re-render children, which will throw again,
    // resulting in the error boundary catching it again)
    await userEvent.click(tryAgainButton);

    // After reset + re-throw, the error fallback should still be visible
    expect(canvas.getByRole("alert")).toBeInTheDocument();
  },
};
