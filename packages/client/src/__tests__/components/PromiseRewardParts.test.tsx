/**
 * Where a kept promise's USDC part stands, row by row, as its reader sees it: the
 * paying steward's own share stays theirs, and nothing reads as paid or owed until
 * the plan and payer reads have answered.
 */

import type { RewardLeg, RewardShareState } from "@green-goods/shared/commitment-pooling";
import type { Address } from "@green-goods/shared/types/domain";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../test-utils";

const mocks = vi.hoisted(() => ({
  shares: [] as RewardShareState[],
  isReading: false,
}));

vi.mock("@green-goods/shared/commitment-pooling", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@green-goods/shared/commitment-pooling")>()),
  usePromiseRewardShares: () => ({
    shares: mocks.shares,
    isReading: mocks.isReading,
    readFailed: false,
  }),
  useRewardShareTransaction: () => ({ data: undefined }),
}));

const { PromiseRewardParts } = await import("../../components/Features/Commitments/PromiseReward");

const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as Address;
const STEWARD = "0x1111111111111111111111111111111111111111" as Address;
const GARDENER = "0x2222222222222222222222222222222222222222" as Address;
const LEG: RewardLeg = {
  rail: "steward-wallet",
  chainId: 42161,
  token: USDC,
  symbol: "USDC",
  decimals: 6,
  amount: 20_000_000n,
  usdCentsAsSet: 2_000n,
};
const share = (recipient: Address, amount: bigint, paidBy: Address | null | undefined) =>
  ({
    promiseChainId: 42161,
    promiseModule: "0x6BB5b0fd70b6771B0E955Fef37f8Bd2ce911470a",
    commitmentId: 19n,
    token: USDC,
    recipient,
    amount,
    shareId: `0x${recipient.slice(2).padEnd(64, "0")}`,
    paidBy,
  }) as RewardShareState;

describe("PromiseRewardParts", () => {
  it.each([
    {
      reader: "the steward, after paying everyone else",
      viewer: STEWARD,
      shares: [share(STEWARD, 12_000_000n, null), share(GARDENER, 8_000_000n, STEWARD)],
      isReading: false,
      text: "12 USDC on Arbitrum One, your own share",
    },
    {
      reader: "the gardener the steward paid",
      viewer: GARDENER,
      shares: [share(STEWARD, 12_000_000n, null), share(GARDENER, 8_000_000n, STEWARD)],
      isReading: false,
      text: "8 USDC on Arbitrum One, paid",
    },
    {
      reader: "anyone else, once every share is settled",
      viewer: null,
      shares: [share(STEWARD, 12_000_000n, null), share(GARDENER, 8_000_000n, STEWARD)],
      isReading: false,
      text: "20 USDC on Arbitrum One, paid",
    },
    {
      // A read paused offline is neither loading nor failed, and still says nothing.
      reader: "the gardener, while a read hasn't answered",
      viewer: GARDENER,
      shares: [],
      isReading: true,
      text: "20 USDC on Arbitrum One",
    },
  ])("reads the USDC part for $reader", ({ viewer, shares, isReading, text }) => {
    mocks.shares = shares;
    mocks.isReading = isReading;
    renderWithProviders(
      <PromiseRewardParts
        reward={{ wei: 0n, centsAsSet: null, others: [LEG] }}
        chainId={42161}
        commitmentId={19n}
        viewer={viewer}
        stewards={[STEWARD]}
        payout="paid"
      />
    );
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  // The reward's one line leaves where it stands to the part rows, so the G$ row says it too.
  it.each([
    { payout: "paid" as const, text: "160,000 G$ on Celo, paid" },
    { payout: "notPaidYet" as const, text: "160,000 G$ on Celo, not paid yet" },
  ])("says whether the G$ part is $payout", ({ payout, text }) => {
    mocks.shares = [];
    mocks.isReading = false;
    renderWithProviders(
      <PromiseRewardParts
        reward={{ wei: 160_000n * 10n ** 18n, centsAsSet: null, others: [LEG] }}
        chainId={42161}
        commitmentId={19n}
        viewer={null}
        stewards={[STEWARD]}
        payout={payout}
      />
    );
    expect(screen.getByText(text)).toBeInTheDocument();
  });
});
