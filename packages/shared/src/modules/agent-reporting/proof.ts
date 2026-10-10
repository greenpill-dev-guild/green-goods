/**
 * The single-use account proof for agent reporting ceremonies.
 *
 * Distinct from the garden-join proof: it binds the browser's nonce, the challenge, its purpose,
 * the canonical origin and audience, the chat source, the resource digest and identity epoch, so a
 * proof made for one request, browser, channel or deployment cannot be redeemed for another. The
 * Agent never accepts these fields from the browser; it rebuilds the message from its own record.
 */
export const REPORTING_PROOF_AUDIENCE = "green-goods-agent-reporting";

export type ReportingPurpose =
  | "link_account"
  | "publish_work"
  | "review_decision"
  | "grant_reporting"
  | "grant_review"
  | "recovery";

export interface ReportingProofFields {
  purpose: ReportingPurpose;
  challengeId: string;
  browserNonce: string;
  origin: string;
  chainId: number;
  providerRealm: string;
  /** Source channel binding, or `subject:<digest>` before a binding exists. */
  source: string;
  resourceDigest: string;
  identityEpoch: number;
  issuedAt: string;
  expiresAt: string;
}

function line(value: string): string {
  return value.replace(/[\r\n]+/g, " ");
}

export function buildReportingProofMessage(fields: ReportingProofFields, account: string): string {
  return [
    "Green Goods wants you to verify this account for agent reporting.",
    "This proves you control the account. It does not publish anything or move funds.",
    "",
    `Purpose: ${fields.purpose}`,
    `Account: ${account.toLowerCase()}`,
    `Chain ID: ${fields.chainId}`,
    `Origin: ${line(fields.origin)}`,
    `Audience: ${REPORTING_PROOF_AUDIENCE}`,
    `Challenge: ${line(fields.challengeId)}`,
    `Browser nonce: ${line(fields.browserNonce)}`,
    `Chat realm: ${line(fields.providerRealm)}`,
    `Chat source: ${line(fields.source)}`,
    `Resource: ${line(fields.resourceDigest)}`,
    `Identity epoch: ${fields.identityEpoch}`,
    `Issued at: ${fields.issuedAt}`,
    `Expires at: ${fields.expiresAt}`,
  ].join("\n");
}
