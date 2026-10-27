import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import { useGreenGoodsEnsName } from "@green-goods/shared/hooks/ens/useGreenGoodsEnsName";
import { useResolvedProfileAvatar } from "@green-goods/shared/hooks/profile/useProfileAvatar";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, mocked, userEvent, within } from "storybook/test";
import { resetHookMocks } from "../../../../shared/.storybook/moduleMocks";
import { ServiceIssuerPanel } from "./ServiceIssuerPanel";
import {
  ISSUER_STORY_HASH,
  ISSUER_STORY_NAMES,
  issuerServiceStory,
  issuerStoryAssets,
  issuerStoryReview,
  issuerStorySnapshot,
} from "./serviceIssuerStoryFixtures";

/**
 * A member's own service in Profile, Account, Service Assets (PRD-1299 `SMyService`): the
 * status band, what they can still deliver, where their vouchers are, bookings as person rows
 * and the member's named acts. Switch the toolbar's Language for Spanish and Portuguese.
 */
const meta: Meta<typeof ServiceIssuerPanel> = {
  title: "Client/Profile/ServiceIssuerPanel",
  component: ServiceIssuerPanel,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  beforeEach: () => {
    mocked(useGreenGoodsEnsName).mockImplementation(
      (address) =>
        ({
          data: address ? (ISSUER_STORY_NAMES[address.toLowerCase()] ?? null) : null,
        }) as ReturnType<typeof useGreenGoodsEnsName>
    );
    mocked(useEnsName).mockReturnValue({ data: null } as ReturnType<typeof useEnsName>);
    mocked(useResolvedProfileAvatar).mockReturnValue({
      avatarUri: null,
      isLoading: false,
    } as ReturnType<typeof useResolvedProfileAvatar>);
    return resetHookMocks(useGreenGoodsEnsName, useEnsName, useResolvedProfileAvatar);
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-lg space-y-4">
        <p className="text-xs text-text-sub-600">
          Fictional Storybook data. No transactions are sent.
        </p>
        <Story />
      </div>
    ),
  ],
  args: {
    snapshot: issuerServiceStory("overview"),
    assets: issuerStoryAssets,
    onRefresh: fn().mockResolvedValue(undefined),
    onReview: fn(async (action) => issuerStoryReview(action)),
    onExecute: fn().mockResolvedValue({
      status: "confirmed",
      transactionHash: ISSUER_STORY_HASH,
      currentStateMatchesReceipt: true,
    }),
    onReconcile: fn().mockResolvedValue(null),
    onQuote: fn(async ({ outputAssetId, amount }) => ({
      outputAssetId,
      amount,
      quotedOutput: amount * 2n,
      grossOutput: amount * 2n,
      reservedOutputFees: 0n,
      observedAt: 1_900_000_000n,
      expiresAt: 1_900_000_300n,
    })),
  },
};
export default meta;
type Story = StoryObj<typeof ServiceIssuerPanel>;

/** Plays click an act by its marker, so they run in every language. */
const open =
  (act: string): Story["play"] =>
  async ({ canvasElement }) => {
    await userEvent.click(canvasElement.querySelector<HTMLElement>(`[data-act="${act}"]`)!);
    await expect(
      await within(canvasElement.ownerDocument.body).findByRole("dialog")
    ).toBeInTheDocument();
  };

/** Listed, nothing waiting: six promised, two booked, one delivered, three left. */
export const Overview: Story = {};
export const ApproveBooking: Story = {
  args: { snapshot: issuerServiceStory("approve") },
  play: open("approve"),
};
export const ProposeReturn: Story = { play: open("propose") };
export const ReturnProposed: Story = { args: { snapshot: issuerServiceStory("proposed") } };
export const IssueMore: Story = { play: open("issue") };
export const CapacityFull: Story = {
  args: { snapshot: issuerServiceStory("full") },
  play: open("issue"),
};
/** Capacity counts what the member confirmed (five), not the six the token may issue. */
export const CapacityBelowIssuance: Story = {
  args: { snapshot: issuerServiceStory("lowCapacity") },
};
/** A booking failed verification: what's booked and left stays unknown. */
export const PartialBookings: Story = { args: { snapshot: issuerServiceStory("partial") } };
export const PauseNewBookings: Story = { play: open("pause") };
/** Paused with a booking asked: it waits for the member to resume, with nothing to approve. */
export const Paused: Story = { args: { snapshot: issuerServiceStory("paused") } };
export const Delisted: Story = { args: { snapshot: issuerServiceStory("delisted") } };
export const PendingTransaction: Story = { args: { snapshot: issuerServiceStory("pending") } };
export const ReserveShort: Story = { args: { snapshot: issuerServiceStory("short") } };
export const YourSetup: Story = { args: { snapshot: issuerServiceStory("setup") } };
export const AwaitingAdmission: Story = { args: { snapshot: issuerServiceStory("admitting") } };
/** Registered before its cap lands: the pool's zero limit is setup, not a delisting. */
export const RegisteredAwaitingCap: Story = {
  args: { snapshot: issuerServiceStory("registered") },
};
/** Someone holding another member's vouchers: holdings and the exchange, no issuer acts. */
export const Holder: Story = {
  args: {
    snapshot: {
      ...issuerStorySnapshot(),
      actor: {
        ...issuerStorySnapshot().actor,
        address: "0x6666666666666666666666666666666666666666",
      },
      holdingBalance: 500_000n,
    },
  },
};
export const Unconfigured: Story = {
  args: { snapshot: { evidence: "unavailable", reason: "unconfigured" } },
};
export const Loading: Story = { args: { snapshot: undefined, isLoading: true } };
export const ReadError: Story = { args: { snapshot: undefined, isError: true } };
