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
    message: "This promise has a reward to agree to first",
    action: "Open the promise, agree to its reward, then take it up",
    recoverable: true,
  },
  "0x95154aeb": {
    name: "CreatorMustFreezeTerms",
    message: "This reward isn't ready to agree to yet",
    action: "Whoever made the promise agrees to it first. Try again later",
    recoverable: true,
    suggestedAction: "retry",
  },
  "0xee987070": {
    name: "IssuerApprovalRequired",
    message: "The voucher issuer hasn't approved this reward yet",
    action: "Try again once the issuer approves it",
    recoverable: true,
    suggestedAction: "retry",
  },
  "0x91611fdb": {
    name: "TermsNotPreAcceptance",
    message: "This promise has already been taken up",
    action: "Refresh to see where it stands",
    recoverable: false,
  },
  "0xebbb017b": {
    name: "WrongTermsRevision",
    message: "The reward changed while you were reviewing it",
    action: "Review the promise again before agreeing",
    recoverable: true,
    suggestedAction: "retry",
  },
  "0x117181ad": {
    name: "TermsFrozen",
    message: "This reward's terms are already fixed",
    recoverable: false,
  },
  "0x4115c9f8": {
    name: "VoucherPaused",
    message: "Voucher rewards are paused for now",
    action: "Try again later",
    recoverable: true,
    suggestedAction: "retry",
  },
  "0x53161799": {
    name: "NotIssuerAuthority",
    message: "Only the voucher issuer's approver can approve this reward",
    recoverable: false,
    suggestedAction: "contact-support",
  },
  "0x7018ce37": {
    name: "InvalidVoucherTerms",
    message: "These reward terms aren't valid",
    recoverable: false,
    suggestedAction: "contact-support",
  },
  "0xb5eb9c75": {
    name: "NotVoucherSteward",
    message: "Only the pool's stewards can do this",
    recoverable: false,
  },
  "0x7ccc93cc": {
    name: "CommitmentNotFulfilled",
    message: "The promise isn't confirmed as kept yet",
    recoverable: true,
  },
  "0xa4b42c00": {
    name: "DistributionAlreadyPrepared",
    message: "This reward's payout is already prepared",
    action: "Send it from the promise instead",
    recoverable: false,
  },
  "0xa54ce537": {
    name: "InsufficientTransportFee",
    message: "Sending this reward needs a larger network fee",
    action: "Add the fee and send again",
    recoverable: true,
    suggestedAction: "retry",
  },
  "0x62026aa0": {
    name: "InvalidVoucherAllocation",
    message: "The reward's recipients don't match the promise's record",
    recoverable: false,
    suggestedAction: "contact-support",
  },
  "0xb4dc3f87": {
    name: "VoucherAlreadyDelivered",
    message: "This reward was already delivered",
    recoverable: false,
  },
  "0x16e9b066": {
    name: "UnknownVoucherEntitlement",
    message: "This reward's payout isn't on record",
    recoverable: false,
    suggestedAction: "contact-support",
  },
};
