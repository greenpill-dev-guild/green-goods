import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import type { SubmissionProgressState } from "../../hooks/work/useSubmissionProgress";
import { SubmissionProgress } from "./SubmissionProgress";

const idleProgress: SubmissionProgressState = {
  stage: "idle",
  stageProgress: 0,
  overallProgress: 0,
  message: "Ready to submit",
};

const compressingProgress: SubmissionProgressState = {
  stage: "compressing",
  stageProgress: 60,
  overallProgress: 9,
  message: "Compressing images...",
  totalFiles: 5,
  completedFiles: 3,
};

const uploadingProgress: SubmissionProgressState = {
  stage: "uploading",
  stageProgress: 40,
  overallProgress: 29,
  message: "Uploading to IPFS...",
  totalFiles: 5,
  completedFiles: 2,
};

const confirmingProgress: SubmissionProgressState = {
  stage: "confirming",
  stageProgress: 0,
  overallProgress: 50,
  message: "Confirm in your wallet...",
};

const syncingProgress: SubmissionProgressState = {
  stage: "syncing",
  stageProgress: 50,
  overallProgress: 93,
  message: "Syncing with blockchain...",
};

const completeProgress: SubmissionProgressState = {
  stage: "complete",
  stageProgress: 100,
  overallProgress: 100,
  message: "Submission complete!",
};

const errorProgress: SubmissionProgressState = {
  stage: "error",
  stageProgress: 0,
  overallProgress: 29,
  message: "Upload failed: network timeout",
  error: "Upload failed: network timeout after 30s",
};

const meta: Meta<typeof SubmissionProgress> = {
  title: "Progress/SubmissionProgress",
  component: SubmissionProgress,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Multi-stage progress indicator for work submissions. Shows current stage, overall progress bar, and stage-specific details. Supports compact (single line) and full (stepper) modes.",
      },
    },
  },
  argTypes: {
    progress: {
      control: false,
      description: "Current progress state from useSubmissionProgress",
    },
    compact: {
      control: "boolean",
      description: "Whether to show compact version (single line)",
    },
    className: {
      control: "text",
      description: "Additional CSS classes",
    },
  },
};

export default meta;
type Story = StoryObj<typeof SubmissionProgress>;

export const Idle: Story = {
  args: {
    progress: idleProgress,
  },
  parameters: {
    docs: {
      description: {
        story: "Returns null in idle state (nothing to show).",
      },
    },
  },
};

export const Compressing: Story = {
  args: {
    progress: compressingProgress,
  },
};

export const Uploading: Story = {
  args: {
    progress: uploadingProgress,
  },
};

export const Confirming: Story = {
  args: {
    progress: confirmingProgress,
  },
};

export const Syncing: Story = {
  args: {
    progress: syncingProgress,
  },
};

export const Complete: Story = {
  args: {
    progress: completeProgress,
  },
};

export const Error: Story = {
  args: {
    progress: errorProgress,
  },
};

export const CompactCompressing: Story = {
  args: {
    progress: compressingProgress,
    compact: true,
  },
};

export const CompactComplete: Story = {
  args: {
    progress: completeProgress,
    compact: true,
  },
};

export const CompactError: Story = {
  args: {
    progress: errorProgress,
    compact: true,
  },
};

export const Gallery: Story = {
  render: () => (
    <div className="flex flex-col gap-6 max-w-lg">
      <div>
        <p className="text-xs text-text-soft-400 mb-2">Compressing (3/5 files)</p>
        <SubmissionProgress progress={compressingProgress} />
      </div>
      <div>
        <p className="text-xs text-text-soft-400 mb-2">Uploading (2/5 files)</p>
        <SubmissionProgress progress={uploadingProgress} />
      </div>
      <div>
        <p className="text-xs text-text-soft-400 mb-2">Confirming in wallet</p>
        <SubmissionProgress progress={confirmingProgress} />
      </div>
      <div>
        <p className="text-xs text-text-soft-400 mb-2">Syncing</p>
        <SubmissionProgress progress={syncingProgress} />
      </div>
      <div>
        <p className="text-xs text-text-soft-400 mb-2">Complete</p>
        <SubmissionProgress progress={completeProgress} />
      </div>
      <div>
        <p className="text-xs text-text-soft-400 mb-2">Error</p>
        <SubmissionProgress progress={errorProgress} />
      </div>
      <hr className="border-stroke-soft-200" />
      <div>
        <p className="text-xs text-text-soft-400 mb-2">Compact variants</p>
        <div className="flex flex-col gap-2">
          <SubmissionProgress progress={compressingProgress} compact />
          <SubmissionProgress progress={uploadingProgress} compact />
          <SubmissionProgress progress={completeProgress} compact />
          <SubmissionProgress progress={errorProgress} compact />
        </div>
      </div>
    </div>
  ),
};

export const DarkMode: Story = {
  args: {
    progress: uploadingProgress,
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
      <SubmissionProgress progress={compressingProgress} />
      <SubmissionProgress progress={confirmingProgress} />
      <SubmissionProgress progress={completeProgress} />
      <SubmissionProgress progress={errorProgress} />
    </div>
  ),
};

export const Interactive: Story = {
  args: {
    progress: uploadingProgress,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify the overall progress bar is rendered
    const progressBars = canvas.getAllByRole("progressbar");
    expect(progressBars.length).toBeGreaterThan(0);

    // Verify the stage message is displayed
    expect(canvas.getByText("Uploading to IPFS...")).toBeInTheDocument();

    // Verify file count is displayed
    expect(canvas.getByText("2/5 files")).toBeInTheDocument();
  },
};
