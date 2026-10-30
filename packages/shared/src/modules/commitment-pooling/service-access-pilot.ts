import type { ServiceAccessPilotAction } from "./service-access-pilot-types";
import type {
  ServiceAccessActionAvailability,
  ServiceAccessSnapshot,
} from "./service-access-types";

export function isPilotAction(action: { action: string }): action is ServiceAccessPilotAction {
  return [
    "observePilotRole",
    "deliverPilotReward",
    "acknowledgePilotReward",
    "quotePilotExchange",
    "approvePilotExchange",
    "executePilotExchange",
    "resolvePilotExchange",
  ].includes(action.action);
}

/** What the rehearsal's exchange quotes unless a short pool asked for less. */
export const PILOT_EXCHANGE_INPUT = 2_044_986n;

/** The local role simulator cannot lift the production account or deployment gate. */
export function selectPilotAction(
  s: ServiceAccessSnapshot,
  a: ServiceAccessPilotAction
): ServiceAccessActionAvailability {
  const p = s.pilot;
  const reject = () => ({ allowed: false, reason: "pilot-action-unavailable" });
  if (
    !p ||
    p.evidence !== "local-rehearsal" ||
    s.evidence !== "local-rehearsal" ||
    s.capabilities.mutation !== "local-rehearsal" ||
    s.capabilities.reasons.includes("offline") ||
    !s.capabilities.canSignSource ||
    s.capabilities.sourceBuyer.toLowerCase() !== s.key.buyer.toLowerCase()
  )
    return reject();
  if (
    ["quotePilotExchange", "approvePilotExchange", "executePilotExchange"].includes(a.action) &&
    (!s.capabilities.canSignHolder ||
      !s.capabilities.canSendDestination ||
      s.capabilities.gnosisHolder?.toLowerCase() !== s.key.buyer.toLowerCase())
  )
    return reject();
  const row = s.voucherSetups.find((r) => r.setupId === s.currentVoucherSetupId);
  switch (a.action) {
    case "observePilotRole":
      if (a.observation === "work-fulfilled")
        return p.reward && !p.reward.workFulfilled ? { allowed: true, reason: null } : reject();
      if (a.observation === "voucher-budget-repaired")
        return p.reward && p.reward.voucher.state !== "delivered"
          ? { allowed: true, reason: null }
          : reject();
      if (!row?.destination) return reject();
      if (a.observation === "issuer-approved")
        return row.destination.result.phase === "authorized" &&
          !row.destination.result.issuerApproved
          ? { allowed: true, reason: null }
          : reject();
      if (a.observation === "deposit-acknowledged")
        return row.destination.result.phase === "deposited" &&
          row.source.setupResult?.depositedUnits !== row.authorization.voucherUnits
          ? { allowed: true, reason: null }
          : reject();
      if (a.observation === "provider-accepted")
        return s.coreState === "OFFERED" &&
          s.consent?.state === "pending" &&
          row.source.setupResult?.depositedUnits === row.authorization.voucherUnits &&
          row.source.setupResult.issuerApproved
          ? { allowed: true, reason: null }
          : reject();
      return reject();
    case "deliverPilotReward": {
      const item = p.reward?.[a.asset];
      return p.reward?.workFulfilled &&
        item &&
        item.state !== "delivered" &&
        (a.asset === "gd" ||
          (s.pause.sourceVoucher === false && s.pause.destinationVoucher === false))
        ? { allowed: true, reason: null }
        : reject();
    }
    case "acknowledgePilotReward": {
      const item = p.reward?.[a.asset];
      return item?.state === "delivered" && item.acknowledgment === "pending"
        ? { allowed: true, reason: null }
        : reject();
    }
    case "quotePilotExchange":
      return (a.input ?? PILOT_EXCHANGE_INPUT) > 0n &&
        p.holdings.a >= (a.input ?? PILOT_EXCHANGE_INPUT) &&
        p.holdings.b < p.service.voucherUnits &&
        p.exchange.status !== "unknown"
        ? { allowed: true, reason: null }
        : reject();
    case "resolvePilotExchange":
      return p.exchange.status === "unknown" && p.exchange.receipt
        ? { allowed: true, reason: null }
        : reject();
    case "approvePilotExchange":
      return p.exchange.status === "quoted" && p.exchange.quote?.id === a.expectedQuoteId
        ? { allowed: true, reason: null }
        : reject();
    case "executePilotExchange": {
      const q = p.exchange.quote;
      return p.exchange.status === "quoted" &&
        q &&
        Object.keys(q).every((k) => q[k as keyof typeof q] === a.quote[k as keyof typeof q]) &&
        q.holder.toLowerCase() === s.key.buyer.toLowerCase() &&
        q.minimumOutput > 0n
        ? { allowed: true, reason: null }
        : reject();
    }
  }
}
