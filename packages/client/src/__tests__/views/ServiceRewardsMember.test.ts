/**
 * A request rewarded with a member's voucher (PRD-1299 SReward, slice 2): 1 Teo voucher, sent
 * from Teo's reserve under the allowance he approves for rewards. A used-up allowance waits for
 * Teo to approve more; a short reserve waits for a top-up; either way the reward is unchanged.
 */

import type { RewardStoryState } from "../../../../shared/.storybook/voucherBookingFixtures";
import en from "@green-goods/shared/i18n/en";
import { createIntl } from "react-intl";
import { describe, expect, it } from "vitest";
import { rewardStoryCoreState } from "../../../../shared/.storybook/voucherBookingFixtures";
import { LESSON_STORY_ISSUER } from "../../../../shared/.storybook/voucherLessonFixtures";
import { memberRewardStorySnapshot } from "../../../../shared/.storybook/voucherMemberRewardFixtures";
import { serviceRewardsView } from "../../views/Home/Garden/Commitment/serviceRewards";

const intl = createIntl({ locale: "en", messages: en });

function rewards(state: RewardStoryState, shortOf: "allowance" | "reserve" = "allowance") {
  const view = serviceRewardsView(
    {
      snapshot: memberRewardStorySnapshot(state, shortOf),
      coreState: rewardStoryCoreState(state),
      issuer: LESSON_STORY_ISSUER,
      garden: "Tech and Sun",
    },
    intl
  );
  if (!view) throw new Error(`No rewards at ${state}`);
  return view;
}

describe("a request rewarded with a member's voucher", () => {
  it("says a used-up allowance waits for the member to approve more", () => {
    const short = rewards("reserveShort");
    expect(short.rows[0]).toMatchObject({
      title: "1 Teo Alves voucher",
      detail: "Teo Alves' allowance is used up. Sent when Teo Alves approves more.",
    });
    expect(short.band.sentence).toBe(
      "Teo Alves' allowance for Tech and Sun is used up, so the reward waits until Teo Alves approves more from their reserve. Your reward is unchanged."
    );
  });

  // The allowance and the reserve are separate limits: a short reserve still needs a top-up.
  it("keeps a short reserve's own words", () => {
    const short = rewards("reserveShort", "reserve");
    expect(short.rows[0]?.detail).toBe("Waits for Teo Alves");
    expect(short.band.sentence).toBe(
      "Teo Alves' reserve is short right now, so Teo Alves needs to top it up. Your reward is unchanged."
    );
  });

  it("says the member sends vouchers from their reserve, under an allowance they approve", () => {
    expect(rewards("open").facts.find((fact) => fact.id === "aside")?.detail).toBe(
      "Teo Alves sends vouchers from their reserve when your work is confirmed. If their allowance runs short, they wait until Teo Alves approves more."
    );
  });

  it("says a single voucher that arrived is in the reader's account", () => {
    expect(rewards("received").band.sentence).toBe("Your Teo Alves voucher is in your account.");
  });
});
