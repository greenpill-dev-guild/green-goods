/**
 * A promise's reward as a member reads it before taking one up: the dollars it
 * was set in while the chain still holds that G$ amount, about today's rate
 * after an edit, else G$; and how it is paid, or that payouts are switched off.
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

  it("says it is paid in G$ once kept, and says payouts are off while this app has them off", () => {
    const rewards = [promiseRewardOf(onRail(SET_WEI), METADATA)].filter(
      (reward) => reward !== null
    );

    expect(promiseRewardText({ intl, rewards, price: NO_PRICE, payoutsOn: true })).toBe(
      "$20.00, paid in G$ after it's kept"
    );
    expect(promiseRewardText({ intl, rewards, price: NO_PRICE, payoutsOn: false })).toBe(
      "$20.00 in G$. Payouts aren't switched on in this app yet."
    );
    expect(
      promiseRewardText({ intl, rewards, price: NO_PRICE, paid: true, payoutsOn: false })
    ).toBe("$20.00, paid in G$");
    expect(promiseRewardText({ intl, rewards: [], price: PRICE, payoutsOn: true })).toBeNull();
  });

  it("reads an edited reward at about today's rate, or in G$ when there is no rate", () => {
    // An Edit Reward changed the chain's amount, so the dollars set at Create no longer hold.
    const edited = [promiseRewardOf(onRail(200_000n * G), METADATA)].filter(
      (reward) => reward !== null
    );

    expect(edited[0]?.centsAsSet).toBeNull();
    expect(promiseRewardText({ intl, rewards: edited, price: PRICE, payoutsOn: true })).toBe(
      "about $25.00, paid in G$ after it's kept"
    );
    expect(promiseRewardText({ intl, rewards: edited, price: NO_PRICE, payoutsOn: true })).toBe(
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

    expect(partial.map((reward) => reward.wei)).toEqual([SET_WEI, 200_000n * G]);
    expect(promiseRewardText({ intl, rewards: partial, price: PRICE, payoutsOn: true })).toBe(
      "$20.00 to about $25.00, paid in G$ after it's kept"
    );
    // Nothing left to take up: the page still says what each one carried.
    expect(
      groupRewardsOf([copy(SET_WEI, "ACCEPTED"), copy(SET_WEI, "FULFILLED")], METADATA)
    ).toEqual([{ wei: SET_WEI, centsAsSet: 2000n }]);
  });
});
