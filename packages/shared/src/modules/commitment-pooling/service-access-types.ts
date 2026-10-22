import type { Hex } from "viem";
import type { Address } from "../../types/domain";
import type {
  ServiceVoucherSetup,
  VoucherAcceptancePolicy,
  VoucherSetupAction,
} from "./service-access-voucher-types";
import type { GoodDollarFeeQuote } from "../wallet/good-dollar-fees";

/** The source member is distinct from a Celo depositor and a Gnosis voucher holder. */
export interface ServiceAccessKey {
  sourceChainId: number;
  coreModule: Address;
  commitmentId: bigint;
  buyer: Address;
}

export type ServicePaymentRoute = "legacy" | "personal-gd" | "voucher";
export type ServiceAccessUnavailableReason =
  | "deployment-unreviewed"
  | "chain-unconfigured"
  | "signer-unavailable"
  | "authoritative-view-unconfigured"
  | "projection-incomplete"
  | "unsupported-protocol"
  | "authoritative-read-failed"
  | "voucher-endpoint-unconfigured"
  | "asset-unconfigured"
  | "offline"
  | "earned-consent-unavailable"
  | "source-clock-unavailable";

export interface ServiceAsset {
  chainId: number;
  token: Address;
  symbol: string | null;
  decimals: number | null;
}

export interface ServiceAccessOffer {
  route: ServicePaymentRoute;
  revision: bigint;
  termsHash: Hex;
  serviceTermsRef: Hex;
  remedyTermsRef: Hex;
  serviceUnits: bigint;
  unitLabel: string;
  providerGarden: Address;
  gdPrice: bigint;
  voucher: null | { asset: ServiceAsset; issuer: Address; units: bigint };
}

export interface ServiceAccessConsent {
  revision: bigint;
  requestNonce: bigint;
  termsHash: Hex;
  claimHash: Hex;
  buyerGarden: Address;
  voucherHolder: Address;
  state: "pending" | "accepted" | "withdrawn" | "declined" | "superseded" | "inactive";
}

/** Source-chain steward attestation, not a client-supplied cross-chain proof. */
export interface PersonalServiceDeposit {
  chainId: number;
  token: Address;
  transactionHash: Hex;
  logIndex: bigint;
  blockNumber: bigint;
  blockHash: Hex;
  depositingAccount: Address;
  custodySafe: Address;
  grossDebit: bigint;
  receivedAmount: bigint;
  evidence: "privileged-steward" | "local-rehearsal";
}

export interface PersonalServicePurchase {
  sourceModule: Address;
  fundingId: bigint;
  purchaseId: Hex;
  termsRevision: bigint;
  termsHash: Hex;
  claimHash: Hex;
  requestNonce: bigint;
  buyer: Address;
  recipient: Address;
  buyerGarden: Address;
  providerGarden: Address;
  authorizedDepositor: Address;
  refundAccount: Address;
  asset: ServiceAsset;
  custodySafe: Address;
  price: bigint;
  disclosedGrossAmount: bigint;
  disclosedNetAmount: bigint;
  deposit: PersonalServiceDeposit | null;
  /** A wallet observation does not change source funding into DepositRecorded. */
  paymentObservation: "none" | "pending" | "observed-awaiting-steward";
  state:
    | "pledged"
    | "deposit-recorded"
    | "consumed"
    | "withdrawn"
    | "closed"
    | "refunded"
    | "refund-queued";
  outcome: "none" | "payout" | "refund" | "settled" | "refunded";
  payoutPlanId: bigint;
  refundDisbursementId: bigint;
}

export interface ServiceAccessSnapshot {
  key: ServiceAccessKey;
  mode: ServicePaymentRoute | "unavailable";
  knownService: boolean;
  evidence: "indexed" | "onchain" | "local-rehearsal";
  complete: boolean;
  offer: ServiceAccessOffer | null;
  consent: ServiceAccessConsent | null;
  nextRequestNonce: bigint;
  coreState: string | null;
  pause: {
    core: boolean | null;
    sourceVoucher: boolean | null;
    destinationVoucher: boolean | null;
  };
  eligibleBuyerGardens: readonly { address: Address; name: string }[];
  personalFeeQuote: GoodDollarFeeQuote | null;
  personalPaymentAccount: null | { asset: ServiceAsset; custodySafe: Address };
  availableActions: readonly ServiceAccessActionKind[];
  personalPurchase: PersonalServicePurchase | null;
  sourceTimestamp: bigint | null;
  sourceBlock: { number: bigint; hash: Hex; finality: "latest" } | null;
  currentVoucherSetupId: Hex | null;
  voucherSetups: readonly ServiceVoucherSetup[];
  acceptancePolicy: VoucherAcceptancePolicy;
  capabilities: {
    mutation: "local-rehearsal" | "unavailable";
    reasons: readonly ServiceAccessUnavailableReason[];
    /** Rehearsal stand-ins do not establish Safe ownership or member passkey support. */
    sourceBuyer: Address;
    celoDepositor: Address | null;
    gnosisHolder: Address | null;
    canSignSource: boolean;
    canSendSource: boolean;
    canSignCelo: boolean;
    canSignHolder: boolean;
    canSendDestination: boolean;
  };
}

interface ReviewedServiceTerms {
  expectedRevision: bigint;
  expectedTermsHash: Hex;
}

export type ServiceAccessAction =
  | (ReviewedServiceTerms & {
      action: "requestClaim";
      requestNonce: bigint;
      buyerGarden: Address;
      voucherHolder: Address;
    })
  | { action: "withdrawClaim"; expectedClaimHash: Hex }
  | {
      action: "pledgePersonal";
      expectedClaimHash: Hex;
      authorizedDepositor: Address;
      refundAccount: Address;
      reviewedFee: GoodDollarFeeQuote;
    }
  | { action: "payPersonal"; purchaseId: Hex; reviewedFee: GoodDollarFeeQuote }
  | VoucherSetupAction;

export type ServiceAccessActionKind = ServiceAccessAction["action"];

export interface ServiceAccessActionAvailability {
  allowed: boolean;
  reason: string | null;
}

export interface ServiceAccessActionResult {
  kind: "local-rehearsal";
  /** A fixture observation identifier, deliberately not an EVM transaction hash. */
  observationId: string;
  snapshot: ServiceAccessSnapshot;
}

export interface ServiceAccessAdapter {
  read(key: ServiceAccessKey): Promise<ServiceAccessSnapshot>;
  execute(key: ServiceAccessKey, action: ServiceAccessAction): Promise<ServiceAccessActionResult>;
}
