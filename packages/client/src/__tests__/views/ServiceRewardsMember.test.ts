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

function rewards(
  state: RewardStoryState,
  shortOf: "allowance" | "reserve" = "allowance",
  options: { withGd?: boolean; issuer?: typeof LESSON_STORY_ISSUER | null } = {}
) {
  const view = serviceRewardsView(
    {
      snapshot: memberRewardStorySnapshot(state, shortOf, options.withGd),
      coreState: rewardStoryCoreState(state),
      issuer: options.issuer === undefined ? LESSON_STORY_ISSUER : options.issuer,
      garden: "Tech and Sun",
      takeUp: null,
    },
    intl
  );
  if (!view) throw new Error(`No rewards at ${state}`);
  return view;
}

describe("a request rewarded with a member's voucher", () => {
  it.each([
    ["ready", false, true, "local-rehearsal", "agreed"],
    ["paused", true, true, "local-rehearsal", null],
    ["pause unknown", null, true, "local-rehearsal", null],
    ["route unreviewed", false, true, "unavailable", null],
    ["signer unavailable", false, false, "local-rehearsal", null],
  ] as const)("offers an agreed take-up only when ready: %s", (_case, paused, signer, mutation, expected) => {
    const snapshot = memberRewardStorySnapshot("open", "allowance");
    snapshot.pause.core = false;
    snapshot.capabilities.canSignSource = signer;
    snapshot.capabilities.mutation = mutation;
    Object.assign(snapshot.acceptancePolicy.earned, {
      status: "bound",
      claimType: "individual",
      revision: 1n,
      viewerConsentRevision: 1n,
      modulePaused: paused,
    });
    const view = serviceRewardsView(
      {
        snapshot,
        coreState: "REQUESTED",
        issuer: LESSON_STORY_ISSUER,
        garden: "Test garden",
        takeUp: "open",
      },
      intl
    );
    expect(view?.agree).toBe(expected);
    expect(view?.agreeSheet).toBeNull();
  });
  // "Short" means the allowance left doesn't cover the reward, not that none is left.
  it("says an allowance that doesn't cover the reward waits for the member to approve more", () => {
    const short = rewards("reserveShort");
    expect(short.rows[0]).toMatchObject({
      title: "1 Teo Alves voucher",
      detail: "Teo Alves' allowance doesn't cover it yet. Sent when Teo Alves approves more.",
    });
    expect(short.band.sentence).toBe(
      "Teo Alves' allowance for Tech and Sun doesn't cover this reward, so it waits until Teo Alves approves more from their reserve. Your reward is unchanged."
    );
  });

  // With G$ already in, the voucher still waits on the allowance, not on a reserve top-up.
  it("keeps the allowance's reason once the G$ arrived", () => {
    expect(rewards("reserveShort", "allowance", { withGd: true }).band.sentence).toBe(
      "Teo Alves' allowance for Tech and Sun doesn't cover this reward, so it waits until Teo Alves approves more. Your reward is unchanged, and your G$ already arrived."
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

  // Until the wallet names the issuer, no line calls a person "it".
  it("words the set-aside fact for any issuer while the issuer is unknown", () => {
    expect(rewards("open", "allowance", { issuer: null }).facts[1]?.detail).toBe(
      "TEO sends vouchers from their reserve when your work is confirmed. If their allowance runs short, they wait until TEO approves more."
    );
  });

  it("says a single voucher that arrived is in the reader's account", () => {
    expect(rewards("received").band.sentence).toBe("Your Teo Alves voucher is in your account.");
  });
});
