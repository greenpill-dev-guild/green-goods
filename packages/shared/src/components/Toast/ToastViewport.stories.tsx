import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { ToastViewport } from "./ToastViewport";
import { toastService } from "./toast.service";

const meta: Meta<typeof ToastViewport> = {
  title: "Shared/Feedback/ToastViewport",
  component: ToastViewport,
  tags: ["autodocs", "storybook-ci"],
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
    variant: {
      control: "select",
      options: ["default", "editorial"],
      description: "Visual treatment for the toast shell",
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

export const EditorialWebsite: Story = {
  render: () => <ToastTrigger viewport={<ToastViewport variant="editorial" />} />,
};

export const Interactive: Story = {
  render: () => <ToastTrigger />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const successBtn = canvas.getByRole("button", { name: "Success" });
    await userEvent.click(successBtn);
    await expect(successBtn).toBeVisible();
  },
};

/**
 * A toast with a title, a message and an action: the status icon sits on the
 * title's line, and the message and action run the toast's full width below it.
 * The action's green is the text role, so it reads on the dark toast too.
 */
export const TitleMessageAndAction: Story = {
  render: () => <ToastTrigger />,
  play: async ({ canvasElement }) => {
    toastService.error({
      id: "title-message-action",
      title: "Couldn't add proof",
      message: "It's still saved on this phone. Try again here or from Your Work.",
      action: { label: "Open Your Work", onClick: () => {} },
      // Long enough to measure and capture; a persistent toast would add a close button.
      duration: 60_000,
    });
    const body = await within(canvasElement).findByTestId("toast-content");
    const title = within(body).getByText("Couldn't add proof");
    const titleLine = title.parentElement as HTMLElement;
    const icon = titleLine.querySelector("svg") as SVGElement;
    const message = within(body).getByText(/still saved on this phone/);
    const center = (box: DOMRect) => box.top + box.height / 2;
    const iconBox = icon.getBoundingClientRect();
    const titleBox = title.getBoundingClientRect();
    await expect(Math.abs(center(iconBox) - center(titleBox))).toBeLessThanOrEqual(1);
    // The message starts where the icon does, not after it.
    await expect(message.getBoundingClientRect().left).toBe(iconBox.left);
    const action = within(body).getByRole("button", { name: "Open Your Work" });
    const probe = document.createElement("span");
    probe.style.color = "var(--color-primary-on-surface)";
    body.append(probe);
    await expect(getComputedStyle(action).color).toBe(getComputedStyle(probe).color);
    probe.remove();
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
