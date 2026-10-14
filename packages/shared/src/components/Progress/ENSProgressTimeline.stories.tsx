import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { STORYBOOK_NOW_SECONDS } from "../../../.storybook/fixtures";
import type { ENSRegistrationData } from "../../types/domain";
import { ENSProgressTimeline } from "./ENSProgressTimeline";

const pendingData: ENSRegistrationData = {
  status: "pending",
  ccipMessageId: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  submittedAt: STORYBOOK_NOW_SECONDS * 1000 - 5 * 60_000, // 5 minutes ago
};

const activeData: ENSRegistrationData = {
  status: "active",
  ccipMessageId: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  submittedAt: STORYBOOK_NOW_SECONDS * 1000 - 20 * 60_000,
  registration: {
    owner: "0x1234567890123456789012345678901234567890",
    nameType: 1,
    registeredAt: "1704067200",
  },
};

const timedOutData: ENSRegistrationData = {
  status: "timed_out",
  ccipMessageId: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
  submittedAt: STORYBOOK_NOW_SECONDS * 1000 - 30 * 60_000, // 30 minutes ago
};

const availableData: ENSRegistrationData = {
  status: "available",
};

const meta: Meta<typeof ENSProgressTimeline> = {
  title: "Shared/Progress/ENSProgressTimeline",
  component: ENSProgressTimeline,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Tracks CCIP delivery status for ENS subdomain registrations. Shows submitting, checking, pending, ready, and delayed states. Registration details contain a copyable message ID and explorer link.",
      },
    },
  },
  argTypes: {
    data: {
      control: false,
      description: "Registration data from useENSRegistrationStatus",
    },
    slug: {
      control: "text",
      description: "The slug being registered (e.g. 'my-garden')",
    },
    compact: {
      control: "boolean",
      description: "Compact mode for inline display",
    },
    className: {
      control: "text",
      description: "Additional CSS classes",
    },
  },
};

export default meta;
type Story = StoryObj<typeof ENSProgressTimeline>;

export const Pending: Story = {
  args: {
    data: pendingData,
    slug: "my-garden",
  },
};

export const Active: Story = {
  args: {
    data: activeData,
    slug: "my-garden",
  },
};

export const TimedOut: Story = {
  args: {
    data: timedOutData,
    slug: "my-garden",
  },
};

export const Available: Story = {
  args: {
    data: availableData,
    slug: "my-garden",
  },
  parameters: {
    docs: {
      description: {
        story: "Returns null when status is 'available' (no registration in progress).",
      },
    },
  },
};

export const CompactPending: Story = {
  args: {
    data: pendingData,
    slug: "my-garden",
    compact: true,
  },
};

export const CompactActive: Story = {
  args: {
    data: activeData,
    slug: "my-garden",
    compact: true,
  },
};

export const CompactTimedOut: Story = {
  args: {
    data: timedOutData,
    slug: "my-garden",
    compact: true,
  },
};

export const StateCatalog: Story = {
  render: () => (
    <div className="flex flex-col gap-6 max-w-lg">
      <div>
        <p className="text-xs text-text-soft-400 mb-2">Full - Pending</p>
        <ENSProgressTimeline data={pendingData} slug="solar-farm" />
      </div>
      <div>
        <p className="text-xs text-text-soft-400 mb-2">Full - Active</p>
        <ENSProgressTimeline data={activeData} slug="solar-farm" />
      </div>
      <div>
        <p className="text-xs text-text-soft-400 mb-2">Full - Timed Out</p>
        <ENSProgressTimeline data={timedOutData} slug="solar-farm" />
      </div>
      <hr className="border-stroke-soft-200" />
      <div>
        <p className="text-xs text-text-soft-400 mb-2">Compact variants</p>
        <div className="flex flex-col gap-2">
          <ENSProgressTimeline data={pendingData} slug="solar-farm" compact />
          <ENSProgressTimeline data={activeData} slug="solar-farm" compact />
          <ENSProgressTimeline data={timedOutData} slug="solar-farm" compact />
        </div>
      </div>
    </div>
  ),
};

export const Interactive: Story = {
  args: {
    data: pendingData,
    slug: "my-garden",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify the status container is present
    const statusEl = canvas.getByRole("status");
    expect(statusEl).toBeInTheDocument();

    // Verify the slug is displayed
    expect(canvas.getByText("my-garden.greengoods.eth")).toBeInTheDocument();

    await userEvent.click(canvas.getByText("Registration details"));

    // Verify the CCIP message section exists
    const copyButton = canvas.getByRole("button", { name: /copy ccip/i });
    expect(copyButton).toBeInTheDocument();

    // Click the copy button (clipboard will be mocked in test environment)
    await userEvent.click(copyButton);

    // Verify the explorer link exists
    const explorerLink = canvas.getByRole("link", { name: /track on ccip/i });
    expect(explorerLink).toBeInTheDocument();
    expect(explorerLink).toHaveAttribute("target", "_blank");
  },
};

export const Submitting: Story = {
  args: { data: pendingData, slug: "my-garden", phase: "submitting" },
};
export const Checking: Story = {
  args: { data: pendingData, slug: "my-garden", phase: "checking" },
};
