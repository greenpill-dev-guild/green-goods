import type { Address } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { EnsAddressText, EnsAddressWithCopy } from "./EnsAddressText";

const RIVER_ADDRESS = "0x1234567890123456789012345678901234567890" as Address;
const MEADOW_ADDRESS = "0x2345678901234567890123456789012345678901" as Address;

function EnsAddressTextHarness() {
  return (
    <div className="space-y-4 rounded-lg border border-stroke-soft bg-bg-white p-4 text-sm text-text-strong">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-text-soft">
          Resolved display
        </p>
        <EnsAddressText address={RIVER_ADDRESS} fallbackName="river" />
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-text-soft">
          Copyable display
        </p>
        <EnsAddressWithCopy address={MEADOW_ADDRESS} fallbackName="meadow" />
      </div>
    </div>
  );
}

const meta: Meta<typeof EnsAddressTextHarness> = {
  title: "Admin/Components/EnsAddressText",
  component: EnsAddressTextHarness,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Admin helper for address labels that prefers an ENS-readable name and falls back to the shortened address. The story uses deterministic fallback names so it does not depend on live RPC availability.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-sm p-6">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof EnsAddressTextHarness>;

export const Default: Story = {};
