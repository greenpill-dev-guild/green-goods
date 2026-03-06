import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "storybook/test";
import { AudioRecorder } from "./AudioRecorder";

const meta: Meta<typeof AudioRecorder> = {
  title: "Media/AudioRecorder",
  component: AudioRecorder,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Audio recorder using the MediaRecorder API. Flow: idle -> requesting-permission -> recording -> preview -> confirmed. Records in WebM/Opus format with configurable max duration and amplitude visualization.",
      },
    },
  },
  argTypes: {
    onRecordingComplete: {
      description: "Called when a recording is confirmed by the user",
      action: "recordingComplete",
    },
    maxDuration: {
      control: { type: "number", min: 10, max: 600 },
      description: "Maximum recording duration in seconds (default: 260 = 4:20)",
    },
    disabled: {
      control: "boolean",
      description: "Disables the start recording button",
    },
    className: {
      control: "text",
      description: "Additional CSS classes",
    },
  },
};

export default meta;
type Story = StoryObj<typeof AudioRecorder>;

/**
 * Default idle state showing the "Record audio note" button.
 * Note: Clicking "Record" will request microphone permission from the browser.
 * In environments without MediaRecorder (some test runners), the permission
 * request will fail gracefully and show an error message.
 */
export const Default: Story = {
  args: {
    onRecordingComplete: fn(),
  },
};

export const Disabled: Story = {
  args: {
    onRecordingComplete: fn(),
    disabled: true,
  },
};

export const ShortMaxDuration: Story = {
  args: {
    onRecordingComplete: fn(),
    maxDuration: 30,
  },
  parameters: {
    docs: {
      description: {
        story: "Recorder with a 30-second maximum duration.",
      },
    },
  },
};

export const Gallery: Story = {
  render: () => (
    <div className="flex flex-col gap-6 max-w-md">
      <div>
        <p className="text-xs text-text-soft-400 mb-1">Default (idle state)</p>
        <AudioRecorder onRecordingComplete={() => {}} />
      </div>
      <div>
        <p className="text-xs text-text-soft-400 mb-1">Disabled</p>
        <AudioRecorder onRecordingComplete={() => {}} disabled />
      </div>
      <div>
        <p className="text-xs text-text-soft-400 mb-1">Short max duration (30s)</p>
        <AudioRecorder onRecordingComplete={() => {}} maxDuration={30} />
      </div>
    </div>
  ),
};

export const DarkMode: Story = {
  args: {
    onRecordingComplete: fn(),
  },
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4">
        <Story />
      </div>
    ),
  ],
};

export const Interactive: Story = {
  args: {
    onRecordingComplete: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify the idle state shows the record button
    const recordButton = canvas.getByRole("button", {
      name: "Start recording audio note",
    });
    expect(recordButton).toBeInTheDocument();
    expect(recordButton).toBeEnabled();
  },
};

export const InteractiveDisabled: Story = {
  args: {
    onRecordingComplete: fn(),
    disabled: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const recordButton = canvas.getByRole("button", {
      name: "Start recording audio note",
    });
    expect(recordButton).toBeDisabled();
  },
};
