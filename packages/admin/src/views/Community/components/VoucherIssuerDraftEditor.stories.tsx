import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import type { ServiceIssuerDeskRecord } from "@green-goods/shared/commitment-pooling";
import { VoucherIssuerDraftEditor } from "./VoucherIssuerDraftEditor";
import { voucherIssuerStory } from "./voucherIssuerStoryFixtures";

const fixture = voucherIssuerStory("prepareDraft");
const route = fixture.routes[0]!;
const pool = route.pools[0]!;
const record: ServiceIssuerDeskRecord = {
  ...fixture.drafts[0]!,
  revision: 0,
  createdBy: pool.deployment.owner,
  updatedAt: "2026-10-27T12:00:00Z",
  context: {
    routeId: route.service.id,
    poolId: pool.id,
    garden: pool.garden,
    sourceChainId: route.service.sourceChainId,
    chainId: 100,
  },
};
const meta: Meta<typeof VoucherIssuerDraftEditor> = {
  title: "Admin/Community/VoucherIssuerDraftEditor",
  component: VoucherIssuerDraftEditor,
  tags: ["autodocs"],
  argTypes: {
    route: { control: false },
    pool: { control: false },
    record: { control: false },
  },
  args: {
    route,
    pool,
    record,
    draftId: "fictional-story-draft",
    onClose: fn(),
    onSave: fn(async () => {}),
  },
};
export default meta;
type Story = StoryObj<typeof meta>;
export const ExistingTerms: Story = {
  play: async ({ args, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(page.getByRole("button", { name: "Review Terms" }));
    await expect(args.onSave).not.toHaveBeenCalled();
    await expect(page.getByRole("button", { name: "Save Draft" })).toBeVisible();
    await expect(page.getByText(pool.deployment.address)).toBeVisible();
  },
};
export const NewService: Story = { args: { record: undefined } };
export const Saving: Story = { args: { pending: true } };
export const SaveUnavailable: Story = {
  args: {
    onSave: fn(async () => {
      throw new Error("Fictional unavailable desk");
    }),
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(page.getByRole("button", { name: "Review Terms" }));
    await userEvent.click(page.getByRole("button", { name: "Save Draft" }));
    await expect(page.getByRole("alert")).toBeVisible();
  },
};
