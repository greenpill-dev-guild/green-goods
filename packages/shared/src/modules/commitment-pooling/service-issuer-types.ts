import type { Hex } from "viem";
import type { Address } from "../../types/domain";
import type { ContractCall, TxResult } from "../transactions/types";
import type { ServiceDeploymentPin, ServiceLiveRoute } from "./service-access-live-config";
import type {
  ServiceVoucherAuthorization,
  VoucherSetupResult,
  VoucherFinalAllocationRecord,
} from "./service-access-voucher-types";

export interface ServiceIssuerProvenance {
  reference: string | null;
  digest: Hex | null;
}
/** Reviewed public metadata describes consent; it is not a member signature or chain receipt. */
export interface ServiceIssuerAsset {
  id: string;
  kind: "individual" | "collective";
  ownerReserve: Address;
  sourceAuthority: Address;
  token: ServiceIssuerProxyPin;
  name: string;
  symbol: string;
  decimals: number;
  service: {
    unit: string | null;
    terms: ServiceIssuerProvenance;
    /**
     * Vouchers' worth of service the member confirmed they can deliver: the approved terms'
     * `capacity.units`, recorded apart from what is issued. Null until confirmed.
     */
    capacity: bigint | null;
    /** Reviewed offer bindings for a token redeemable against several services. Capacities are voucher base units. */
    offers?: readonly {
      /** Public service name from the reviewed offer. */
      name?: string;
      unit: string;
      serviceUnits: bigint;
      voucherUnits: bigint;
      serviceTermsRef: Hex;
      remedyTermsRef: Hex;
      capacity: bigint | null;
    }[];
    approval: ServiceIssuerProvenance;
  };
  initialSupply: bigint | null;
  adapterAllowance: bigint | null;
  upgradeControl:
    | null
    | { kind: "member"; admin: Address }
    | { kind: "collective-safe"; admin: Address };
}
export interface ServiceIssuerCodePin {
  address: Address;
  runtimeCodeHash: Hex;
}
export interface ServiceIssuerProxyPin extends ServiceDeploymentPin {
  factoryDeployment: { deployer: Address; admin: Address; salt: Hex; initializer: Hex };
}
/** One pool's decision about a voucher; never an issuer-wide price, capacity or suspension. */
export interface ServiceIssuerPoolPolicy {
  assetId: string;
  poolHoldingCap: bigint | null;
  priceIndex: bigint | null;
  delisting: { reference: string; digest: Hex } | null;
}
export interface ServiceIssuerPool {
  id: string;
  name: string;
  chainId: 100;
  garden: Address;
  listings: readonly ServiceIssuerPoolPolicy[];
  proxyAdmin: Address;
  deployment: ServiceIssuerProxyPin;
  registry: ServiceIssuerProxyPin;
  limiter: ServiceIssuerProxyPin;
  quoter: ServiceIssuerProxyPin;
  feePolicy: ServiceIssuerProxyPin;
  protocolFee: ServiceIssuerProxyPin;
  feeAddress: Address;
  feesDecoupled: true;
}
export interface ServiceIssuerRoute {
  service: ServiceLiveRoute;
  factory: ServiceIssuerCodePin;
  adapterSource: ServiceDeploymentPin & {
    guardian: Address;
    router: Address;
    remoteSelector: bigint;
  };
  adapter: ServiceDeploymentPin & {
    guardian: Address;
    router: Address;
    sourcePeer: Address;
    sourceSelector: bigint;
  };
  assets: readonly ServiceIssuerAsset[];
  pools: readonly ServiceIssuerPool[];
}
/** A holder exchanging assets is also explicit here; no buyer key is repurposed as issuer authority. */
export interface ServiceIssuerActor {
  address: Address;
  routeId: string;
  assetId: string;
  /** Required for exchanges and their approvals; issuer and booking actions need no pool. */
  poolId?: string;
}
export type ServiceIssuerAction =
  | { kind: "issue"; amount: bigint }
  | { kind: "approveReserve"; amount: bigint }
  | { kind: "revokeReserve" }
  | { kind: "configureReserve"; enabled: boolean }
  | { kind: "approveBooking"; setupId: Hex; authorizationHash: Hex }
  | { kind: "authorizeReturn"; setupId: Hex; authorizationHash: Hex; ceiling: bigint }
  | { kind: "approveExchange"; amount: bigint }
  | { kind: "revokeExchange" }
  | {
      kind: "exchange";
      outputAssetId: string;
      amount: bigint;
      quotedOutput: bigint;
      minimumOutput: bigint;
      deadline: bigint;
    };
export interface ServiceIssuerReview {
  version: 1;
  evidence: "live-review";
  actor: ServiceIssuerActor;
  action: ServiceIssuerAction;
  session: string;
  configuration: Hex;
  state: Hex;
  expected: Readonly<Record<string, bigint | boolean>>;
  expiresAt: bigint;
  call: ContractCall;
  fingerprint: Hex;
  /** Explicit sequential second hop, bound to a canonical first-hop receipt. Never an atomic claim. */
  continuation?: {
    transactionHash: Hex;
    reviewFingerprint: Hex;
    deliveredOutput: bigint;
    intermediateResidue: bigint;
  };
}
export interface ServiceIssuerPending {
  version: 1;
  actor: ServiceIssuerActor;
  review: ServiceIssuerReview;
  submission?: TxResult;
}
export type ServiceIssuerOutcome =
  | {
      status: "confirmed";
      transactionHash: Hex;
      deliveredOutput?: bigint;
      currentStateMatchesReceipt: boolean;
    }
  | { status: "pending"; pending: ServiceIssuerPending }
  | { status: "reverted" };
export interface ServiceIssuerExchangeReceipt {
  version: 1;
  review: ServiceIssuerReview;
  submission: TxResult;
  transactionHash: Hex;
  deliveredOutput: bigint;
}
export interface ServiceIssuerContinuationQuote extends ServiceIssuerExchangeQuote {
  firstTransactionHash: Hex;
  intermediateResidue: bigint;
}
export interface ServiceIssuerOperations {
  /** Retained after confirmation and before pending cleanup, scoped by chain and account. */
  lastExchange(actor: ServiceIssuerActor): ServiceIssuerExchangeReceipt | null;
  quoteContinuation(
    actor: ServiceIssuerActor,
    outputAssetId: string,
    amount: bigint
  ): Promise<ServiceIssuerContinuationQuote>;
  reviewContinuation(
    actor: ServiceIssuerActor,
    action: Extract<ServiceIssuerAction, { kind: "exchange" }>
  ): Promise<ServiceIssuerReview>;
  read(actor: ServiceIssuerActor): Promise<ServiceIssuerSnapshot>;
  quote(
    actor: ServiceIssuerActor,
    outputAssetId: string,
    amount: bigint
  ): Promise<ServiceIssuerExchangeQuote>;
  review(actor: ServiceIssuerActor, action: ServiceIssuerAction): Promise<ServiceIssuerReview>;
  execute(review: ServiceIssuerReview): Promise<ServiceIssuerOutcome>;
  pending(actor: ServiceIssuerActor): ServiceIssuerPending | null;
  reconcile(actor: ServiceIssuerActor): Promise<ServiceIssuerOutcome | null>;
}
export interface ServiceIssuerExchangeQuote {
  poolId: string;
  poolAddress: Address;
  outputAssetId: string;
  amount: bigint;
  quotedOutput: bigint;
  grossOutput: bigint;
  reservedOutputFees: bigint;
  observedAt: bigint;
  expiresAt: bigint;
}
export type ServiceIssuerSnapshot =
  | { evidence: "unavailable"; reason: "unconfigured" }
  | {
      evidence: "onchain";
      actor: ServiceIssuerActor;
      asset: ServiceIssuerAsset;
      holdingBalance: bigint;
      issuerReserveBalance: bigint | null;
      totalMinted: bigint;
      reserveAllowance: bigint | null;
      poolAllowance: bigint;
      reserveEnabled: boolean;
      configuredReserveAuthority: Address;
      registeredSourceAuthority: Address;
      pool: ServiceIssuerPoolListing | null;
      poolStatus: "unselected" | "observed" | "unavailable";
      pending: ServiceIssuerPending | null;
      bookings: ServiceIssuerBookings;
    };
/** The selected pool's observed state; delisting belongs to this listing, never to the issuer. */
export interface ServiceIssuerPoolListing {
  admitted: boolean;
  limit: bigint;
  holding: bigint;
  delisting?: ServiceIssuerPoolPolicy["delisting"];
}
export interface ServiceIssuerBooking {
  setupId: Hex;
  authorizationHash: Hex;
  authorization: ServiceVoucherAuthorization;
  result: VoucherSetupResult;
  issuerReturnCeiling: bigint;
  finalAllocation: VoucherFinalAllocationRecord | null;
  reviewedTermsMatch: boolean;
  approvalEligible: boolean;
  returnEligible: boolean;
}
export interface ServiceIssuerBookings {
  status: "unavailable" | "observed" | "partial";
  completeness: "unknown";
  records: readonly ServiceIssuerBooking[];
  reason?: "indexer-unavailable" | "canonical-mismatch" | "partial-discovery" | "not-issuer";
}
