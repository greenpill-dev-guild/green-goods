import type { Address } from "../../../types/domain";
import type { ServiceAccessSnapshot } from "../service-access-types";
import { voucherWalletFromSetups } from "../service-access-wallet";
import type {
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
  },
  techAndSun: {
    account: PILOT_ISSUERS.b,
    kind: "collective",
    name: "Tech and Sun",
    gender: "feminine",
    asset: PILOT_ASSETS.b,
    garden: DEMO_GARDEN,
  },
};

/** Green Goods' Safe takes two of five; Tech and Sun's starts with its one bootstrap signer. */
const REHEARSAL_APPROVALS: Readonly<Record<Address, VoucherIssuerApproval>> = {
  [PILOT_ISSUERS.a]: { kind: "safe", evidence: "local-rehearsal", threshold: 2, owners: 5 },
  [PILOT_ISSUERS.b]: { kind: "safe", evidence: "local-rehearsal", threshold: 1, owners: 1 },
};

export function rehearsalIssuerApproval(account: Address): VoucherIssuerApproval {
  return (
    REHEARSAL_APPROVALS[account.toLowerCase() as Address] ?? {
      kind: "unavailable",
      reason: "unconfigured",
    }
  );
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
