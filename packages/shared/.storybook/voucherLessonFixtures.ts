import type { CommitmentDerivedState } from "../src/modules/commitment-pooling";
import { serviceAccessAvailableActions } from "../src/modules/commitment-pooling/service-access";
import type { ServiceAccessSnapshot } from "../src/modules/commitment-pooling/service-access-types";
import { voucherSetupAvailableActions } from "../src/modules/commitment-pooling/service-access-voucher";
import {
  voucherBookingEscrow,
  voucherPendingReturn,
} from "../src/modules/commitment-pooling/service-access-wallet";
import type {
  VoucherIssuer,
  VoucherIssuerApproval,
  VoucherWalletSnapshot,
} from "../src/modules/commitment-pooling/service-access-wallet-types";
import type { GardenCommitmentController } from "../src/hooks/client-ui/commitment/controller.types";
import {
  type BookingStoryStage,
  bookingStoryController,
  bookingStoryCoreState,
  bookingStorySnapshot,
} from "./voucherBookingFixtures";
import { VOUCHER_STORY_ISSUERS, VOUCHER_STORY_SCOPE, vouchers } from "./voucherPilotFixtures";

/**
 * Storybook-only fixtures for a member's own service (PRD-1299 slice 2): Teo's integration
 * lesson, where one Teo voucher books 60 minutes with him. He approves each booking from his
 * own account and the garden's stewards accept it. The lesson stopped after 30 of the 60
 * minutes, so the split returns half each way. Fictional people and amounts from the design
 * lab; built on the hub day's booking, so every stage carries the shared selectors' acts.
 */
export const LESSON_STORY_ISSUER: VoucherIssuer = {
  ...VOUCHER_STORY_ISSUERS.techAndSun,
  account: "0x000000000000000000000000000000000000e7e0",
  kind: "individual",
  name: "Teo Alves",
  gender: "masculine",
  asset: {
    chainId: 100,
    token: "0x000000000000000000000000000000000000e7e1",
    symbol: "TEO",
    decimals: 6,
  },
};

/** A member approves from their own account, so there is no Safe's count to read. */
export const LESSON_STORY_APPROVAL: VoucherIssuerApproval = {
  kind: "account",
  evidence: "local-rehearsal",
};

export const LESSON_STORY_TITLE = "Integration lesson, 60 minutes";
const MINUTES = 60n;
const HALF = vouchers(0.5);

/** The lesson's snapshot at a booking stage; options are the hub day's. */
export function lessonStorySnapshot(
  stage: BookingStoryStage,
  options: Parameters<typeof bookingStorySnapshot>[2] = {}
): ServiceAccessSnapshot {
  const teo = LESSON_STORY_ISSUER;
  const s = bookingStorySnapshot("hubDay", stage, {
    held: stage === "notEnough" ? 0n : vouchers(1),
    ...options,
  });
  if (s.offer)
    s.offer = {
      ...s.offer,
      serviceUnits: MINUTES,
      unitLabel: "minutes",
      providerGarden: teo.garden,
      voucher: { asset: teo.asset, issuer: teo.account, units: vouchers(1) },
    };
  for (const setup of s.voucherSetups) {
    setup.asset = teo.asset;
    setup.authorization = {
      ...setup.authorization,
      issuer: teo.account,
      token: teo.asset.token,
      providerGarden: teo.garden,
      serviceUnits: MINUTES,
    };
    const d = setup.destination;
    if (d && (stage === "returnProposed" || d.finalAllocation)) d.issuerReturnCeiling = HALF;
    const final = d?.finalAllocation;
    if (d && final) {
      const legs =
        stage === "closed"
          ? (["succeeded", "succeeded"] as const)
          : stage === "returnFailed"
            ? (["succeeded", "failed"] as const)
            : (["pending", "pending"] as const);
      d.finalAllocation = {
        ...final,
        issuerReturnApprovalAtFreeze: HALF,
        allocation: {
          approvedDeliveredServiceUnits: 30n,
          releaseVoucherUnits: HALF,
          refundVoucherUnits: HALF,
        },
        release: { ...final.release, state: legs[0] },
        refund: { ...final.release, state: legs[1] },
      };
    }
    setup.availableActions = voucherSetupAvailableActions(s, setup);
  }
  // The stewards close a lesson cut short as canceled with its reason: ended early, never kept.
  if (stage === "closed") s.coreState = "CANCELLED";
  s.availableActions = serviceAccessAvailableActions(s);
  return s;
}

/** The promise's own state beside the booking: an early end closes as canceled. */
export function lessonStoryCoreState(stage: BookingStoryStage): CommitmentDerivedState {
  return stage === "closed" ? "CANCELLED" : bookingStoryCoreState("hubDay", stage);
}

/** The promise page's controller for the lesson: Teo's offer, which he leads. */
export function lessonStoryController(stage: BookingStoryStage): GardenCommitmentController {
  const controller = bookingStoryController("hubDay", lessonStoryCoreState(stage));
  const teo = LESSON_STORY_ISSUER.account;
  const detail = controller.detail && {
    ...controller.detail,
    commitment: {
      ...controller.detail.commitment,
      creator: teo,
      leadProvider: teo,
      unitLabel: "minutes",
      targetUnits: MINUTES,
    },
    contributors: controller.detail.contributors.map((entry) => ({ ...entry, contributor: teo })),
  };
  return {
    ...controller,
    detail,
    metadata: {
      version: 1,
      title: LESSON_STORY_TITLE,
      note: "One remote session to wire your project into the Green Goods API, with Teo.",
    },
  };
}

/** The reader holds one Teo voucher before booking; the booking holds it, then half returns. */
export function lessonStoryWallet(snapshot: ServiceAccessSnapshot, held: number): VoucherWalletSnapshot {
  return {
    account: VOUCHER_STORY_SCOPE.account,
    evidence: "local-rehearsal",
    complete: true,
    reason: null,
    issuers: [LESSON_STORY_ISSUER],
    holdings: [{ issuer: LESSON_STORY_ISSUER, available: vouchers(held) }],
    bookings: snapshot.voucherSetups
      .map(voucherBookingEscrow)
      .filter((escrow) => escrow.stage !== "closed"),
    returns: snapshot.voucherSetups.flatMap((setup) => voucherPendingReturn(setup) ?? []),
  };
}
