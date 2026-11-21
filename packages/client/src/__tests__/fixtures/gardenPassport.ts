import type { PublicGardenPassportRecord } from "@green-goods/shared/commitment-pooling/public";
import type { Address } from "@green-goods/shared/types/domain";

/**
 * An invented passport for tests and Storybook. The public page shows live records only; these
 * figures exist so every line of the page can be drawn and checked, and they describe no garden.
 */
export const PASSPORT_FIXTURE_GARDEN = `0x${"1".repeat(40)}` as Address;
const GDOLLAR = "0x62b8b11039fcfe5ab0c56e502b1c372a3d2a9c7a" as Address;
const VOUCHER = `0x${"a".repeat(40)}` as Address;
const G = 10n ** 18n;

/** A record large enough that every split is published. */
export function gardenPassportFixture(
  overrides: Partial<PublicGardenPassportRecord> = {}
): PublicGardenPassportRecord {
  return {
    chainId: 42161,
    garden: PASSPORT_FIXTURE_GARDEN,
    poolId: 7n,
    readAt: 1_795_000_000,
    partialData: false,
    unavailableSources: { promises: false, vouchers: false, settlement: false, supply: false },
    supply: {
      status: "available",
      asOf: 1_794_900_000,
      value: [
        {
          token: VOUCHER,
          symbol: "GGV",
          decimals: 6,
          pools: [
            { name: "Riverside", listed: true, holding: 10_000_000n, holdingLimit: 40_000_000n },
          ],
          outstanding: 10_000_000n,
          outsidePools: false,
        },
      ],
    },
    promises: {
      status: "available",
      asOf: 1_794_000_000,
      value: {
        since: 1_790_000_000,
        made: 14,
        takenUp: 9,
        due: 8,
        kept: 4,
        unresolved: 4,
        breakdown: {
          stillOpen: 3,
          awaitingConfirmation: 1,
          notKept: 1,
          partlyDelivered: 1,
          pastDue: 1,
        },
        standingOffers: 2,
        units: [
          {
            unitLabel: "hub days",
            promised: 12n,
            delivered: 3n,
            undelivered: 9n,
            stillToDeliver: 7n,
            notDelivered: 2n,
            onOffer: 0n,
          },
          {
            unitLabel: "workshops",
            promised: 5n,
            delivered: 5n,
            undelivered: 0n,
            stillToDeliver: 0n,
            notDelivered: 0n,
            onOffer: 4n,
          },
        ],
      },
    },
    vouchers: {
      status: "available",
      asOf: 1_794_500_000,
      value: {
        offersBookable: 2,
        capacityOnOffer: [{ unitLabel: "workshops", units: 4n }],
        earned: {
          withheld: false,
          promisesWithApprovedTerms: 5,
          recorded: 4,
          issued: 3,
          failed: 0,
          awaiting: 1,
          tracedToKeptPromise: 3,
          confirmedByOwnConfirmers: 2,
          confirmedByFallback: 1,
        },
        bookings: {
          withheld: false,
          requested: 3,
          accepted: 2,
          notStarted: 1,
          settled: 1,
          transfersFailed: 1,
          amounts: {
            services: [{ unitLabel: "seat days", booked: 60n, confirmedDelivered: 20n }],
            vouchers: [
              {
                token: VOUCHER,
                symbol: "GGV",
                decimals: 6,
                presented: 30_000_000n,
                returnedToIssuer: 7_000_000n,
                refundedToHolder: 10_000_000n,
                awaitingTransfer: 3_000_000n,
              },
            ],
          },
        },
      },
    },
    settlement: {
      status: "available",
      asOf: 1_794_800_000,
      value: {
        keptAwaitingPaymentPlan: 1,
        support: {
          payments: [{ token: GDOLLAR, confirmed: 2, sent: 1, queued: 0, failed: 0, cancelled: 0 }],
          lines: [
            {
              token: GDOLLAR,
              confirmed: 7200n * G,
              sent: 40n * G,
              queued: 0n,
              failed: 0n,
              cancelled: 0n,
            },
          ],
        },
        memberPayments: {
          withheld: false,
          plans: 2,
          plansFinalized: 1,
          plansRevised: 1,
          payments: [{ token: GDOLLAR, confirmed: 3, sent: 0, queued: 3, failed: 0, cancelled: 0 }],
          declared: [{ token: GDOLLAR, amount: 120n * G }],
          declaredUnpaid: [{ token: GDOLLAR, amount: 60n * G }],
          lines: [
            {
              token: GDOLLAR,
              confirmed: 60n * G,
              sent: 0n,
              queued: 25n * G,
              failed: 0n,
              cancelled: 0n,
            },
          ],
        },
      },
    },
    ...overrides,
  };
}
