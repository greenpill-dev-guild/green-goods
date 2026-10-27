import type { GardenCommitmentController } from "../src/hooks/client-ui/commitment/controller.types";
import type { ServiceAccessPilot } from "../src/modules/commitment-pooling/service-access-pilot-types";
import type { ServiceAccessSnapshot } from "../src/modules/commitment-pooling/service-access-types";
import {
  type RewardStoryState,
  rewardStoryController,
  rewardStorySnapshot,
} from "./voucherBookingFixtures";
import { LESSON_STORY_ISSUER } from "./voucherLessonFixtures";
import { vouchers } from "./voucherPilotFixtures";

/**
 * Storybook-only fixtures for a request rewarded with a member's voucher (PRD-1299 SReward,
 * slice 2): the garden asks for its impact website's design and rewards 1 Teo voucher, sent
 * from Teo's reserve under the allowance he approves for rewards. Its short state is that
 * allowance used up, unless the reserve itself runs short. Fictional, from the design lab.
 */
export const MEMBER_REWARD_TITLE = "Design the impact website";

export function memberRewardStorySnapshot(
  state: RewardStoryState,
  shortOf: "allowance" | "reserve" = "allowance",
  withGd = false
): ServiceAccessSnapshot {
  const s = rewardStorySnapshot(state, withGd);
  const pilot = s.pilot as ServiceAccessPilot;
  const teo = LESSON_STORY_ISSUER;
  const voucher = pilot.reward?.voucher ?? null;
  const short = state === "reserveShort";
  s.pilot = {
    ...pilot,
    reward:
      pilot.reward && voucher
        ? {
            ...pilot.reward,
            voucher: { ...voucher, asset: teo.asset, amount: vouchers(1), funder: teo.account },
          }
        : pilot.reward,
    inventory: {
      asset: teo.asset,
      reserve: short && shortOf === "reserve" ? 0n : vouchers(4),
      allowance: short && shortOf === "allowance" ? 0n : vouchers(1),
      acceptedUndelivered: voucher?.state === "delivered" ? 0n : vouchers(1),
    },
  };
  return s;
}

/** The request's page controller: the garden's request, with the design brief's words. */
export function memberRewardStoryController(state: RewardStoryState): GardenCommitmentController {
  return {
    ...rewardStoryController(state, false),
    metadata: {
      version: 1,
      title: MEMBER_REWARD_TITLE,
      note: "Design the landing page and impact section for the garden's website, with a reviewed handoff for the build.",
    },
  };
}
