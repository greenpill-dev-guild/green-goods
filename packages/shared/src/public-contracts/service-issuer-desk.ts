import type { Address, Hex } from "viem";

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
  /** Required for new approvals. Absent only on historical single-pool records. */
  exchangePool?: { chainId: 100; id: string; address: Address };
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

export interface ServiceIssuerDeskSelection {
  routeId: string;
  poolId: string;
}
export interface ServiceIssuerDeskContext extends ServiceIssuerDeskSelection {
  chainId: 100;
  sourceChainId: number;
  garden: Address;
}
export interface ServiceIssuerDeskRecord extends ServiceIssuerDraftRecord {
  context: ServiceIssuerDeskContext;
  revision: number;
  createdBy: Address;
  updatedAt: string;
}
export type ServiceIssuerDeskCommand =
  | { action: "list"; selection: ServiceIssuerDeskSelection | null }
  | { action: "read"; id: string }
  | {
      action: "save";
      selection: ServiceIssuerDeskSelection;
      draft: ServiceIssuerDraft;
      expectedRevision: number | null;
    }
  | { action: "send"; id: string; expectedRevision: number }
  | { action: "decline"; id: string; expectedRevision: number }
  | {
      action: "approve";
      id: string;
      expectedRevision: number;
      approval: ServiceIssuerSignedApproval;
    };
export interface ServiceIssuerDeskProof {
  version: 1;
  chainId: 100;
  actor: Address;
  issuedAt: number;
  audience: string;
  command: string;
}
export interface ServiceIssuerDeskRequest extends ServiceIssuerDeskProof {
  signature: Hex;
}
export interface ServiceIssuerDeskResponse {
  ok: true;
  record?: ServiceIssuerDeskRecord;
  records?: ServiceIssuerDeskRecord[];
  partial?: boolean;
}
