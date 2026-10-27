import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { withSeededQueryClient } from "../../../../../shared/.storybook/decorators";
import { VoucherIssuerDialog } from "./VoucherIssuerDialogs";
import { voucherIssuerRows } from "./voucherIssuerRows";
import { type VoucherIssuerStory, voucherIssuerStory } from "./voucherIssuerStoryFixtures";

/** The Voucher Issuers card's row for one fictional issuer in one state. */
function row(state: VoucherIssuerStory, key: string) {
  const story = voucherIssuerStory(state);
  return voucherIssuerRows(story.routes, story.drafts, story.listings).find((r) => r.key === key)!;
}
const route = voucherIssuerStory("issuers").routes[0]!;
const teo = `${route.service.id}:teo`;
const maya = `${route.service.id}:maya`;

/**
 * Each dialog the Voucher Issuers card opens, on its own (PRD-1299 `SIssuers`). Copying sends
 * nothing and says so; delisting is one zero-limit owner Safe call that keeps every holding,
 * booking and obligation. Fictional data.
 */
const meta: Meta<typeof VoucherIssuerDialog> = {
  title: "Admin/Community/VoucherIssuerDialogs",
  component: VoucherIssuerDialog,
  tags: ["autodocs"],
  args: { canPrepare: true, rehearsal: false, onClose: fn(), onSend: fn(), onRemind: fn() },
  decorators: [
    withSeededQueryClient([
      [
        queryKeys.commitmentPooling.issuerSafeThreshold(100, route.pool.limiter.owner),
        { safe: route.pool.limiter.owner, status: "observed", threshold: 2, owners: 5 },
      ],
    ]),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const PrepareDraft: Story = {
  args: { row: row("prepareDraft", "draft:7"), kind: "prepare" },
};
export const AwaitingApproval: Story = {
  args: { row: row("awaitingTeo", "draft:7"), kind: "awaiting" },
};
export const SignedApproval: Story = {
  args: { row: row("approved", "draft:7"), kind: "approval" },
};
export const OwnerSafeDrafts: Story = {
  args: { row: row("ownerSafeDrafts", teo), kind: "drafts" },
};
export const Delist: Story = { args: { row: row("delist", maya), kind: "delist" } };
export const ReviewPreparedTerms: Story = { args: { row: row("listed", teo), kind: "review" } };
