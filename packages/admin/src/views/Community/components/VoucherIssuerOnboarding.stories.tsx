import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { withSeededQueryClient } from "../../../../../shared/.storybook/decorators";
import { VoucherIssuerCard } from "./VoucherIssuerOnboarding";
import {
  type VoucherIssuerStory,
  voucherIssuerStory,
  voucherIssuerStoryRoute,
} from "./voucherIssuerStoryFixtures";

const catalog = voucherIssuerStory("issuers").routes[0]!;
const ownerSafe = catalog.pool.limiter.owner;
const sourceSafe = catalog.adapterSource.owner;

/**
 * The Voucher Issuers card in the protocol garden's Community, Coordination (PRD-1299
 * `SIssuers`): drafts, waiting for the member, the member's signed approval, owner Safe drafts,
 * listed and delisted issuers. Fictional data; copying is off in rehearsal. Switch the toolbar's
 * Language for Spanish and Portuguese.
 */
const meta: Meta<typeof VoucherIssuerCard> = {
  title: "Admin/Community/VoucherIssuerOnboarding",
  component: VoucherIssuerCard,
  tags: ["autodocs"],
  args: { canPrepare: true, rehearsal: true, onSend: fn(), onRemind: fn() },
  decorators: [
    (Story) => (
      <div className="max-w-xl p-4" data-tone="community">
        <Story />
      </div>
    ),
    withSeededQueryClient([
      [
        queryKeys.commitmentPooling.issuerSafeThreshold(100, ownerSafe),
        { safe: ownerSafe, status: "observed", threshold: 2, owners: 5 },
      ],
      [
        queryKeys.commitmentPooling.issuerSafeThreshold(42161, sourceSafe),
        { safe: sourceSafe, status: "observed", threshold: 3, owners: 4 },
      ],
    ]),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

const state = (name: VoucherIssuerStory) => voucherIssuerStory(name);
/** Plays click an act by its marker, so they run in every language. */
const open =
  (act: string): Story["play"] =>
  async ({ canvasElement }) => {
    await userEvent.click(canvasElement.querySelector<HTMLElement>(`[data-act="${act}"]`)!);
    await expect(
      await within(canvasElement.ownerDocument.body).findByRole("dialog")
    ).toBeInTheDocument();
  };

/** Two gardens and Maya listed; Teo's draft waits for his own approval. */
export const Issuers: Story = { args: state("issuers") };
export const PrepareDraft: Story = { args: state("prepareDraft"), play: open("prepare") };
export const AwaitingTeo: Story = { args: state("awaitingTeo"), play: open("awaiting") };
export const ApprovedByTeo: Story = { args: state("approved"), play: open("approval") };
export const OwnerSafeDrafts: Story = {
  args: state("ownerSafeDrafts"),
  play: open("drafts"),
};
/** Teo's token is registered and waits for its cap: setup still pending, not delisted. */
export const RegisteredAwaitingCap: Story = { args: state("registered") };
export const Listed: Story = { args: state("listed") };
export const Delist: Story = { args: state("delist"), play: open("delist") };
export const Delisted: Story = { args: state("delisted") };
export const AwaitingLiveInputs: Story = { args: { rehearsal: false } };
export const ReadOnly: Story = { args: { ...state("issuers"), canPrepare: false } };
const incomplete = voucherIssuerStoryRoute();
incomplete.assets[0]!.service.capacity = null;
export const UnconfirmedCapacity: Story = { args: { routes: [incomplete] } };
