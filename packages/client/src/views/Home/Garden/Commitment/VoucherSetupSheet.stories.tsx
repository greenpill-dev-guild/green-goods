import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { serviceAccessStorySnapshot } from "./serviceAccessStoryFixtures";
import { VoucherSetupSheet } from "./VoucherSetupSheet";

const snapshot = serviceAccessStorySnapshot();
snapshot.consent = {
  revision: 1n,
  requestNonce: 1n,
  termsHash: snapshot.offer!.termsHash,
  claimHash: snapshot.offer!.termsHash,
  buyerGarden: snapshot.eligibleBuyerGardens[0].address,
  voucherHolder: snapshot.key.buyer,
  state: "pending",
};
snapshot.availableActions = ["prepareVoucherSetup"];
const meta: Meta<typeof VoucherSetupSheet> = {
  title: "Client/Commitments/VoucherSetupSheet",
  component: VoucherSetupSheet,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { open: true, snapshot, isPending: false, onOpenChange: fn(), onConfirm: fn() },
};
export default meta;
type Story = StoryObj<typeof VoucherSetupSheet>;
export const PreAcceptanceSetup: Story = {};
