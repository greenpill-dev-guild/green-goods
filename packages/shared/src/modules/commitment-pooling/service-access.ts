import { isAddress, maxUint256 } from "viem";
import type { GoodDollarFeeQuote } from "../wallet/good-dollar-fees";
import { isPilotAction, selectPilotAction } from "./service-access-pilot";
import type {
  ServiceAccessAction,
  ServiceAccessActionAvailability,
  ServiceAccessActionKind,
  ServiceAccessSnapshot,
} from "./service-access-types";
import { selectVoucherSetupAction, voucherSetupAvailableActions } from "./service-access-voucher";

const MAX_NONCE = (1n << 64n) - 1n;
const ZERO_ADDRESS = /^0x0{40}$/i;
const TERMINAL = new Set(["CANCELLED", "EXPIRED", "DISPUTED"]);
const BEFORE_ACCEPTANCE = new Set(["OFFERED", "REQUESTED"]);

function account(value: string): boolean {
  return isAddress(value) && !ZERO_ADDRESS.test(value);
}

function equal(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function positive(value: bigint): boolean {
  return value > 0n && value <= maxUint256;
}

/** Shared with the current wallet quote vocabulary; no price conversion is inferred. */
function sameServiceFeeQuote(left: GoodDollarFeeQuote, right: GoodDollarFeeQuote): boolean {
  return (
    positive(left.amount) &&
    left.fee >= 0n &&
    left.fee <= maxUint256 &&
    left.totalDebit <= maxUint256 &&
    positive(left.recipientAmount) &&
    left.totalDebit === (left.senderPays ? left.amount + left.fee : left.amount) &&
    left.recipientAmount === (left.senderPays ? left.amount : left.amount - left.fee) &&
    left.amount === right.amount &&
    left.fee === right.fee &&
    left.senderPays === right.senderPays &&
    left.totalDebit === right.totalDebit &&
    left.recipientAmount === right.recipientAmount
  );
}

/**
 * A member agrees to a request's voucher reward from their own account before taking it up: the
 * issuer approved the terms and the creator's agreement froze them. Only an individual claim's
 * member is the claimant; a garden claim's account must agree for itself (PRD-1322).
 */
function earnedConsentOffered(snapshot: ServiceAccessSnapshot): boolean {
  const earned = snapshot.acceptancePolicy.earned;
  return (
    snapshot.evidence === "onchain" &&
    snapshot.capabilities.mutation === "onchain" &&
    !snapshot.capabilities.reasons.includes("offline") &&
    earned.status === "bound" &&
    earned.revision !== null &&
    earned.termsHash !== null &&
    earned.terms?.issuerApproved === true &&
    earned.terms.frozen &&
    earned.modulePaused === false &&
    earned.claimType === "individual" &&
    BEFORE_ACCEPTANCE.has(snapshot.coreState ?? "") &&
    snapshot.pause.core === false &&
    snapshot.capabilities.canSignSource &&
    equal(snapshot.key.buyer, snapshot.capabilities.sourceBuyer) &&
    (!snapshot.knownService || snapshot.eligibleBuyerGardens.length > 0) &&
    earned.creator !== null &&
    !equal(earned.creator, snapshot.key.buyer) &&
    earned.viewerConsentRevision !== earned.revision
  );
}

/** Presentation asks this same table; exact submitted amounts are checked below. */
export function serviceAccessAvailableActions(
  snapshot: ServiceAccessSnapshot
): ServiceAccessActionKind[] {
  const earnedActions: ServiceAccessActionKind[] = earnedConsentOffered(snapshot)
    ? ["consentEarnedTerms"]
    : [];
  const recoveryActions = [
    ...snapshot.voucherSetups.flatMap((setup) => voucherSetupAvailableActions(snapshot, setup)),
    ...earnedActions,
  ];
  if (
    !["local-rehearsal", "onchain"].includes(snapshot.evidence) ||
    !snapshot.complete ||
    snapshot.capabilities.reasons.includes("offline") ||
    snapshot.capabilities.mutation !== snapshot.evidence ||
    !snapshot.offer ||
    snapshot.mode === "unavailable" ||
    snapshot.mode === "legacy" ||
    snapshot.mode !== snapshot.offer.route
  )
    return recoveryActions;
  const actions: ServiceAccessActionKind[] = [];
  const sourceSigner =
    snapshot.capabilities.canSignSource &&
    equal(snapshot.key.buyer, snapshot.capabilities.sourceBuyer);
  const { consent, personalPurchase: purchase } = snapshot;
  const currentConsent =
    consent?.revision === snapshot.offer.revision && consent.termsHash === snapshot.offer.termsHash;
  if (snapshot.coreState === "OFFERED" && sourceSigner) {
    if (
      snapshot.pause.core === false &&
      snapshot.eligibleBuyerGardens.length > 0 &&
      snapshot.nextRequestNonce > 0n &&
      snapshot.nextRequestNonce <= MAX_NONCE &&
      (snapshot.acceptancePolicy.earned.status !== "bound" ||
        (snapshot.acceptancePolicy.earned.modulePaused === false &&
          snapshot.acceptancePolicy.earned.claimType === "individual" &&
          snapshot.acceptancePolicy.earned.revision !== null &&
          snapshot.acceptancePolicy.earned.viewerConsentRevision ===
            snapshot.acceptancePolicy.earned.revision)) &&
      (!consent ||
        consent.state === "withdrawn" ||
        consent.state === "declined" ||
        consent.state === "inactive")
    )
      actions.push("requestClaim");
    if (consent?.state === "pending") {
      actions.push("withdrawClaim");
      const renewedFunding =
        purchase &&
        (purchase.state === "withdrawn" || purchase.state === "refunded") &&
        purchase.requestNonce < consent.requestNonce;
      if (snapshot.mode === "personal-gd" && (!purchase || renewedFunding) && currentConsent)
        actions.push("pledgePersonal");
    }
  }
  if (
    snapshot.mode === "personal-gd" &&
    purchase?.state === "pledged" &&
    purchase.outcome === "none" &&
    purchase.paymentObservation === "none" &&
    (consent?.state === "pending" || consent?.state === "accepted") &&
    currentConsent &&
    purchase.claimHash === consent.claimHash &&
    purchase.requestNonce === consent.requestNonce &&
    snapshot.capabilities.canSignCelo &&
    equal(purchase.authorizedDepositor, snapshot.capabilities.celoDepositor ?? "") &&
    !TERMINAL.has(snapshot.coreState ?? "")
  )
    actions.push("payPersonal");
  if (
    snapshot.mode === "voucher" &&
    snapshot.coreState === "OFFERED" &&
    consent?.state === "pending" &&
    currentConsent &&
    sourceSigner &&
    snapshot.pause.core === false &&
    snapshot.pause.sourceVoucher === false &&
    snapshot.sourceTimestamp !== null &&
    !snapshot.currentVoucherSetupId
  )
    actions.push("prepareVoucherSetup");
  for (const setup of snapshot.voucherSetups)
    actions.push(...voucherSetupAvailableActions(snapshot, setup));
  actions.push(...earnedActions);
  return [...new Set(actions)];
}

/** Callers re-read their adapter before applying this exact reviewed payload. */
export function selectServiceAccessAction(
  snapshot: ServiceAccessSnapshot,
  action: ServiceAccessAction
): ServiceAccessActionAvailability {
  const reject = (reason: string): ServiceAccessActionAvailability => ({ allowed: false, reason });
  if (isPilotAction(action)) return selectPilotAction(snapshot, action);
  if (!serviceAccessAvailableActions(snapshot).includes(action.action))
    return reject("action-unavailable");
  if (action.action === "consentEarnedTerms") {
    const earned = snapshot.acceptancePolicy.earned;
    return action.expectedRevision === earned.revision &&
      equal(action.expectedTermsHash, earned.termsHash ?? "")
      ? { allowed: true, reason: null }
      : reject("terms-changed");
  }
  if ("setupId" in action || action.action === "prepareVoucherSetup")
    return selectVoucherSetupAction(snapshot, action);
  const { offer, consent, personalPurchase: purchase } = snapshot;
  if (!offer) return reject("authoritative-view-unconfigured");
  if (
    consent &&
    action.action !== "requestClaim" &&
    action.action !== "withdrawClaim" &&
    (consent.revision !== offer.revision || !equal(consent.termsHash, offer.termsHash))
  )
    return reject("terms-changed");
  switch (action.action) {
    case "requestClaim": {
      if (
        (snapshot.pilot || snapshot.capabilities.mutation === "onchain") &&
        snapshot.mode === "voucher" &&
        !equal(action.voucherHolder, snapshot.key.buyer)
      )
        return reject("holder-mismatch");
      if (
        action.expectedRevision !== offer.revision ||
        !equal(action.expectedTermsHash, offer.termsHash)
      )
        return reject("terms-changed");
      if (
        action.requestNonce <= 0n ||
        action.requestNonce !== snapshot.nextRequestNonce ||
        action.requestNonce > MAX_NONCE
      )
        return reject("nonce-changed");
      if (
        !snapshot.eligibleBuyerGardens.some((garden) => equal(garden.address, action.buyerGarden))
      )
        return reject("buyer-garden-unavailable");
      if (
        snapshot.mode === "personal-gd"
          ? !ZERO_ADDRESS.test(action.voucherHolder)
          : !account(action.voucherHolder)
      )
        return reject("holder-mismatch");
      break;
    }
    case "withdrawClaim":
      if (!consent || !equal(action.expectedClaimHash, consent.claimHash))
        return reject("consent-changed");
      break;
    case "pledgePersonal":
      if (!consent || !equal(action.expectedClaimHash, consent.claimHash))
        return reject("consent-changed");
      if (!account(action.authorizedDepositor) || !account(action.refundAccount))
        return reject("invalid-account");
      if (
        !snapshot.personalPaymentAccount ||
        equal(action.refundAccount, snapshot.personalPaymentAccount.custodySafe)
      )
        return reject("invalid-refund-account");
      if (
        !snapshot.personalFeeQuote ||
        !sameServiceFeeQuote(action.reviewedFee, snapshot.personalFeeQuote) ||
        action.reviewedFee.recipientAmount < offer.gdPrice
      )
        return reject("fee-changed");
      break;
    case "payPersonal":
      if (!purchase || !equal(action.purchaseId, purchase.purchaseId))
        return reject("purchase-changed");
      if (
        !consent ||
        purchase.claimHash !== consent.claimHash ||
        purchase.requestNonce !== consent.requestNonce ||
        purchase.termsRevision !== offer.revision ||
        purchase.termsHash !== offer.termsHash
      )
        return reject("consent-changed");
      if (!equal(purchase.authorizedDepositor, snapshot.capabilities.celoDepositor ?? ""))
        return reject("depositor-unavailable");
      if (
        !snapshot.personalFeeQuote ||
        !sameServiceFeeQuote(action.reviewedFee, snapshot.personalFeeQuote) ||
        action.reviewedFee.totalDebit > purchase.disclosedGrossAmount ||
        action.reviewedFee.recipientAmount !== purchase.disclosedNetAmount
      )
        return reject("fee-changed");
      break;
  }
  return { allowed: true, reason: null };
}
