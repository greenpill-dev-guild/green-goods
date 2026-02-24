import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { AudioPlayer } from "./AudioPlayer";

/**
 * Create a minimal valid WAV data URL for story use.
 * This produces a 0.1s silent WAV so the <audio> element loads metadata.
 */
function createSilentWavDataUrl(): string {
  // Minimal WAV: 44-byte header + 4410 samples (0.1s at 44100Hz, 16-bit mono)
  const numSamples = 4410;
  const byteRate = 88200;
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");

  // fmt chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, 44100, true); // sample rate
  view.setUint32(28, byteRate, true);
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample

  // data chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);
  // Samples are all zeros (silence)

  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return "data:audio/wav;base64," + btoa(binary);
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

const SILENT_WAV = createSilentWavDataUrl();

const meta: Meta<typeof AudioPlayer> = {
  title: "Media/AudioPlayer",
  component: AudioPlayer,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Audio player with play/pause, seek bar, and elapsed/total time display. Supports both direct src URLs and File objects.",
      },
    },
  },
  argTypes: {
    src: {
      control: "text",
      description: "Audio source URL (blob URL or IPFS gateway URL)",
    },
    file: {
      control: false,
      description: "Audio File object (creates blob URL internally)",
    },
    compact: {
      control: "boolean",
      description: "Compact mode for inline use in cards",
    },
    onDelete: {
      description: "Called when the user clicks the delete button",
    },
    className: {
      control: "text",
      description: "Additional CSS classes",
    },
  },
};

export default meta;
type Story = StoryObj<typeof AudioPlayer>;

export const Default: Story = {
  args: {
    src: SILENT_WAV,
  },
};

export const Compact: Story = {
  args: {
    src: SILENT_WAV,
    compact: true,
  },
};

export const WithDeleteButton: Story = {
  args: {
    src: SILENT_WAV,
    onDelete: fn(),
  },
};

export const CompactWithDelete: Story = {
  args: {
    src: SILENT_WAV,
    compact: true,
    onDelete: fn(),
  },
};

export const Gallery: Story = {
  render: () => (
    <div className="flex flex-col gap-4 max-w-md">
      <div>
        <p className="text-xs text-text-soft-400 mb-1">Default</p>
        <AudioPlayer src={SILENT_WAV} />
      </div>
      <div>
        <p className="text-xs text-text-soft-400 mb-1">Compact</p>
        <AudioPlayer src={SILENT_WAV} compact />
      </div>
      <div>
        <p className="text-xs text-text-soft-400 mb-1">With delete</p>
        <AudioPlayer src={SILENT_WAV} onDelete={() => {}} />
      </div>
      <div>
        <p className="text-xs text-text-soft-400 mb-1">Compact with delete</p>
        <AudioPlayer src={SILENT_WAV} compact onDelete={() => {}} />
      </div>
    </div>
  ),
};

export const DarkMode: Story = {
  args: {
    src: SILENT_WAV,
    onDelete: fn(),
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
    src: SILENT_WAV,
    onDelete: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Verify play button exists
    const playButton = canvas.getByRole("button", { name: "Play" });
    expect(playButton).toBeInTheDocument();

    // Verify progress slider exists
    const slider = canvas.getByRole("slider", { name: "Audio progress" });
    expect(slider).toBeInTheDocument();

    // Verify delete button exists
    const deleteButton = canvas.getByRole("button", { name: "Delete audio" });
    expect(deleteButton).toBeInTheDocument();

    // Click delete
    await userEvent.click(deleteButton);
    expect(args.onDelete).toHaveBeenCalled();
  },
};

export const NoSource: Story = {
  args: {
    src: undefined,
  },
  parameters: {
    docs: {
      description: {
        story: "Returns null when no src or file is provided.",
      },
    },
  },
};
