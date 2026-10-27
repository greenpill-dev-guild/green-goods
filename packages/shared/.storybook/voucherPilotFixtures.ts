import type { QueryKey } from "@tanstack/react-query";
import { commitmentPoolingKeys } from "../src/config/query-keys/commitment-pooling";
import { REHEARSAL_VOUCHER_ISSUERS } from "../src/modules/commitment-pooling/demo/demo-service-wallet";
import type {
  IssuerSafeThreshold,
  VoucherIssuer,
  VoucherIssuerApproval,
  VoucherWalletScope,
  VoucherWalletSnapshot,
} from "../src/modules/commitment-pooling/service-access-wallet-types";

/**
 * Storybook-only voucher pilot reads: fictional accounts, the working terms' two collective
 * issuers, and the lab's sample amounts. Seed them with `withSeededQueryClient`; nothing here
 * reads a chain or signs.
 */
export const VOUCHER_STORY_ISSUERS = REHEARSAL_VOUCHER_ISSUERS;
export const VOUCHER_STORY_SCOPE: VoucherWalletScope = {
  sourceChainId: 42161,
  coreModule: "0x000000000000000000000000000000000000f100",
  account: "0x000000000000000000000000000000000000f101",
};
const STORY_GARDEN = "0x000000000000000000000000000000000000f102" as const;
/** Pilot vouchers carry six decimals: one voucher is 1,000,000 base units. */
export const vouchers = (whole: number) => BigInt(Math.round(whole * 1_000_000));

export type VoucherWalletStoryState = "vouchers" | "booked" | "returnPending" | "empty";

/** The lab's SWallet states: holdings, a voucher a booking holds, and a return on its way. */
export function voucherWalletStory(state: VoucherWalletStoryState): VoucherWalletSnapshot {
  const { greenGoods, techAndSun } = VOUCHER_STORY_ISSUERS;
  const holding = (issuer: VoucherIssuer, whole: number) => ({ issuer, available: vouchers(whole) });
  const amounts = {
    vouchers: [9, 2],
    booked: [8, 2],
    returnPending: [0.99, 0],
    empty: [0, 0],
  }[state];
  const ref = (commitmentId: bigint, setup: string) => ({
    sourceChainId: VOUCHER_STORY_SCOPE.sourceChainId,
    coreModule: VOUCHER_STORY_SCOPE.coreModule,
    commitmentId,
    garden: STORY_GARDEN,
    setupId: `0x${setup.repeat(32)}` as const,
  });
  return {
    account: VOUCHER_STORY_SCOPE.account,
    evidence: "local-rehearsal",
    complete: true,
    reason: null,
    issuers: [techAndSun, greenGoods],
    holdings: [holding(techAndSun, amounts[0]!), holding(greenGoods, amounts[1]!)],
    bookings:
      state === "booked"
        ? [
            {
              booking: ref(1023n, "a1"),
              issuer: techAndSun.account,
              asset: techAndSun.asset,
              agreed: vouchers(1),
              held: vouchers(1),
              stage: "held",
            },
          ]
        : state === "returnPending"
          ? [
              {
                booking: ref(1027n, "c1"),
                issuer: greenGoods.account,
                asset: greenGoods.asset,
                agreed: vouchers(10),
                held: vouchers(6),
                stage: "settling",
              },
            ]
          : [],
    returns:
      state === "returnPending"
        ? [
            {
              booking: ref(1027n, "c1"),
              issuer: greenGoods.account,
              asset: greenGoods.asset,
              amount: vouchers(6),
              cause: "split",
              state: "pending",
              attempts: 0n,
            },
          ]
        : [],
  };
}

/** Green Goods' Safe takes 2 of 5; Tech and Sun's starts at 1 and moves to 2 of 3. */
export const VOUCHER_STORY_APPROVALS = {
  greenGoods: { kind: "safe", evidence: "local-rehearsal", threshold: 2, owners: 5 },
  techAndSunBootstrap: { kind: "safe", evidence: "local-rehearsal", threshold: 1, owners: 1 },
  techAndSunTwoOfThree: { kind: "safe", evidence: "local-rehearsal", threshold: 2, owners: 3 },
  unavailable: { kind: "unavailable", reason: "read-failed" },
} as const satisfies Record<string, VoucherIssuerApproval>;

/** Query seeds for the voucher wallet, the issuer approval and the Safe threshold reads. */
export function voucherStorySeeds(
  wallet: VoucherWalletSnapshot,
  approvals: Partial<Record<"greenGoods" | "techAndSun", VoucherIssuerApproval>> = {
    greenGoods: VOUCHER_STORY_APPROVALS.greenGoods,
    techAndSun: VOUCHER_STORY_APPROVALS.techAndSunBootstrap,
  }
): ReadonlyArray<readonly [QueryKey, unknown]> {
  const { sourceChainId, coreModule, account } = VOUCHER_STORY_SCOPE;
  return [
    [commitmentPoolingKeys.voucherWallet(sourceChainId, coreModule, account, false), wallet],
    ...Object.entries(approvals).flatMap(([id, approval]) => {
      const issuer = VOUCHER_STORY_ISSUERS[id as keyof typeof VOUCHER_STORY_ISSUERS];
      const { chainId } = issuer.asset;
      const safe: IssuerSafeThreshold =
        approval.kind === "safe"
          ? {
              safe: issuer.account,
              status: "observed",
              threshold: approval.threshold,
              owners: approval.owners,
            }
          : { safe: issuer.account, status: "unavailable", threshold: null, owners: null };
      return [
        [
          commitmentPoolingKeys.issuerApproval(chainId, issuer.account, issuer.kind, false),
          approval,
        ] as const,
        [commitmentPoolingKeys.issuerSafeThreshold(chainId, issuer.account), safe] as const,
      ];
    }),
  ];
}
