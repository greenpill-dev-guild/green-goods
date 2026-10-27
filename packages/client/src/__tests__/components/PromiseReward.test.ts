/**
 * A promise's reward as a member reads it before taking one up: the dollars it
 * was set in while the chain still holds that G$ amount, about today's rate
 * after an edit, else G$; and that it is paid in G$ once the promise is kept.
 */

import type { CommitmentMetadataV1 } from "@green-goods/shared/commitment-pooling";
import en from "@green-goods/shared/i18n/en";
import type { GoodDollarPriceState } from "@green-goods/shared/modules/wallet/good-dollar-price";
import { createIntl } from "react-intl";
import { describe, expect, it } from "vitest";
import {
  groupRewardsOf,
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

const onRail = (wei: bigint) =>
  ({ considerationRail: "CELO_SETTLEMENT", considerationAmount: wei }) as const;

describe("promise rewards", () => {
  it("reads only a G$ reward with an amount", () => {
    expect(promiseRewardOf(onRail(SET_WEI), METADATA)).toEqual({
      wei: SET_WEI,
      centsAsSet: 2000n,
    });
    expect(
      promiseRewardOf({ considerationRail: "NONE", considerationAmount: 0n }, null)
    ).toBeNull();
    expect(promiseRewardOf(onRail(0n), METADATA)).toBeNull();
    expect(
      promiseRewardOf(
        { considerationRail: "ARBITRUM_EXTERNAL", considerationAmount: SET_WEI },
        null
      )
    ).toBeNull();
  });

  it("says it is paid in G$ once kept, then whether it has been paid", () => {
    const rewards = [promiseRewardOf(onRail(SET_WEI), METADATA)].filter(
      (reward) => reward !== null
    );

    expect(promiseRewardText({ intl, rewards, price: NO_PRICE })).toBe(
      "$20.00, paid in G$ after it's kept"
    );
    // Kept, with the payout still to come: never "after it's kept" on a kept promise.
    expect(promiseRewardText({ intl, rewards, price: NO_PRICE, kept: true })).toBe(
      "$20.00 in G$, not paid yet"
    );
    expect(promiseRewardText({ intl, rewards, price: NO_PRICE, kept: true, paid: true })).toBe(
      "$20.00, paid in G$"
    );
    expect(promiseRewardText({ intl, rewards: [], price: PRICE })).toBeNull();
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
  });

  it("gives a group the rewards a member could still take up, as a range when they differ", () => {
    const copy = (wei: bigint, onchainState: "REQUESTED" | "ACCEPTED" | "FULFILLED") => ({
      ...onRail(wei),
      onchainState,
    });
    // An Edit Reward that stopped part way: two available copies changed, one did not.
    const partial = groupRewardsOf(
      [
        copy(200_000n * G, "REQUESTED"),
        copy(SET_WEI, "REQUESTED"),
        copy(200_000n * G, "REQUESTED"),
        copy(300_000n * G, "ACCEPTED"),
      ],
      METADATA
    );

    expect(partial.map((reward) => reward.wei).sort()).toEqual([SET_WEI, 200_000n * G].sort());
    expect(promiseRewardText({ intl, rewards: partial, price: PRICE })).toBe(
      "$20.00 to about $25.00, paid in G$ after it's kept"
    );
    // Nothing left to take up: the page says what every copy carried, edited ones included.
    const taken = groupRewardsOf(
      [copy(SET_WEI, "ACCEPTED"), copy(200_000n * G, "FULFILLED"), copy(SET_WEI, "FULFILLED")],
      METADATA
    );
    expect(promiseRewardText({ intl, rewards: taken, price: PRICE })).toBe(
      "$20.00 to about $25.00, paid in G$ after it's kept"
    );
  });

  it("orders a range by the dollars it shows, not by its G$", () => {
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
  });
});
