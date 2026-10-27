import { concat, hashTypedData, keccak256, type Hex, type TypedDataDefinition } from "viem";
import type { Address } from "../../types/domain";
import type { TransactionSender } from "../transactions/types";
import type { ServiceLiveSession } from "./service-access-live";
import type { ServiceLiveChain } from "./service-access-live-route";
import { sessionIdentity } from "./service-access-live-submission";
import { assertServiceActor } from "./service-actor-session";
import { issuerDigest, issuerSame } from "./service-issuer-metadata";
import type { ServiceIssuerProvenance } from "./service-issuer-types";

/** The voucher network: a member's token, reserve and booking approvals all live on Gnosis. */
const APPROVAL_CHAIN_ID = 100;

/**
 * Every setting a draft proposes. The member signs all of them at once, through their digest.
 * The service's own words are the member's and stay as written; amounts are base units.
 */
export interface ServiceIssuerTerms {
  revision: number;
  service: { title: string; buys: string; scope: string; remedy: string; unit: string };
  token: { name: string; symbol: string; decimals: number };
  /** How many vouchers' worth of service the member expects to deliver, and over how long. */
  capacity: { units: bigint; weeks: number };
  /** What is issued; `pool` of it goes to the shared pool and the rest stays in the reserve. */
  issue: { total: bigint; pool: bigint };
  rewardAllowance: bigint;
  poolHoldingCap: bigint;
  priceIndex: bigint;
  poolFee: bigint;
  /** Policy the member publishes; nothing enforces it. */
  replyBusinessDays: number;
  acceptanceDays: number;
  document: { reference: string; digest: Hex };
}
export type ServiceIssuerTermsSetting = Exclude<keyof ServiceIssuerTerms, "revision" | "token">;

/**
 * A member issuer's draft, prepared by a steward with the member. Preparing it confers no
 * authority: only the member's own signed approval binds the terms.
 */
export interface ServiceIssuerDraft {
  version: 1;
  id: string;
  member: Address;
  memberName: string;
  preparedBy: string;
  garden: string;
  /** The chain the member's source authority is registered on; the token itself is on Gnosis. */
  sourceChainId: number;
  /** When the steward sent it to the member; null while it is still being prepared. */
  sentAt: bigint | null;
  terms: ServiceIssuerTerms;
  /** Settings that differ from the revision the member approved before, if any. */
  changed: readonly ServiceIssuerTermsSetting[];
}

/** The member's signature over one draft revision's exact terms: the record the metadata cites. */
export interface ServiceIssuerSignedApproval {
  version: 1;
  draftId: string;
  revision: number;
  member: Address;
  service: string;
  termsDigest: Hex;
  signedAt: bigint;
  signature: Hex;
}

/** A draft as the steward's desk keeps it: the member's latest approval and any decline. */
export interface ServiceIssuerDraftRecord {
  draft: ServiceIssuerDraft;
  approval: ServiceIssuerSignedApproval | null;
  declinedAt: bigint | null;
}

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

interface ApprovalDependencies {
  session(): ServiceLiveSession;
  sender(): TransactionSender | null;
  chain: ServiceLiveChain;
  /** Seconds; the time the approval records. */
  now(): bigint;
}

/**
 * The member approves the exact terms from their own account. A steward, a Safe or any other
 * signed-in account is refused before anything is signed, and nothing is sent or issued.
 */
export async function signServiceIssuerApproval(
  deps: ApprovalDependencies,
  draft: ServiceIssuerDraft
): Promise<ServiceIssuerSignedApproval> {
  if (draft.version !== 1 || !draft.id || draft.sentAt === null)
    throw new Error("Only a sent draft can be approved");
  const identity = sessionIdentity(deps.session());
  const assertMember = () =>
    assertServiceActor(
      draft.member,
      APPROVAL_CHAIN_ID,
      draft.sourceChainId,
      deps.session,
      deps.sender(),
      deps.chain,
      identity
    );
  const sender = await assertMember();
  if (!sender.signTypedData) throw new Error("This account can't sign a service approval");
  const unsigned = {
    version: 1 as const,
    draftId: draft.id,
    revision: draft.terms.revision,
    member: draft.member,
    service: draft.terms.service.title,
    termsDigest: serviceIssuerTermsDigest(draft),
    signedAt: deps.now(),
  };
  const signature = await sender.signTypedData(
    {
      account: draft.member,
      chainId: APPROVAL_CHAIN_ID,
      data: serviceIssuerApprovalTypedData(unsigned),
    },
    {
      assertOwnership: async () => {
        await assertMember();
      },
    }
  );
  await assertMember();
  if (!/^0x(?:[0-9a-f]{2})+$/i.test(signature) || signature.length < 132)
    throw new Error("The account returned no usable approval signature");
  return { ...unsigned, signature };
}
