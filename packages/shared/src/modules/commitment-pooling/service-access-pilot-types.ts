import type { Hex } from "viem";
import type { Address } from "../../types/domain";
import type { ServiceAsset } from "./service-access-types";

/** DEV observations only. These records never authorize a production transaction. */
export interface PilotRewardItem {
  id: Hex;
  asset: ServiceAsset;
  amount: bigint;
  recipient: Address;
  funder: Address;
  paymentMethod: "issuer-reserve-allowance" | "celo-gd";
  state: "pending" | "failed" | "delivered";
  acknowledgment: "none" | "pending" | "observed";
  attempts: bigint;
  receipt: string | null;
}
export interface PilotExchangeQuote {
  id: Hex;
  chainId: 100;
  pool: Address;
  holder: Address;
  inputToken: Address;
  outputToken: Address;
  input: bigint;
  grossOutput: bigint;
  poolFee: bigint;
  protocolFee: bigint;
  netOutput: bigint;
  minimumOutput: bigint;
  deadline: bigint;
  configuration: bigint;
}
export interface ServiceAccessPilot {
  evidence: "local-rehearsal";
  serviceCommitmentId: 1023n;
  service: {
    access: "full";
    units: 1n;
    durationMinutes: 60;
    voucherUnits: 1_000_000n;
    validUntil: bigint;
  };
  assets: { a: ServiceAsset; b: ServiceAsset };
  holdings: { a: bigint; b: bigint };
  reward: null | { workFulfilled: boolean; voucher: PilotRewardItem; gd: PilotRewardItem | null };
  inventory: {
    asset: ServiceAsset;
    reserve: bigint;
    allowance: bigint;
    acceptedUndelivered: bigint;
  };
  exchange: {
    pool: Address;
    /** Spendable output units, excluding pool fees reserved by prior exchanges. */
    inventory: bigint;
    inputHolding: bigint;
    inputLimit: bigint;
    listed: boolean;
    allowance: bigint;
    status: "none" | "quoted" | "failed" | "unknown" | "confirmed";
    failure:
      | "inventory"
      | "limit"
      | "listing"
      | "deadline"
      | "minimum"
      | "allowance"
      | "transfer"
      | null;
    quote: PilotExchangeQuote | null;
    receipt: null | {
      evidence: "local-rehearsal";
      observationId: string;
      pool: Address;
      chainId: 100;
    };
  };
}
export type PilotRoleObservation =
  | "work-fulfilled"
  | "voucher-budget-repaired"
  | "issuer-approved"
  | "deposit-acknowledged"
  | "provider-accepted";
export type ServiceAccessPilotAction =
  | { action: "observePilotRole"; observation: PilotRoleObservation }
  | { action: "deliverPilotReward" | "acknowledgePilotReward"; asset: "voucher" | "gd" }
  /** A quote for the pilot's input amount, or for a smaller one after a short pool. */
  | { action: "quotePilotExchange"; input?: bigint }
  | { action: "resolvePilotExchange" }
  | { action: "approvePilotExchange"; expectedQuoteId: Hex }
  | { action: "executePilotExchange"; quote: PilotExchangeQuote };
