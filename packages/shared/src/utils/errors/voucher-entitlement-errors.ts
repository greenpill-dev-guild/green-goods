/**
 * What the reward module's refusals mean to the member, steward or issuer who hit one
 *
 * `VoucherEntitlementModule` holds a request's voucher reward (PRD-1322): the terms its issuer
 * approves, each side's agreement to them, and the payout once the promise is kept. Its errors
 * join the contract catalog in `contract-errors.ts`, which decodes them wherever an act fails.
 *
 * @module utils/errors/voucher-entitlement-errors
 */

import type { ErrorInfo } from "./contract-errors";

export const VOUCHER_ENTITLEMENT_ERRORS: Record<string, ErrorInfo> = {
  "0x51789899": {
    name: "VoucherConsentMissing",
    messageKey: "app.errors.contract.voucherEntitlement.voucherConsentMissing.message",
    message: "This promise has a reward to agree to first",
    actionKey: "app.errors.contract.voucherEntitlement.voucherConsentMissing.action",
    action: "Open the promise, agree to its reward, then take it up",
    recoverable: true,
  },
  "0x95154aeb": {
    name: "CreatorMustFreezeTerms",
    messageKey: "app.errors.contract.voucherEntitlement.creatorMustFreezeTerms.message",
    message: "This reward isn't ready to agree to yet",
    actionKey: "app.errors.contract.voucherEntitlement.creatorMustFreezeTerms.action",
    action: "Whoever made the promise agrees to it first. Try again later",
    recoverable: true,
    suggestedAction: "retry",
  },
  "0xee987070": {
    name: "IssuerApprovalRequired",
    messageKey: "app.errors.contract.voucherEntitlement.issuerApprovalRequired.message",
    message: "The voucher issuer hasn't approved this reward yet",
    actionKey: "app.errors.contract.voucherEntitlement.issuerApprovalRequired.action",
    action: "Try again once the issuer approves it",
    recoverable: true,
    suggestedAction: "retry",
  },
  "0x91611fdb": {
    name: "TermsNotPreAcceptance",
    messageKey: "app.errors.contract.voucherEntitlement.termsNotPreAcceptance.message",
    message: "This promise has already been taken up",
    actionKey: "app.errors.contract.voucherEntitlement.termsNotPreAcceptance.action",
    action: "Refresh to see where it stands",
    recoverable: false,
  },
  "0xebbb017b": {
    name: "WrongTermsRevision",
    messageKey: "app.errors.contract.voucherEntitlement.wrongTermsRevision.message",
    message: "The reward changed while you were reviewing it",
    actionKey: "app.errors.contract.voucherEntitlement.wrongTermsRevision.action",
    action: "Review the promise again before agreeing",
    recoverable: true,
    suggestedAction: "retry",
  },
  "0x117181ad": {
    name: "TermsFrozen",
    messageKey: "app.errors.contract.voucherEntitlement.termsFrozen.message",
    message: "This reward's terms are already fixed",
    recoverable: false,
  },
  "0x4115c9f8": {
    name: "VoucherPaused",
    messageKey: "app.errors.contract.voucherEntitlement.voucherPaused.message",
    message: "Voucher rewards are paused for now",
    actionKey: "app.errors.contract.voucherEntitlement.voucherPaused.action",
    action: "Try again later",
    recoverable: true,
    suggestedAction: "retry",
  },
  "0x53161799": {
    name: "NotIssuerAuthority",
    messageKey: "app.errors.contract.voucherEntitlement.notIssuerAuthority.message",
    message: "Only the voucher issuer's approver can approve this reward",
    recoverable: false,
    suggestedAction: "contact-support",
  },
  "0x7018ce37": {
    name: "InvalidVoucherTerms",
    messageKey: "app.errors.contract.voucherEntitlement.invalidVoucherTerms.message",
    message: "These reward terms aren't valid",
    recoverable: false,
    suggestedAction: "contact-support",
  },
  "0xb5eb9c75": {
    name: "NotVoucherSteward",
    messageKey: "app.errors.contract.voucherEntitlement.notVoucherSteward.message",
    message: "Only the pool's stewards can do this",
    recoverable: false,
  },
  "0x7ccc93cc": {
    name: "CommitmentNotFulfilled",
    messageKey: "app.errors.contract.voucherEntitlement.commitmentNotFulfilled.message",
    message: "The promise isn't confirmed as kept yet",
    recoverable: true,
  },
  "0xa4b42c00": {
    name: "DistributionAlreadyPrepared",
    messageKey: "app.errors.contract.voucherEntitlement.distributionAlreadyPrepared.message",
    message: "This reward's payout is already prepared",
    actionKey: "app.errors.contract.voucherEntitlement.distributionAlreadyPrepared.action",
    action: "Send it from the promise instead",
    recoverable: false,
  },
  "0xa54ce537": {
    name: "InsufficientTransportFee",
    messageKey: "app.errors.contract.voucherEntitlement.insufficientTransportFee.message",
    message: "Sending this reward needs a larger network fee",
    actionKey: "app.errors.contract.voucherEntitlement.insufficientTransportFee.action",
    action: "Add the fee and send again",
    recoverable: true,
    suggestedAction: "retry",
  },
  "0x62026aa0": {
    name: "InvalidVoucherAllocation",
    messageKey: "app.errors.contract.voucherEntitlement.invalidVoucherAllocation.message",
    message: "The reward's recipients don't match the promise's record",
    recoverable: false,
    suggestedAction: "contact-support",
  },
  "0xb4dc3f87": {
    name: "VoucherAlreadyDelivered",
    messageKey: "app.errors.contract.voucherEntitlement.voucherAlreadyDelivered.message",
    message: "This reward was already delivered",
    recoverable: false,
  },
  "0x16e9b066": {
    name: "UnknownVoucherEntitlement",
    messageKey: "app.errors.contract.voucherEntitlement.unknownVoucherEntitlement.message",
    message: "This reward's payout isn't on record",
    recoverable: false,
    suggestedAction: "contact-support",
  },
};
