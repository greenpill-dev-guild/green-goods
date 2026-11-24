/**
 * A promise's reward as a member reads it before taking one up: the dollars it
 * was set in while the chain still holds that G$ amount, about today's rate
 * after an edit, else G$; and that it is paid in G$ once the promise is kept.
 */

import type { CommitmentMetadataV1, DueClock } from "@green-goods/shared/commitment-pooling";
import en from "@green-goods/shared/i18n/en";
import type { GoodDollarPriceState } from "@green-goods/shared/modules/wallet/good-dollar-price";
import { createIntl } from "react-intl";
import { describe, expect, it } from "vitest";
import {
  groupRewardsOf,
  promisePayoutOf,
  promiseRewardOf,
  promiseRewardText,
} from "../../components/Features/Commitments/PromiseReward";

const intl = createIntl({ locale: "en", messages: en });
const G = 10n ** 18n;
/** $20.00 set at Create, which became 160,000 G$. */
const SET_WEI = 160_000n * G;
const METADATA: Pick<CommitmentMetadataV1, "reward"> = {
  reward: { version: 1, usdCents: "2000", goodDollarWei: SET_WEI.toString() },
};
/** $0.000125 a G$, so 200,000 G$ is about $25.00. */
const PRICE: GoodDollarPriceState = { status: "ready", price: 125_000_000_000_000n, readAt: 0 };
const NO_PRICE: GoodDollarPriceState = { status: "unavailable", reason: "missing" };

/** The chain's clock the take-up choice reads, in Unix seconds. */
const CLOCK: DueClock = { now: 1_800_000_000n, cycleEndTimes: new Map() };

const onRail = (wei: bigint) =>
  ({ chainId: 42161, considerationRail: "CELO_SETTLEMENT", considerationAmount: wei }) as const;

describe("promise rewards", () => {
  it("reads only a G$ reward with an amount", () => {
    expect(promiseRewardOf(onRail(SET_WEI), METADATA)).toEqual({
      wei: SET_WEI,
      centsAsSet: 2000n,
    });
    expect(
      promiseRewardOf({ chainId: 42161, considerationRail: "NONE", considerationAmount: 0n }, null)
    ).toBeNull();
    expect(promiseRewardOf(onRail(0n), METADATA)).toBeNull();
    expect(
      promiseRewardOf(
        { chainId: 42161, considerationRail: "ARBITRUM_EXTERNAL", considerationAmount: SET_WEI },
        null
      )
    ).toBeNull();
  });

  it("says it is paid in G$ once kept, then whether it has been paid", () => {
    const rewards = [promiseRewardOf(onRail(SET_WEI), METADATA)].filter(
      (reward) => reward !== null
    );
    const line = (
      derivedState: "ACCEPTED" | "FULFILLED" | "RECONCILED",
      considerationPaid = false
    ) =>
      promiseRewardText({
        intl,
        rewards,
        price: NO_PRICE,
        payout: promisePayoutOf({ derivedState, considerationPaid }),
      });

    expect(line("ACCEPTED")).toBe("$20.00, paid in G$ after it's kept");
    // Kept, with the payout still to come: never "after it's kept" on a kept promise.
    expect(line("FULFILLED")).toBe("$20.00, not yet paid in G$");
    expect(line("RECONCILED", true)).toBe("$20.00, paid in G$");
    expect(promiseRewardText({ intl, rewards: [], price: PRICE })).toBeNull();
  });

  it("gives an ended promise's reward as its amount alone", () => {
    const rewards = [promiseRewardOf(onRail(SET_WEI), METADATA)].filter(
      (reward) => reward !== null
    );
    const line = (derivedState: "CANCELLED" | "EXPIRED" | "OFFERED", pastDue = false) =>
      promiseRewardText({
        intl,
        rewards,
        price: NO_PRICE,
        payout: promisePayoutOf({ derivedState, considerationPaid: false }, { pastDue }),
      });

    // A cancelled or expired promise can never be kept, so nothing is paid "after it's kept".
    expect(line("CANCELLED")).toBe("$20.00");
    expect(line("EXPIRED")).toBe("$20.00");
    // Nobody can take up an untaken promise past its due date: the chain lets anyone expire it.
    expect(line("OFFERED", true)).toBe("$20.00");
    expect(line("OFFERED")).toBe("$20.00, paid in G$ after it's kept");
  });

  it("reads an edited reward at about today's rate, or in G$ when there is no rate", () => {
    // An Edit Reward changed the chain's amount, so the dollars set at Create no longer hold.
    const edited = [promiseRewardOf(onRail(200_000n * G), METADATA)].filter(
      (reward) => reward !== null
    );

    expect(edited[0]?.centsAsSet).toBeNull();
    expect(promiseRewardText({ intl, rewards: edited, price: PRICE })).toBe(
      "about $25.00, paid in G$ after it's kept"
    );
    expect(promiseRewardText({ intl, rewards: edited, price: NO_PRICE })).toBe(
      "200,000 G$, paid in G$ after it's kept"
    );
    // A G$ amount is never followed by "in G$".
    expect(
      promiseRewardText({ intl, rewards: edited, price: NO_PRICE, payout: "notPaidYet" })
    ).toBe("200,000 G$, not yet paid in G$");
  });

  it("gives a group the rewards a member could still take up, as a range when they differ", () => {
    const copy = (wei: bigint, onchainState: "REQUESTED" | "ACCEPTED" | "FULFILLED") => ({
      ...onRail(wei),
      onchainState,
      derivedState: onchainState,
      dueDate: null,
      cycleId: null,
    });
    // An Edit Reward that stopped part way: two available copies changed, one did not.
    const partial = groupRewardsOf(
      [
        copy(200_000n * G, "REQUESTED"),
        copy(SET_WEI, "REQUESTED"),
        copy(200_000n * G, "REQUESTED"),
        copy(300_000n * G, "ACCEPTED"),
      ],
      METADATA,
      CLOCK
    );

    expect(partial.open).toBe(true);
    expect(partial.rewards.map((reward) => reward.wei).sort()).toEqual(
      [SET_WEI, 200_000n * G].sort()
    );
    expect(promiseRewardText({ intl, rewards: partial.rewards, price: PRICE })).toBe(
      "$20.00 to about $25.00, paid in G$ after it's kept"
    );
    // Nothing left to take up: the page says what every copy carried, edited ones included,
    // and no payout, since each copy's stands apart.
    const taken = groupRewardsOf(
      [copy(SET_WEI, "ACCEPTED"), copy(200_000n * G, "FULFILLED"), copy(SET_WEI, "FULFILLED")],
      METADATA,
      CLOCK
    );
    expect(taken.open).toBe(false);
    expect(
      promiseRewardText({ intl, rewards: taken.rewards, price: PRICE, payout: "unstated" })
    ).toBe("$20.00 to about $25.00");
  });

  it("counts a copy past its due date as ended, as taking one up does", () => {
    // Open on chain, but past due: the chain lets anyone expire it, so nobody can take it up.
    const lapsed = {
      ...onRail(SET_WEI),
      onchainState: "OFFERED" as const,
      derivedState: "OFFERED" as const,
      dueDate: CLOCK.now - 60n,
      cycleId: null,
    };
    const group = groupRewardsOf([lapsed, { ...lapsed, dueDate: CLOCK.now - 1n }], METADATA, CLOCK);

    expect(group.open).toBe(false);
    // While the due dates are unread, the chain's own state stands.
    expect(groupRewardsOf([lapsed], METADATA, null).open).toBe(true);
    // A copy still in date keeps the group open.
    expect(groupRewardsOf([lapsed, { ...lapsed, dueDate: null }], METADATA, CLOCK).open).toBe(true);
  });

  it("orders a range by the dollars it shows, and keeps it in one currency", () => {
    // Edited down to 100,000 G$, worth about $30.00 after the rate rose; the 160,000 G$ set at
    // Create still reads its $20.00. By G$ alone the range would read backwards.
    const risen: GoodDollarPriceState = { status: "ready", price: 300_000_000_000_000n, readAt: 0 };
    const rewards = [
      promiseRewardOf(onRail(100_000n * G), METADATA),
      promiseRewardOf(onRail(SET_WEI), METADATA),
    ].filter((reward) => reward !== null);

    expect(promiseRewardText({ intl, rewards, price: risen })).toBe(
      "$20.00 to about $30.00, paid in G$ after it's kept"
    );
    // Without a rate the edited amount shows no dollars, so the whole range reads in G$.
    expect(promiseRewardText({ intl, rewards, price: NO_PRICE })).toBe(
      "100,000 G$ to 160,000 G$, paid in G$ after it's kept"
    );
  });

  it("reads a reward with a USDC part as one total, paid in both tokens", () => {
    const usdc = {
      version: 1 as const,
      chainId: 42161,
      token: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
      amount: "20000000",
      usdCents: "2000",
    };
    const withUsdc = { ...METADATA, rewardLegs: [usdc] };
    const rewards = [promiseRewardOf(onRail(SET_WEI), withUsdc)].filter(
      (reward) => reward !== null
    );

    expect(promiseRewardText({ intl, rewards, price: NO_PRICE })).toBe(
      "$40.00, paid in G$ and USDC after it's kept"
    );
    // After an Edit Reward the G$ part reads at today's rate, and the total says so.
    const edited = [promiseRewardOf(onRail(200_000n * G), withUsdc)].filter((r) => r !== null);
    expect(promiseRewardText({ intl, rewards: edited, price: PRICE })).toBe(
      "about $45.00, paid in G$ and USDC after it's kept"
    );
    expect(promiseRewardText({ intl, rewards: edited, price: NO_PRICE })).toBe(
      "200,000 G$ and 20 USDC, paid in G$ and USDC after it's kept"
    );
    // A USDC part left without its G$ part, as after an Edit Reward removes it, has no payout
    // plan to split it, so it can never be paid: the reward says it can't be shown.
    const usdcOnly = [
      promiseRewardOf(
        { chainId: 42161, considerationRail: "NONE", considerationAmount: 0n },
        { ...METADATA, rewardLegs: [usdc] }
      ),
    ].filter((r) => r !== null);
    expect(
      promiseRewardText({ intl, rewards: usdcOnly, price: NO_PRICE, payout: "notPaidYet" })
    ).toBe("This reward can't be shown here");
  });

  it("says part of a reward can't be shown instead of passing the rest off as all of it", () => {
    const rewards = [
      promiseRewardOf(onRail(SET_WEI), { ...METADATA, rewardLegsUnreadable: true }),
    ].filter((reward) => reward !== null);
    expect(promiseRewardText({ intl, rewards, price: NO_PRICE })).toBe(
      "$20.00, paid in G$ after it's kept. Part of this reward can't be shown here"
    );
    const nothing = [
      promiseRewardOf(
        { chainId: 42161, considerationRail: "NONE", considerationAmount: 0n },
        { rewardLegsUnreadable: true }
      ),
    ].filter((reward) => reward !== null);
    expect(promiseRewardText({ intl, rewards: nothing, price: NO_PRICE })).toBe(
      "This reward can't be shown here"
    );
  });
});
