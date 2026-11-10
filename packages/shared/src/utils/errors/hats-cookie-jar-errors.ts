/**
 * What a Hats-managed garden jar's refusals mean to the steward who hit one
 *
 * A Hats jar (PRD-1448) checks the signer's Steward or Owner Hat and its own payout policy before
 * a limit, policy, pause or recovery changes. Its errors join the contract catalog in
 * `contract-errors.ts`. The signer's own refusal, a review the jar has moved past since it
 * opened, is named here too, so both read in the steward's language.
 *
 * @module utils/errors/hats-cookie-jar-errors
 */

import type { ErrorInfo, ParsedContractError } from "./contract-errors";

const REFUSED_TITLE_KEY = "app.errors.hatsJar.refused.title";
const POLICY_CHANGED = {
  message: "The pending policy changed while you were reviewing it",
  messageKey: "app.errors.hatsJar.policyChanged.message",
};
/** The same review is refused again, so the steward reopens it with what the jar holds now. */
const OUT_OF_DATE = {
  titleKey: "app.errors.hatsJar.outOfDate.title",
  action: "Close the review and open it again with the current details",
  actionKey: "app.errors.hatsJar.outOfDate.action",
  recoverable: false,
};
const NEEDS_WEARER = {
  titleKey: REFUSED_TITLE_KEY,
  action: "Switch to an account that holds the required Hat",
  actionKey: "app.errors.hatsJar.wearer.action",
  recoverable: false,
  suggestedAction: "check-wallet",
} as const;
const TOO_MUCH = {
  titleKey: REFUSED_TITLE_KEY,
  action: "Try a smaller amount",
  actionKey: "app.errors.hatsJar.smallerAmount.action",
  recoverable: false,
};

export const HATS_COOKIE_JAR_ERRORS: Record<string, ErrorInfo> = {
  // GreenGoodsENS declares NotOwner() too; the app never calls the release that raises it.
  "0x30cd7471": {
    name: "NotOwner",
    message: "Only the Owner Hat can do this",
    messageKey: "app.errors.hatsJar.notOwner.message",
    ...NEEDS_WEARER,
  },
  "0x7c214f04": {
    name: "NotOperator",
    message: "Only a Steward or Owner Hat can do this",
    messageKey: "app.errors.hatsJar.notStewardOrOwner.message",
    ...NEEDS_WEARER,
  },
  "0xd06b96b1": {
    name: "InvalidPolicy",
    titleKey: REFUSED_TITLE_KEY,
    message: "The jar can't use this policy",
    messageKey: "app.errors.hatsJar.invalidPolicy.message",
    action:
      "Use a ceiling and minimum wait above zero, and a recovery recipient that isn't the garden or the jar",
    actionKey: "app.errors.hatsJar.invalidPolicy.action",
    recoverable: false,
  },
  "0x75996105": {
    name: "InvalidOperationalLimits",
    titleKey: REFUSED_TITLE_KEY,
    message: "These limits are outside the jar's policy",
    messageKey: "app.errors.hatsJar.invalidOperationalLimits.message",
    action: "Keep the per-claim limit within the ceiling and the wait at or above the minimum",
    actionKey: "app.errors.hatsJar.invalidOperationalLimits.action",
    recoverable: false,
  },
  // PolicyNotReady(uint256 readyAt)
  "0xb667e963": {
    name: "PolicyNotReady",
    titleKey: REFUSED_TITLE_KEY,
    message: "This policy can't be applied yet",
    messageKey: "app.errors.hatsJar.policyNotReady.message",
    action: "Try again after the time shown on the pending policy",
    actionKey: "app.errors.hatsJar.policyNotReady.action",
    recoverable: true,
    suggestedAction: "retry",
  },
  "0x8e8ffa98": { name: "UnexpectedPolicy", ...POLICY_CHANGED, ...OUT_OF_DATE },
  "0x7cba1f10": {
    name: "ProposerNoLongerOwner",
    titleKey: REFUSED_TITLE_KEY,
    message: "Whoever proposed this policy no longer holds the Owner Hat",
    messageKey: "app.errors.hatsJar.proposerNoLongerOwner.message",
    action: "Cancel it, then propose it again",
    actionKey: "app.errors.hatsJar.proposerNoLongerOwner.action",
    recoverable: false,
  },
  "0x8ac4bc73": {
    name: "InsufficientCredit",
    message: "This is more than the jar's payout funds",
    messageKey: "app.errors.hatsJar.insufficientCredit.message",
    ...TOO_MUCH,
  },
  "0x94290ab9": {
    name: "InsufficientSurplus",
    message: "This is more than the jar's uncredited funds",
    messageKey: "app.errors.hatsJar.insufficientSurplus.message",
    ...TOO_MUCH,
  },
};

/** What changed on chain between a jar review and its signature. */
export type JarReviewChange = "recipient" | "pendingPolicy" | "jarOrHat";

const REVIEW_CHANGES: Record<
  JarReviewChange,
  { name: string; message: string; messageKey: string }
> = {
  recipient: {
    name: "JarRecipientChanged",
    message: "The recovery recipient changed while you were reviewing it",
    messageKey: "app.errors.hatsJar.recipientChanged.message",
  },
  pendingPolicy: { name: "JarPendingPolicyChanged", ...POLICY_CHANGED },
  jarOrHat: {
    name: "JarOrHatChanged",
    message: "The jar or your Hat changed while you were reviewing it",
    messageKey: "app.errors.hatsJar.jarOrHatChanged.message",
  },
};

/**
 * The signer refused a reviewed jar action before asking for a signature, because the jar no
 * longer holds what the review showed. Nothing was signed or sent.
 */
export class JarReviewChangedError extends Error {
  constructor(readonly change: JarReviewChange) {
    super(REVIEW_CHANGES[change].message);
    this.name = "JarReviewChangedError";
  }
}

export function jarReviewChangedFailure(error: JarReviewChangedError): ParsedContractError {
  const { name, message, messageKey } = REVIEW_CHANGES[error.change];
  return { raw: message, name, message, messageKey, ...OUT_OF_DATE, isKnown: true };
}
