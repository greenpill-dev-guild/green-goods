import { parseAbi } from "viem";
import type { Address } from "../../types/domain";
import { logger } from "../app/logger";
import type { ServiceChainRead } from "./service-access-chain";
import { serviceAddress, serviceUint } from "./service-access-chain-values";
import type { PilotRewardItem } from "./service-access-pilot-types";
import type { ServiceAccessSnapshot } from "./service-access-types";
import type { ServiceVoucherSetup } from "./service-access-voucher-types";
import type {
  IssuerSafeThreshold,
  RequestRewardDelivery,
  VoucherBookingEscrow,
  VoucherBookingRef,
  VoucherHolding,
  VoucherIssuer,
  VoucherIssuerApproval,
  VoucherPendingReturn,
  VoucherWalletScope,
  VoucherWalletSnapshot,
  VoucherWalletUnavailableReason,
} from "./service-access-wallet-types";

const SAFE_ABI = parseAbi([
  "function getThreshold() view returns (uint256)",
  "function getOwners() view returns (address[])",
]);
/** A Safe's owner list is bounded in practice; a larger answer is not a Safe we can trust. */
const MAX_SAFE_OWNERS = 255;

function voucherBookingRef(setup: ServiceVoucherSetup): VoucherBookingRef {
  const a = setup.authorization;
  return {
    sourceChainId: a.sourceChainId,
    coreModule: a.coreModule,
    commitmentId: a.commitmentId,
    garden: a.providerGarden,
    setupId: setup.setupId,
  };
}

/** The destination result wins; a cancellation decided at the source shows before it arrives. */
function canceling(setup: ServiceVoucherSetup): boolean {
  return setup.source.decision === "abort" || setup.destination?.result.decision === "abort";
}

export function voucherBookingEscrow(setup: ServiceVoucherSetup): VoucherBookingEscrow {
  const base = {
    booking: voucherBookingRef(setup),
    issuer: setup.authorization.issuer,
    asset: setup.asset,
    agreed: setup.authorization.voucherUnits,
  };
  const d = setup.destination;
  if (!d) return { ...base, held: 0n, stage: canceling(setup) ? "closed" : "awaiting-approval" };
  const deposited = d.result.depositedUnits - d.result.setupRefundedUnits;
  if (d.result.phase === "aborted" || (deposited === 0n && canceling(setup)))
    return { ...base, held: 0n, stage: "closed" };
  if (d.result.phase === "none" || d.result.phase === "authorized")
    return {
      ...base,
      held: 0n,
      stage: d.result.issuerApproved ? "awaiting-deposit" : "awaiting-approval",
    };
  if (d.result.phase === "abort-refund-pending" || canceling(setup))
    return { ...base, held: deposited, stage: "returning" };
  const final = d.finalAllocation;
  if (!final) return { ...base, held: deposited, stage: "held" };
  const arrived =
    (final.release.state === "succeeded" ? final.allocation.releaseVoucherUnits : 0n) +
    (final.refund.state === "succeeded" ? final.allocation.refundVoucherUnits : 0n);
  return {
    ...base,
    held: deposited - arrived,
    stage: final.financiallyClosed ? "closed" : "settling",
  };
}

/** A return is pending until its transfer arrives; nothing is shown as back before then. */
export function voucherPendingReturn(setup: ServiceVoucherSetup): VoucherPendingReturn | null {
  const d = setup.destination;
  if (!d) return null;
  const base = {
    booking: voucherBookingRef(setup),
    issuer: setup.authorization.issuer,
    asset: setup.asset,
  };
  const final = d.finalAllocation;
  if (final) {
    const { state, attempts } = final.refund;
    return final.allocation.refundVoucherUnits > 0n && (state === "pending" || state === "failed")
      ? { ...base, amount: final.allocation.refundVoucherUnits, cause: "split", state, attempts }
      : null;
  }
  const deposited = d.result.depositedUnits - d.result.setupRefundedUnits;
  if (deposited === 0n || d.result.phase === "aborted" || !canceling(setup)) return null;
  return {
    ...base,
    amount: deposited,
    cause: "cancellation",
    state:
      d.result.phase === "abort-refund-pending" && !d.result.actionSucceeded ? "failed" : "pending",
    attempts: 0n,
  };
}

/** Holdings, escrow and returns for one account from the setups its bookings own. */
export function voucherWalletFromSetups(input: {
  scope: VoucherWalletScope;
  evidence: "onchain" | "local-rehearsal";
  complete: boolean;
  issuers: readonly VoucherIssuer[];
  balances: readonly { token: VoucherIssuer["asset"]["token"]; amount: bigint }[];
  setups: readonly ServiceVoucherSetup[];
}): VoucherWalletSnapshot {
  const holder = input.scope.account.toLowerCase();
  const own = input.setups.filter((setup) => setup.authorization.holder.toLowerCase() === holder);
  const holdings: VoucherHolding[] = input.issuers.map((issuer) => ({
    issuer,
    available:
      input.balances.find(
        (balance) => balance.token.toLowerCase() === issuer.asset.token.toLowerCase()
      )?.amount ?? 0n,
  }));
  return {
    account: input.scope.account,
    evidence: input.evidence,
    complete: input.complete,
    reason: null,
    issuers: input.issuers,
    holdings,
    bookings: own.map(voucherBookingEscrow).filter((escrow) => escrow.stage !== "closed"),
    returns: own.flatMap((setup) => voucherPendingReturn(setup) ?? []),
  };
}

function unavailableVoucherWallet(
  scope: VoucherWalletScope,
  reason: VoucherWalletUnavailableReason
): VoucherWalletSnapshot {
  return {
    account: scope.account,
    evidence: "unavailable",
    complete: false,
    reason,
    issuers: [],
    holdings: [],
    bookings: [],
    returns: [],
  };
}

/** No account-wide booking projection exists before the deployment is adopted (gap 12). */
export async function readLiveVoucherWallet(
  scope: VoucherWalletScope
): Promise<VoucherWalletSnapshot> {
  return unavailableVoucherWallet(scope, "routes-unconfigured");
}

/** A Safe's threshold and owner count; null when the read fails or the answer is impossible. */
async function readSafeRule(
  read: ServiceChainRead,
  chainId: number,
  safe: Address
): Promise<{ threshold: number; owners: number } | null> {
  const call = (functionName: "getThreshold" | "getOwners") =>
    read({ chainId, address: safe, abi: SAFE_ABI, functionName });
  try {
    const [rawThreshold, rawOwners] = await Promise.all([call("getThreshold"), call("getOwners")]);
    const threshold = serviceUint(rawThreshold);
    if (!Array.isArray(rawOwners) || rawOwners.length > MAX_SAFE_OWNERS)
      throw new Error("Malformed Safe owner list");
    const owners = new Set(rawOwners.map(serviceAddress)).size;
    if (owners !== rawOwners.length || threshold < 1n || threshold > BigInt(owners))
      throw new Error("Safe threshold outside its owners");
    return { threshold: Number(threshold), owners };
  } catch (error) {
    logger.warn("Issuer Safe threshold read failed", { error, safe });
    return null;
  }
}

/** An issuer Safe's signature rule in the console's contract: a count only when observed. */
export async function readIssuerSafeThreshold(
  read: ServiceChainRead,
  chainId: number,
  safe: Address
): Promise<IssuerSafeThreshold> {
  const rule = await readSafeRule(read, chainId, safe);
  return rule
    ? { safe, status: "observed", ...rule }
    : { safe, status: "unavailable", threshold: null, owners: null };
}

/** The signature count comes from the Safe itself; a member issuer approves from its own account. */
export async function readVoucherIssuerApproval(
  read: ServiceChainRead,
  issuer: Pick<VoucherIssuer, "account" | "kind" | "asset">
): Promise<VoucherIssuerApproval> {
  if (issuer.kind === "individual") return { kind: "account", evidence: "onchain" };
  const rule = await readSafeRule(read, issuer.asset.chainId, issuer.account);
  return rule
    ? { kind: "safe", evidence: "onchain", ...rule }
    : { kind: "unavailable", reason: "read-failed" };
}

function rewardDelivery(
  item: PilotRewardItem,
  workFulfilled: boolean,
  inventory: NonNullable<ServiceAccessSnapshot["pilot"]>["inventory"]
): RequestRewardDelivery {
  const voucher = item.paymentMethod === "issuer-reserve-allowance";
  const sameToken = inventory.asset.token.toLowerCase() === item.asset.token.toLowerCase();
  const shortOf =
    voucher && sameToken && item.state !== "delivered"
      ? inventory.reserve < item.amount
        ? "reserve"
        : inventory.allowance < item.amount
          ? "allowance"
          : null
      : null;
  const status: RequestRewardDelivery["status"] = !workFulfilled
    ? "after-work"
    : item.state === "delivered"
      ? "received"
      : shortOf
        ? "waiting"
        : item.state === "failed"
          ? "delayed"
          : "on-the-way";
  return {
    id: item.id,
    kind: voucher ? "voucher" : "gd",
    asset: item.asset,
    amount: item.amount,
    funder: item.funder,
    status,
    shortOf: status === "waiting" ? shortOf : null,
    receipt: item.receipt,
    attempts: item.attempts,
  };
}

/** Each reward on its own. Null where no delivery read exists for this request yet. */
export function requestRewardDeliveries(
  snapshot: ServiceAccessSnapshot
): RequestRewardDelivery[] | null {
  const pilot = snapshot.pilot;
  const reward = pilot?.reward;
  if (!pilot || !reward) return null;
  return [reward.voucher, reward.gd].flatMap((item) =>
    item ? [rewardDelivery(item, reward.workFulfilled, pilot.inventory)] : []
  );
}
