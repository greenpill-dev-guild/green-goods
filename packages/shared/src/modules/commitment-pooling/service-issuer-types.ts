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
      unit: string;
      serviceUnits: bigint;
      voucherUnits: bigint;
      serviceTermsRef: Hex;
      remedyTermsRef: Hex;
      capacity: bigint | null;
    }[];
    approval: ServiceIssuerProvenance;
  };
  /**
   * The stewards' recorded decision to delist the token, as the Delist dialog copies it
   * (`serviceIssuerDelistingRecord`). Delisting sets a zero pool holding limit, but setup passes
   * through a zero limit too (the registry admits the token before its cap lands), so a zero limit
   * the pool holds none under reads as delisted only with this record.
   */
  delisting: { reference: string; digest: Hex } | null;
  initialSupply: bigint | null;
  adapterAllowance: bigint | null;
  poolHoldingCap: bigint | null;
  priceIndex: bigint | null;
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
  pool: {
    proxyAdmin: Address;
    deployment: ServiceIssuerProxyPin;
    registry: ServiceIssuerProxyPin;
    limiter: ServiceIssuerProxyPin;
    quoter: ServiceIssuerProxyPin;
    feePolicy: ServiceIssuerProxyPin;
    protocolFee: ServiceIssuerProxyPin;
    feeAddress: Address;
    feesDecoupled: true;
  };
}
/** A holder exchanging assets is also explicit here; no buyer key is repurposed as issuer authority. */
export interface ServiceIssuerActor {
  address: Address;
  routeId: string;
  assetId: string;
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
export interface ServiceIssuerOperations {
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
      pool: ServiceIssuerPoolListing;
      pending: ServiceIssuerPending | null;
      bookings: ServiceIssuerBookings;
    };
/** The pool's own listing of a token; `issuerPoolStatus` reads it with the asset's delisting. */
export interface ServiceIssuerPoolListing {
  admitted: boolean;
  limit: bigint;
  holding: bigint;
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
