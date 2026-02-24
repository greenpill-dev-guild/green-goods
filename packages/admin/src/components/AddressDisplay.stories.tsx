import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import type { Address } from "@green-goods/shared";
import { AddressDisplay } from "./AddressDisplay";

const SAMPLE_ADDRESSES = {
  vitalik: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as Address,
  zero: "0x0000000000000000000000000000000000000000" as Address,
  short: "0xAbCdEf0123456789AbCdEf0123456789AbCdEf01" as Address,
  deployer: "0x1234567890123456789012345678901234567890" as Address,
};

const meta: Meta<typeof AddressDisplay> = {
  title: "Admin/UI/AddressDisplay",
  component: AddressDisplay,
  tags: ["autodocs"],
  argTypes: {
    address: {
      control: "text",
      description: "Ethereum address to display (checksummed hex string)",
    },
    showCopyButton: {
      control: "boolean",
      description: "Whether to show the copy-to-clipboard button",
    },
    className: {
      control: "text",
      description: "Additional CSS classes for the root container",
    },
  },
};

export default meta;
type Story = StoryObj<typeof AddressDisplay>;

export const Default: Story = {
  args: {
    address: SAMPLE_ADDRESSES.vitalik,
  },
};

export const WithoutCopyButton: Story = {
  args: {
    address: SAMPLE_ADDRESSES.vitalik,
    showCopyButton: false,
  },
};

export const ZeroAddress: Story = {
  args: {
    address: SAMPLE_ADDRESSES.zero,
  },
};

export const Gallery: Story = {
  render: () => (
    <div className="space-y-6">
      <section>
        <h3 className="mb-3 text-sm font-medium text-text-sub">With Copy Button (default)</h3>
        <div className="space-y-3">
          <AddressDisplay address={SAMPLE_ADDRESSES.vitalik} />
          <AddressDisplay address={SAMPLE_ADDRESSES.deployer} />
          <AddressDisplay address={SAMPLE_ADDRESSES.short} />
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-medium text-text-sub">Without Copy Button</h3>
        <div className="space-y-3">
          <AddressDisplay address={SAMPLE_ADDRESSES.vitalik} showCopyButton={false} />
          <AddressDisplay address={SAMPLE_ADDRESSES.zero} showCopyButton={false} />
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-medium text-text-sub">Zero Address</h3>
        <AddressDisplay address={SAMPLE_ADDRESSES.zero} />
      </section>

      <section>
        <h3 className="mb-3 text-sm font-medium text-text-sub">In Context (table row)</h3>
        <div className="rounded-lg border border-stroke-soft">
          <div className="flex items-center justify-between px-4 py-3 border-b border-stroke-soft">
            <span className="text-sm text-text-sub">Operator</span>
            <AddressDisplay address={SAMPLE_ADDRESSES.vitalik} />
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-b border-stroke-soft">
            <span className="text-sm text-text-sub">Gardener</span>
            <AddressDisplay address={SAMPLE_ADDRESSES.deployer} />
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-text-sub">Endowments</span>
            <AddressDisplay address={SAMPLE_ADDRESSES.short} />
          </div>
        </div>
      </section>
    </div>
  ),
};

export const Interactive: Story = {
  args: {
    address: SAMPLE_ADDRESSES.vitalik,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Find the copy button by its title
    const copyButton = canvas.getByTitle("Copy address");
    await expect(copyButton).toBeVisible();

    // Click the copy button — the icon should swap to a checkmark
    await userEvent.click(copyButton);

    // After click, the check icon should appear (RiCheckLine)
    const checkIcon = canvasElement.querySelector(".text-success-dark");
    await expect(checkIcon).toBeTruthy();
  },
};

export const DarkMode: Story = {
  args: {
    address: SAMPLE_ADDRESSES.vitalik,
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
  render: () => (
    <div className="space-y-4">
      <AddressDisplay address={SAMPLE_ADDRESSES.vitalik} />
      <AddressDisplay address={SAMPLE_ADDRESSES.deployer} />
      <AddressDisplay address={SAMPLE_ADDRESSES.zero} showCopyButton={false} />
    </div>
  ),
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4">
        <Story />
      </div>
    ),
  ],
};
