import { useVoucherAwards } from "@green-goods/shared/commitment-pooling";
import { Button } from "@green-goods/shared/components/Button";
import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import { useGreenGoodsEnsName } from "@green-goods/shared/hooks/ens/useGreenGoodsEnsName";
import { useResolvedProfileAvatar } from "@green-goods/shared/hooks/profile/useProfileAvatar";
import type { VoucherAwardRecord } from "@green-goods/shared/public-contracts/voucher-awards";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { mocked } from "storybook/test";
import {
  type JourneyStepNote,
  useJourneyEmbed,
} from "../../../../../shared/.storybook/journeyPlayer";
import { resetHookMocks } from "../../../../../shared/.storybook/moduleMocks";
import { voucherWalletStory } from "../../../../../shared/.storybook/voucherPilotFixtures";
import { VouchersTab } from "@/views/Home/WalletSheet/VouchersTab";
import { ServiceIssuerOnboarding } from "@/views/Profile/ServiceIssuerOnboarding";
import {
  ISSUER_STORY_HASH,
  ISSUER_STORY_NAMES,
  type IssuerServiceStory,
  issuerServiceStory,
  issuerStoryAssets,
  issuerStoryDraftRecord,
  issuerStoryReview,
} from "@/views/Profile/serviceIssuerStoryFixtures";
import { ServiceIssuerPanel } from "./ServiceIssuerPanel";

/** One step: the member's draft, their service's panel, or the wallet their award lands in. */
interface IssuerStep extends JourneyStepNote {
  draft?: "review" | "approved";
  panel?: IssuerServiceStory;
  wallet?: true;
  /** Where the member's own act on this screen leads. */
  act?: number;
}

export const ISSUER_STEPS: readonly IssuerStep[] = [
  {
    caption:
      "In Profile, Your Services, a draft from your steward waits. Review what you would promise, then approve it from your own account.",
    draft: "review",
    act: 1,
  },
  {
    caption:
      "Approved. Nothing a steward does stands in for this. The owner Safe lists your token next.",
    draft: "approved",
    next: "The Safe registers the token",
  },
  {
    caption:
      "Registered. Your token waits for its cap in the exchange pool; that is setup, not a delisting.",
    panel: "registered",
    next: "The Safe sets the cap",
  },
  {
    caption: "Listed. Your service shows what you promised, what is booked and what is left.",
    panel: "overview",
    next: "Maya asks to book",
  },
  {
    caption: "Maya asked to book. Only you approve bookings of your own service.",
    panel: "approve",
    act: 5,
  },
  {
    caption: "Approved from your account. Maya can deposit, and a steward accepts in the Hub.",
    panel: "overview",
    next: "A garden awards you vouchers",
  },
  {
    caption:
      "A garden awarded you 2 vouchers for past work. The wallet's Vouchers tab lists the award under your holdings.",
    wallet: true,
  },
];

/** A confirmed award as the wallet reads it. Synthetic accounts; never a live record. */
const AWARD: VoucherAwardRecord = {
  version: 1,
  award: {
    awardId: "fictional-past-design",
    reserve: "0x1111111111111111111111111111111111111111",
    token: "0x2222222222222222222222222222222222222222",
    recipient: "0x3333333333333333333333333333333333333333",
    amount: "2000000",
    reason: "Design work completed before vouchers",
    reference: "Fictional contribution 7",
  },
  safe: {
    safe: "0x1111111111111111111111111111111111111111",
    chainId: 100,
    to: "0x2222222222222222222222222222222222222222",
    value: "0",
    data: "0x",
    operation: 0,
    safeTxGas: "0",
    baseGas: "0",
    gasPrice: "0",
    gasToken: "0x0000000000000000000000000000000000000000",
    refundReceiver: "0x0000000000000000000000000000000000000000",
    nonce: "3",
    safeTxHash: ISSUER_STORY_HASH,
    threshold: 1,
  },
  state: "confirmed",
  transactionHash: ISSUER_STORY_HASH,
  failure: null,
  createdBy: "0x4444444444444444444444444444444444444444",
  createdAt: "2026-11-07T00:00:00Z",
  updatedAt: "2026-11-07T00:00:00Z",
  revision: 2,
};

/**
 * A member's side of becoming an issuer, on the real Profile and wallet components: approve the
 * draft, watch setup finish, approve a booking, and find an award. The member's own acts move
 * the walk on; the band plays everyone else. Fictional data; nothing is signed or sent.
 */
function ServiceIssuerJourney({ start }: { start: number }) {
  const count = ISSUER_STEPS.length;
  const [index, setIndex] = useState(Math.min(start, count - 1));
  useEffect(() => setIndex(Math.min(start, count - 1)), [start, count]);
  const embedded = useJourneyEmbed(index, count, setIndex);
  const step = ISSUER_STEPS[index]!;
  const act = () => {
    if (step.act !== undefined) setIndex(step.act);
  };
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
  mocked(useVoucherAwards).mockReturnValue({
    records: [AWARD],
    load: { mutate: () => undefined, isPending: false, isError: false, isSuccess: true },
    isLimited: false,
  } as unknown as ReturnType<typeof useVoucherAwards>);
  return (
    <div className="flex min-h-dvh flex-col bg-bg-white-0 text-text-strong-950">
      {embedded ? null : (
        <div className="sticky top-0 z-50 border-b border-stroke-soft-200 bg-bg-weak-50 p-3 text-xs">
          <p className="font-semibold text-text-sub-600">
            Step {index + 1} of {count}
          </p>
          <p className="mt-0.5 text-sm text-text-strong-950">{step.caption}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              size="compact"
              emphasis="secondary"
              disabled={index === 0}
              onClick={() => setIndex(index - 1)}
            >
              Back
            </Button>
            {step.next ? (
              <Button type="button" size="compact" onClick={() => setIndex(index + 1)}>
                {step.next}
              </Button>
            ) : null}
          </div>
        </div>
      )}
      <MemoryRouter initialEntries={["/home/profile"]}>
        {step.wallet ? (
          <div className="flex h-dvh flex-col overflow-hidden">
            <VouchersTab
              wallet={{ ...voucherWalletStory("vouchers"), evidence: "onchain" }}
              onClose={() => undefined}
            />
          </div>
        ) : (
          <div className="mx-auto w-full max-w-lg p-4">
            {step.draft ? (
              <ServiceIssuerOnboarding
                record={issuerStoryDraftRecord(step.draft)}
                canSign
                approving={false}
                onApprove={async () => act()}
                onAskForChanges={() => undefined}
                onDecline={() => undefined}
              />
            ) : (
              <ServiceIssuerPanel
                key={index}
                snapshot={issuerServiceStory(step.panel ?? "overview")}
                assets={issuerStoryAssets}
                poolName="Fictional local exchange"
                onRefresh={async () => undefined}
                onReview={async (action) => issuerStoryReview(action)}
                onExecute={async () => {
                  act();
                  return {
                    status: "confirmed",
                    transactionHash: ISSUER_STORY_HASH,
                    currentStateMatchesReceipt: true,
                  };
                }}
                onReconcile={async () => null}
                onQuote={async ({ outputAssetId, amount }) => ({
                  outputAssetId,
                  amount,
                  poolId: "fictional-local",
                  poolAddress: "0x7777777777777777777777777777777777777777" as const,
                  quotedOutput: amount * 2n,
                  grossOutput: amount * 2n,
                  reservedOutputFees: 0n,
                  observedAt: 1_900_000_000n,
                  expiresAt: 1_900_000_300n,
                })}
              />
            )}
          </div>
        )}
      </MemoryRouter>
    </div>
  );
}

const meta: Meta<typeof ServiceIssuerJourney> = {
  title: "Client/Profile/Service Issuer Journey",
  component: ServiceIssuerJourney,
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile" } },
  excludeStories: ["ISSUER_STEPS"],
  beforeEach: () =>
    resetHookMocks(useGreenGoodsEnsName, useEnsName, useResolvedProfileAvatar, useVoucherAwards),
  argTypes: { start: { control: { type: "number", min: 0 } } },
  args: { start: 0 },
};
export default meta;
type Story = StoryObj<typeof ServiceIssuerJourney>;

/** Setup and awards from the member's side: draft, setup, a booking to approve, an award. */
export const SetupAndAwards: Story = {};
