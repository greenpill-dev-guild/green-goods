/**
 * The voucher pilot's issuer consoles for the pool stories (PRD-1297 surface 6,
 * PRD-1299 `SIssuer`): Tech and Sun's hub days and Green Goods' Claude access,
 * with the bookings asked in each pool, the bookings under way on their offers,
 * and each issuer's reserve. The services and prices are the working pilot
 * terms, which the issuers haven't accepted; the people, Riverside Commons,
 * every address, balance and moment are fictional, on the frozen Storybook clock.
 */

import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import { useGreenGoodsEnsName } from "@green-goods/shared/hooks/ens/useGreenGoodsEnsName";
import type { VoucherConsoleView } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import {
  UNAVAILABLE_VOUCHER_CONSOLE,
  type VoucherAsk,
  type VoucherBooking,
  type VoucherConsoleSnapshot,
  type VoucherIssuerReserve,
} from "@green-goods/shared/modules/commitment-pooling/pool-console";
import type {
  CommitmentReadModel,
  PoolClaimRequestRow,
} from "@green-goods/shared/modules/commitment-pooling/types-core";
import type { Address } from "@green-goods/shared/types/domain";
import type { QueryKey } from "@tanstack/react-query";
import { mocked } from "storybook/test";
import {
  daysAgo,
  daysFromNow,
  STORYBOOK_NOW_SECONDS,
} from "../../../../../shared/.storybook/fixtures";
import { resetHookMocks } from "../../../../../shared/.storybook/moduleMocks";
import { STORY_GARDEN, STORY_STEWARD } from "./poolStoryActors";
import { storyCommitment } from "./poolStoryCommitments";

const HOUR = 3_600;
/** A voucher on the pilot's six-decimal tokens. */
const VOUCHER = 1_000_000n;

const STORY_LINA = "0x52a0000000000000000000000000000000009a1a" as Address;
const STORY_KWESI = "0x6b30000000000000000000000000000000004b2c" as Address;
const STORY_MARA = "0x7c40000000000000000000000000000000005c3d" as Address;
const STORY_RAFA = "0x8d50000000000000000000000000000000006d4e" as Address;

/** Who each fictional member is, as their Green Goods names would say. */
const STORY_VOUCHER_NAMES: Record<string, string> = {
  [STORY_LINA.toLowerCase()]: "Lina",
  [STORY_KWESI.toLowerCase()]: "Kwesi",
  [STORY_MARA.toLowerCase()]: "Mara",
  [STORY_RAFA.toLowerCase()]: "Rafa",
};

const TECH_AND_SUN = {
  name: "Tech and Sun",
  safe: "0x5afe00000000000000000000000000000000a1b2" as Address,
  decimals: 6,
};
const GREEN_GOODS = {
  name: "Green Goods",
  safe: "0x5afe00000000000000000000000000000000c3d4" as Address,
  decimals: 6,
};

/** The offers' titles, as their issuers wrote them. */
export const STORY_VOUCHER_TITLES = new Map([
  ["bafy-hub-day", { version: 1 as const, title: "Hub day, up to 4 hours" }],
  ["bafy-claude", { version: 1 as const, title: "Claude access, 30 days" }],
  ["bafy-session", { version: 1 as const, title: "Assisted session, 30 minutes" }],
]);

function offer(
  commitmentId: bigint,
  metadataCID: string,
  overrides: Partial<CommitmentReadModel> = {}
): CommitmentReadModel {
  return storyCommitment({
    id: `${DEFAULT_CHAIN_ID}-${commitmentId}`,
    commitmentId,
    onchainState: "OFFERED",
    derivedState: "OFFERED",
    state: "OFFERED",
    direction: "OFFER",
    creator: STORY_STEWARD,
    leadProvider: STORY_STEWARD,
    counterparty: null,
    targetUnits: 1n,
    unitLabel: "booking",
    claimMode: "APPROVAL_GATED",
    metadataCID,
    dueDate: BigInt(daysFromNow(36)),
    ...overrides,
  });
}

function accepted(
  commitmentId: bigint,
  metadataCID: string,
  holder: Address,
  overrides: Partial<CommitmentReadModel> = {}
): CommitmentReadModel {
  return offer(commitmentId, metadataCID, {
    onchainState: "ACCEPTED",
    derivedState: "ACTIVE",
    state: "ACCEPTED",
    counterparty: holder,
    ...overrides,
  });
}

function ask(
  commitmentId: bigint,
  buyer: Address,
  overrides: Partial<Omit<VoucherAsk, "setup">> & {
    setup?: Partial<VoucherAsk["setup"]> | null;
  } = {}
): VoucherAsk {
  const { setup, ...rest } = overrides;
  const agreedAt = rest.agreedAt ?? daysAgo(2);
  const terms = { revision: 2n, termsHash: `0x${"7e".repeat(32)}` as const };
  return {
    commitmentId,
    buyer,
    claimHash: `0x${commitmentId.toString(16).padStart(64, "c")}`,
    agreed: terms,
    current: terms,
    agreedAt,
    issuer: TECH_AND_SUN,
    ...rest,
    setup:
      setup === null
        ? null
        : {
            voucherUnits: VOUCHER,
            approvedAt: daysAgo(1),
            depositedUnits: VOUCHER,
            depositConfirmed: true,
            acceptBy: agreedAt + 7 * 86_400,
            ...setup,
          },
  };
}

function claimRow(commitment: CommitmentReadModel, buyer: Address, requestedAt: number) {
  return {
    claim: {
      id: `${DEFAULT_CHAIN_ID}-${commitment.commitmentId}-${buyer}`,
      chainId: DEFAULT_CHAIN_ID,
      commitmentId: commitment.commitmentId,
      claimant: buyer,
      requestSeen: true as const,
      requestedBy: buyer,
      claimType: "INDIVIDUAL" as const,
      gardenContext: STORY_GARDEN,
      state: "PENDING" as const,
      reasonCID: null,
      resolutionCode: null,
      requestedAt,
      resolvedAt: null,
      updatedAt: requestedAt,
    },
    commitment,
  } satisfies PoolClaimRequestRow;
}

// Tech and Sun's console: two hub days asked, one under way.
const LINA_OFFER = offer(41n, "bafy-hub-day");
const KWESI_OFFER = offer(42n, "bafy-hub-day");
const MARA_BOOKING = accepted(43n, "bafy-hub-day", STORY_MARA);

/** Lina agreed two days ago; her hub day waits on Tech and Sun's approval. */
export const STORY_LINA_ASK = ask(41n, STORY_LINA, {
  setup: { approvedAt: null, depositedUnits: 0n, depositConfirmed: false },
});
/** Kwesi's deposit is confirmed on Green Goods: the steward can accept. */
export const STORY_KWESI_ASK = ask(42n, STORY_KWESI, {
  agreedAt: daysAgo(3),
  setup: { approvedAt: daysAgo(2) },
});

export const STORY_MARA_VISIT: VoucherBooking = {
  commitmentId: 43n,
  holder: STORY_MARA,
  setupId: `0x${"a4".repeat(32)}`,
  issuer: TECH_AND_SUN,
  voucherUnits: VOUCHER,
  service: {
    kind: "visit",
    startsAt: STORYBOOK_NOW_SECONDS + 4 * 86_400 + 10 * HOUR,
    endsAt: STORYBOOK_NOW_SECONDS + 4 * 86_400 + 14 * HOUR,
    report: { checkedIn: true, usableHours: 4, ofHours: 4, photos: 2 },
  },
  stage: { kind: "in-progress" },
};

const TECH_AND_SUN_RESERVE: VoucherIssuerReserve = {
  issuer: TECH_AND_SUN,
  inReserve: 8n * VOUCHER,
  promised: 3n * VOUCHER,
  allowance: { garden: "Riverside Commons", limit: 4n * VOUCHER, left: 2n * VOUCHER },
  openBookings: 3,
  terms: { version: 2n, returns: { kind: "usable-hours", of: 4 } },
  cap: { issued: 20n * VOUCHER, ceiling: 20n * VOUCHER },
  waitingReward: null,
};

export const STORY_TECH_AND_SUN_COMMITMENTS = [MARA_BOOKING, KWESI_OFFER, LINA_OFFER];
export const STORY_TECH_AND_SUN_CLAIMS = [
  claimRow(LINA_OFFER, STORY_LINA, daysAgo(2)),
  claimRow(KWESI_OFFER, STORY_KWESI, daysAgo(3)),
];

/** Tech and Sun's console as the pilot reads it: two asks, a visit under way, one signature. */
export const STORY_TECH_AND_SUN_VOUCHERS: VoucherConsoleSnapshot = {
  status: "observed",
  observedAt: STORYBOOK_NOW_SECONDS,
  asks: [STORY_LINA_ASK, STORY_KWESI_ASK],
  bookings: [STORY_MARA_VISIT],
  reserve: TECH_AND_SUN_RESERVE,
  // Tech and Sun's Safe starts with one approved signer, read from the Safe.
  safe: { status: "observed", threshold: 1, owners: 1 },
};

/** Riverside Commons' allowance is used up, so Lina's reward of 2 vouchers waits. */
export const STORY_TECH_AND_SUN_SHORT: VoucherConsoleSnapshot = {
  ...STORY_TECH_AND_SUN_VOUCHERS,
  reserve: {
    ...TECH_AND_SUN_RESERVE,
    allowance: { ...TECH_AND_SUN_RESERVE.allowance, left: 0n },
    waitingReward: {
      recipient: STORY_LINA,
      units: 2n * VOUCHER,
      title: "Map the garden’s water lines",
    },
  },
};

// Green Goods' console: Claude access that ended early, one under way, a session asked.
const LINA_ACCESS = accepted(51n, "bafy-claude", STORY_LINA);
const KWESI_ACCESS = accepted(52n, "bafy-claude", STORY_KWESI);
const RAFA_OFFER = offer(53n, "bafy-session");

export const STORY_LINA_ENDED: VoucherBooking = {
  commitmentId: 51n,
  holder: STORY_LINA,
  setupId: `0x${"b5".repeat(32)}`,
  issuer: GREEN_GOODS,
  voucherUnits: 10n * VOUCHER,
  service: { kind: "access", daysUsed: 12, daysOf: 30 },
  // The working terms' days-of-access return: 18 of 30 days unused, 6 of 10 vouchers.
  stage: { kind: "ended-early", returnLimit: 6n * VOUCHER },
};

export const STORY_GREEN_GOODS_COMMITMENTS = [LINA_ACCESS, KWESI_ACCESS, RAFA_OFFER];
export const STORY_GREEN_GOODS_CLAIMS = [claimRow(RAFA_OFFER, STORY_RAFA, daysAgo(1))];

/** Green Goods' console: Lina's access stopped after 12 days; its Safe signs 2 of 5. */
export const STORY_GREEN_GOODS_VOUCHERS: VoucherConsoleSnapshot = {
  status: "observed",
  observedAt: STORYBOOK_NOW_SECONDS,
  asks: [
    ask(53n, STORY_RAFA, {
      issuer: GREEN_GOODS,
      agreedAt: daysAgo(1),
      setup: { approvedAt: null, depositedUnits: 0n, depositConfirmed: false },
    }),
  ],
  bookings: [
    STORY_LINA_ENDED,
    {
      commitmentId: 52n,
      holder: STORY_KWESI,
      setupId: `0x${"c6".repeat(32)}`,
      issuer: GREEN_GOODS,
      voucherUnits: 10n * VOUCHER,
      service: { kind: "access", daysUsed: 18, daysOf: 30 },
      stage: { kind: "in-progress" },
    },
  ],
  reserve: {
    issuer: GREEN_GOODS,
    inReserve: 10n * VOUCHER,
    promised: 2n * VOUCHER,
    allowance: { garden: "Riverside Commons", limit: 6n * VOUCHER, left: 4n * VOUCHER },
    openBookings: 2,
    terms: { version: 2n, returns: { kind: "access-days", of: 30 } },
    cap: { issued: 20n * VOUCHER, ceiling: 20n * VOUCHER },
    waitingReward: null,
  },
  safe: { status: "observed", threshold: 2, owners: 5 },
};

/** Lina approved the split, and the 6 vouchers back to her didn't arrive: anyone can retry. */
export const STORY_GREEN_GOODS_RETURN_FAILED: VoucherConsoleSnapshot = {
  ...STORY_GREEN_GOODS_VOUCHERS,
  bookings: STORY_GREEN_GOODS_VOUCHERS.bookings.map((booking) =>
    booking.commitmentId === 51n
      ? { ...booking, stage: { kind: "return-failed" as const, units: 6n * VOUCHER } }
      : booking
  ),
};

/** The voucher console as `useVoucherConsole` hands it over; its issuer acts resolve without sending. */
export function storyVoucherConsole(
  snapshot: VoucherConsoleSnapshot = UNAVAILABLE_VOUCHER_CONSOLE,
  acts: Partial<VoucherConsoleView["acts"]> = {}
): VoucherConsoleView {
  const resolve = async () => undefined;
  return {
    snapshot,
    now: snapshot.observedAt || STORYBOOK_NOW_SECONDS,
    askFor: (commitmentId, buyer) =>
      snapshot.asks.find(
        (entry) =>
          entry.commitmentId === commitmentId && entry.buyer.toLowerCase() === buyer.toLowerCase()
      ),
    bookingFor: (commitmentId) =>
      snapshot.bookings.find((booking) => booking.commitmentId === commitmentId),
    acts: {
      approveBooking: resolve,
      reportVisit: resolve,
      proposeReturn: resolve,
      retryTransfer: resolve,
      raiseAllowance: resolve,
      ...acts,
    },
  };
}

/** The voucher read seeded under the key `useVoucherConsole` reads, for the route stories. */
export function voucherConsoleSeed(snapshot: VoucherConsoleSnapshot): readonly [QueryKey, unknown] {
  return [queryKeys.commitmentPooling.voucherConsole(DEFAULT_CHAIN_ID, STORY_GARDEN), snapshot];
}

/**
 * Gives the fictional members their Green Goods names for one story, as the
 * shared address display would read them; returns the cleanup Storybook runs
 * after the story, so later stories get the real hooks back.
 */
export function nameVoucherMembers(): () => void {
  mocked(useGreenGoodsEnsName).mockImplementation(((address?: Address | null) => ({
    data: STORY_VOUCHER_NAMES[address?.toLowerCase() ?? ""] ?? null,
    isLoading: false,
  })) as unknown as typeof useGreenGoodsEnsName);
  mocked(useEnsName).mockReturnValue({ data: null, isLoading: false } as ReturnType<
    typeof useEnsName
  >);
  return resetHookMocks(useGreenGoodsEnsName, useEnsName);
}
