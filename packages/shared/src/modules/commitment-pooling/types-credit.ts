import type { Address } from "../../types/domain";
import type { HexString } from "./types-core";

export enum LoanState {
  REQUESTED = "REQUESTED",
  APPROVED = "APPROVED",
  DISBURSED = "DISBURSED",
  REPAID = "REPAID",
  DEFAULTED = "DEFAULTED",
  CANCELLED = "CANCELLED",
}

export enum LoanRail {
  NONE = "NONE",
  JAR = "JAR",
  TREASURY = "TREASURY",
  GDOLLAR_SETTLEMENT = "GDOLLAR_SETTLEMENT",
}
export type LoanDisplayState = LoanState | "REPAYING";

export interface Loan {
  id: string;
  chainId: number;
  loanId: bigint;
  creditRegistry?: Address;
  poolId: bigint;
  garden: Address;
  borrower: Address;
  requestedBy: Address;
  recordedBy: Address;
  commitmentId: bigint | null;
  token: Address;
  principal: bigint;
  repaidAmount: bigint;
  outstanding: bigint;
  /** Reserved contract seam; frozen CreditRegistry events currently project this as zero. */
  feeAmount: bigint;
  rail: LoanRail;
  disbursementId: bigint | null;
  state: LoanState;
  dueDate: bigint;
  installmentsTotal: number;
  installmentsPaid: number;
  attempts: number | null;
  executionRef: HexString | null;
  termsCID: string;
  reasonCID: string | null;
  defaultReasonCID: string | null;
  recoveredFromDefault: boolean;
  defaultedAt: number | null;
  settlementRelationshipEntityId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface LoanEvent {
  id: string;
  chainId: number;
  poolId: bigint | null;
  loanId: bigint | null;
  eventType: string;
  actor: Address | null;
  amount: bigint | null;
  data: string | null;
  txHash: HexString;
  blockNumber: bigint;
  logIndex: number;
  timestamp: number;
}

export interface CreditPoolStats {
  id: string;
  chainId: number;
  poolId: bigint;
  garden: Address;
  token: Address | null;
  borrowerCap: bigint;
  enabled: boolean;
  creditIssued: bigint;
  creditRepaid: bigint;
  creditOutstanding: bigint;
  repaymentRateNumerator: bigint;
  repaymentRateDenominator: bigint;
  defaultRateNumerator: bigint;
  defaultRateDenominator: bigint;
  updatedAt: number;
}

export interface LoanPrincipalRelationship {
  id: string;
  chainId: number;
  disbursementId: bigint;
  creditRegistry: Address;
  loanId: bigint;
  updatedAt: number;
}

export interface CreditRegistryConfiguration {
  id: string;
  chainId: number;
  registry: Address;
  owner: Address | null;
  hatsModule: Address | null;
  commitmentPoolingModule: Address | null;
  settlementModule: Address | null;
  paused: boolean;
  initializedAt: number | null;
  updatedAt: number;
}
