import type { Address } from "../../../types/domain";
import type { ServiceAccessSnapshot } from "../service-access-types";
import { voucherWalletFromSetups } from "../service-access-wallet";
import type {
  IssuerSafeThreshold,
  VoucherIssuer,
  VoucherIssuerApproval,
  VoucherWalletScope,
  VoucherWalletSnapshot,
} from "../service-access-wallet-types";
import { DEMO_GARDEN } from "./demo-builders";
import { PILOT_ASSETS, PILOT_ISSUERS, type PilotLedger } from "./demo-service-pilot";

/**
 * The pilot's two collective issuers under the working terms, on fictional addresses. Asset a
 * stands for Green Goods vouchers and asset b for Tech and Sun's; no deployment is asserted.
 */
export const REHEARSAL_VOUCHER_ISSUERS: Readonly<
  Record<"greenGoods" | "techAndSun", VoucherIssuer>
> = {
  greenGoods: {
    account: PILOT_ISSUERS.a,
    kind: "collective",
    name: "Green Goods",
    gender: "masculine",
    asset: PILOT_ASSETS.a,
    garden: DEMO_GARDEN,
    standing: { bookings: "open", exchange: "listed" },
  },
  techAndSun: {
    account: PILOT_ISSUERS.b,
    kind: "collective",
    name: "Tech and Sun",
    gender: "feminine",
    asset: PILOT_ASSETS.b,
    garden: DEMO_GARDEN,
    standing: { bookings: "open", exchange: "listed" },
  },
};

/** Green Goods' Safe takes two of five; Tech and Sun's starts with its one bootstrap signer. */
const REHEARSAL_SAFES: Readonly<Record<Address, { threshold: number; owners: number }>> = {
  [PILOT_ISSUERS.a]: { threshold: 2, owners: 5 },
  [PILOT_ISSUERS.b]: { threshold: 1, owners: 1 },
};

/** As the live read: an individual approves from its own account; a collective, by its Safe. */
export function rehearsalIssuerApproval(
  issuer: Pick<VoucherIssuer, "account" | "kind">
): VoucherIssuerApproval {
  if (issuer.kind === "individual") return { kind: "account", evidence: "local-rehearsal" };
  const rule = REHEARSAL_SAFES[issuer.account.toLowerCase() as Address];
  return rule
    ? { kind: "safe", evidence: "local-rehearsal", ...rule }
    : { kind: "unavailable", reason: "unconfigured" };
}

/** The same Safes in the console's contract: observed for the pilot's two, unread otherwise. */
export function rehearsalIssuerSafeThreshold(safe: Address): IssuerSafeThreshold {
  const rule = REHEARSAL_SAFES[safe.toLowerCase() as Address];
  return rule
    ? { safe, status: "observed", ...rule }
    : { safe, status: "unavailable", threshold: null, owners: null };
}

/** Holdings come from the shared ledger; escrow and returns from the account's own setups. */
export function rehearsalVoucherWallet(
  scope: VoucherWalletScope,
  ledger: PilotLedger,
  snapshots: readonly ServiceAccessSnapshot[]
): VoucherWalletSnapshot {
  return voucherWalletFromSetups({
    scope,
    evidence: "local-rehearsal",
    complete: true,
    issuers: Object.values(REHEARSAL_VOUCHER_ISSUERS),
    balances: [
      { token: PILOT_ASSETS.a.token, amount: ledger.holdings.a },
      { token: PILOT_ASSETS.b.token, amount: ledger.holdings.b },
    ],
    setups: snapshots.flatMap((snapshot) => snapshot.voucherSetups),
  });
}
