import { concat, hashTypedData, keccak256, type Hex, type TypedDataDefinition } from "viem";
import { issuerDigest, issuerSame } from "./service-issuer-metadata";
import type { ServiceIssuerProvenance } from "./service-issuer-types";
import type {
  ServiceIssuerDraft,
  ServiceIssuerSignedApproval,
} from "../../public-contracts/service-issuer-desk";
const APPROVAL_CHAIN_ID = 100;
const text = (value: string) => value.normalize("NFC");

/**
 * The terms in one fixed order, so the same settings always produce the same digest however the
 * draft was assembled. The member and the draft identity are part of what is signed.
 */
function canonicalTerms(draft: ServiceIssuerDraft) {
  const t = draft.terms;
  return {
    version: 1,
    draft: text(draft.id),
    member: draft.member.toLowerCase(),
    sourceChainId: draft.sourceChainId,
    revision: t.revision,
    service: [
      t.service.title,
      t.service.buys,
      t.service.scope,
      t.service.remedy,
      t.service.unit,
    ].map(text),
    token: [text(t.token.name), text(t.token.symbol), t.token.decimals],
    capacity: [t.capacity.units, t.capacity.weeks],
    issue: [t.issue.total, t.issue.pool],
    rewardAllowance: t.rewardAllowance,
    poolHoldingCap: t.poolHoldingCap,
    priceIndex: t.priceIndex,
    poolFee: t.poolFee,
    replyBusinessDays: t.replyBusinessDays,
    acceptanceDays: t.acceptanceDays,
    document: [text(t.document.reference), t.document.digest.toLowerCase()],
    ...(t.exchangePool
      ? {
          exchangePool: [
            t.exchangePool.chainId,
            text(t.exchangePool.id),
            t.exchangePool.address.toLowerCase(),
          ],
        }
      : {}),
  };
}

export const serviceIssuerTermsDigest = (draft: ServiceIssuerDraft): Hex =>
  issuerDigest(canonicalTerms(draft));

const APPROVAL_TYPES = {
  IssuerTermsApproval: [
    { name: "member", type: "address" },
    { name: "draft", type: "string" },
    { name: "revision", type: "uint256" },
    { name: "service", type: "string" },
    { name: "termsDigest", type: "bytes32" },
    { name: "signedAt", type: "uint256" },
  ],
} as const;

/** What the member's account signs: readable fields for a wallet, and the digest of every term. */
export function serviceIssuerApprovalTypedData(
  approval: Omit<ServiceIssuerSignedApproval, "signature">
): TypedDataDefinition<typeof APPROVAL_TYPES, "IssuerTermsApproval"> {
  return {
    domain: { name: "Green Goods Service Issuer", version: "1", chainId: APPROVAL_CHAIN_ID },
    types: APPROVAL_TYPES,
    primaryType: "IssuerTermsApproval",
    message: {
      member: approval.member,
      draft: approval.draftId,
      revision: BigInt(approval.revision),
      service: approval.service,
      termsDigest: approval.termsDigest,
      signedAt: approval.signedAt,
    },
  };
}

/**
 * The reference and digest the issuer metadata carries as `service.approval`. The digest covers
 * the signed message and the signature, so the metadata points at this exact record.
 */
export function serviceIssuerApprovalProvenance(
  approval: ServiceIssuerSignedApproval
): ServiceIssuerProvenance & { reference: string; digest: Hex } {
  const { signature, ...unsigned } = approval;
  return {
    reference: `issuer-approval:${APPROVAL_CHAIN_ID}:${approval.member.toLowerCase()}:${approval.draftId}:${approval.revision}`,
    digest: keccak256(concat([hashTypedData(serviceIssuerApprovalTypedData(unsigned)), signature])),
  };
}

/**
 * Whether the member's approval covers this draft as it stands. An approval of an earlier
 * revision is `outdated`: nothing continues until the member approves the new terms or declines.
 */
export function serviceIssuerDraftApproval(
  draft: ServiceIssuerDraft,
  approval: ServiceIssuerSignedApproval | null
): "none" | "current" | "outdated" {
  if (!approval || approval.draftId !== draft.id || !issuerSame(approval.member, draft.member))
    return "none";
  return approval.revision === draft.terms.revision &&
    approval.termsDigest === serviceIssuerTermsDigest(draft)
    ? "current"
    : "outdated";
}
