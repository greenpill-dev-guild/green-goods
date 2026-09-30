import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "storybook/test";
import { Button } from "./Button";
import { Alert } from "./Alert";

const meta: Meta<typeof Alert> = {
  title: "Shared/Feedback/Alert",
  component: Alert,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["error", "warning", "info", "success"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Alert>;

export const Info: Story = {
  args: {
    variant: "info",
    title: "Indexer sync delayed",
    children: "Recent blocks are still processing. Data may lag for a few minutes.",
  },
};

export const Warning: Story = {
  args: {
    variant: "warning",
    title: "Open minting disabled",
    children: "Create garden remains hidden until deployment registry permissions are available.",
  },
};

export const Error: Story = {
  args: {
    variant: "error",
    title: "Indexer unavailable",
    children: "Failed to load the latest garden data. Retry after connectivity is restored.",
  },
};

export const Success: Story = {
  args: {
    variant: "success",
    title: "Deployment completed",
    children: "Contracts were published and the registry has been updated.",
  },
};

export const Dismissible: Story = {
  args: {
    variant: "warning",
    title: "Review recommended",
    children: "This workspace still has pending submissions.",
    onDismiss: fn(),
  },
};

export const WithAction: Story = {
  args: {
    variant: "info",
    title: "Treasury data refreshed",
    children: "Re-run the reconciliation flow if the balances still look stale.",
    action: (
      <Button size="sm" emphasis="secondary">
        Refresh
      </Button>
    ),
  },
};

/**
 * The stacked layout: the icon and title share a line, and the body and action
 * run the full width below. The body keeps two lines, so notices that replace
 * each other on a page (saved, not sent, may already be sent) share one height.
 */
export const StackedNotices: Story = {
  tags: ["storybook-ci"],
  render: () => (
    <div className="flex w-[360px] max-w-full flex-col gap-3">
      <Alert variant="warning" layout="stacked" title="Saved on this phone, not sent">
        It sends when you're connected.
      </Alert>
      <Alert
        variant="error"
        layout="stacked"
        title="The send gave up"
        action={
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" emphasis="secondary">
              Discard
            </Button>
            <Button size="sm">Try Again</Button>
          </div>
        }
      >
        It stopped after several tries. Nothing else is affected.
      </Alert>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const saved = canvas.getByRole("status");
    const failed = canvas.getByRole("alert");
    const center = (element: Element) => {
      const box = element.getBoundingClientRect();
      return box.top + box.height / 2;
    };
    // The icon sits on the title's line.
    for (const notice of [saved, failed]) {
      const title = within(notice).getByText(/Saved on this phone|The send gave up/);
      const icon = notice.querySelector("svg");
      await expect(icon).not.toBeNull();
      await expect(Math.abs(center(icon as Element) - center(title))).toBeLessThanOrEqual(1);
    }
    // A one-line body still takes two lines.
    const body = within(saved).getByText("It sends when you're connected.");
    const lineHeight = Number.parseFloat(getComputedStyle(body).lineHeight);
    await expect(body.getBoundingClientRect().height).toBe(lineHeight * 2);
  },
};
