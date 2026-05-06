import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { CanvasIndexerErrorState } from "./CanvasIndexerErrorState";

const meta: Meta<typeof CanvasIndexerErrorState> = {
  title: "Admin/Shell/CanvasIndexerErrorState",
  component: CanvasIndexerErrorState,
  tags: ["autodocs"],
  decorators: [
    withCanvasFrame({
      className: "flex items-center justify-center p-6",
      heightClassName: "min-h-[440px]",
      workspace: "garden",
    }),
  ],
  args: {
    onRetry: fn(),
  },
  argTypes: {
    onRetry: {
      description: "Called when the retry CTA is pressed.",
    },
  },
  parameters: {
    docs: {
      description: {
        component: [
          "**CanvasIndexerErrorState** — terminal state shown when",
          "`useEligibleAdminGardens.isError` is true and the role-confirmed",
          "cross-check produces no fallback gardens. Distinct from",
          "`CanvasGardenAccessState` (which says 'you don't have access yet') —",
          "this copy says 'we can't tell yet, the indexer is unreachable'.",
          "",
          "**Accessibility**: heading-first content order, Retry CTA is the",
          "primary action and reachable via Tab.",
        ].join("\n"),
      },
    },
    a11y: {
      config: {
        rules: [
          { id: "heading-order", enabled: true },
          { id: "button-name", enabled: true },
          { id: "color-contrast", enabled: true },
        ],
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof CanvasIndexerErrorState>;

/** Default — indexer unreachable, primary CTA is "Try again". */
export const IndexerUnavailable: Story = {};

/**
 * Retry interaction — verifies the CTA fires `onRetry` on click. Useful for
 * agents writing flows that gate behind indexer recovery.
 */
export const RetryInteraction: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const retry = await canvas.findByRole("button", { name: /try again/i });
    await userEvent.click(retry);
    await expect(args.onRetry).toHaveBeenCalledTimes(1);
  },
};

/**
 * Tone variants — same indexer-error state under each `[data-tone]` scope so
 * reviewers can confirm the tone-tinted hairline + canvas wash inherits
 * correctly when the error mounts inside any workspace.
 */
export const ToneMatrix: Story = {
  decorators: [],
  render: (args) => (
    <div className="grid gap-4 p-4 md:grid-cols-2">
      {(["hub", "garden", "community", "actions"] as const).map((tone) => (
        <div
          key={tone}
          data-tone={tone}
          className="rounded-2xl border border-stroke-soft bg-bg-white-0 p-6"
        >
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-soft">
            [data-tone="{tone}"]
          </div>
          <CanvasIndexerErrorState {...args} />
        </div>
      ))}
    </div>
  ),
};
