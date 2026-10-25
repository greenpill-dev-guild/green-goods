import type { Address } from "../../types/domain";
import type {
  PersonalServicePurchase,
  ServiceAccessKey,
  ServiceAsset,
} from "./service-access-types";
import {
  serviceAddress,
  serviceChainId,
  serviceEnum,
  serviceHash,
  serviceTuple,
  serviceUint,
  serviceUint32,
  SERVICE_ZERO_ADDRESS,
  SERVICE_ZERO_HASH,
} from "./service-access-chain-values";

const TERMS = [
  "version",
  "purchaseId",
  "sourceChainId",
  "sourceModule",
  "commitmentId",
  "termsRevision",
  "termsHash",
  "claimHash",
  "requestNonce",
  "buyer",
  "recipient",
  "buyerGarden",
  "providerGarden",
  "destinationChainId",
  "token",
  "price",
  "custodySafe",
  "authorizedDepositor",
  "refundAccount",
  "disclosedGrossAmount",
  "disclosedNetAmount",
];
const DEPOSIT = [
  "chainId",
  "token",
  "transactionHash",
  "logIndex",
  "blockNumber",
  "blockHash",
  "depositingAccount",
  "custodySafe",
  "grossDebit",
  "receivedAmount",
];

/** Decode the module's stored receipt facts; their authority remains privileged steward attestation. */
export function mapPersonalServicePurchase(
  key: ServiceAccessKey,
  module: Address,
  fundingId: bigint,
  rawPurchase: unknown,
  rawFunding: unknown,
  asset: ServiceAsset
): PersonalServicePurchase {
  const purchase = serviceTuple(rawPurchase, ["terms", "deposit", "outcome", "payoutPlanId"]);
  const terms = serviceTuple(purchase.terms, TERMS);
  const deposit = serviceTuple(purchase.deposit, DEPOSIT);
  const funding = serviceTuple(rawFunding, [
    "commitmentId",
    "funder",
    "garden",
    "refundAccount",
    "expectedAmount",
    "depositedAmount",
    "depositReference",
    "state",
    "refundDisbursementId",
    "pledgedAt",
    "depositRecordedAt",
    "consumedAt",
    "closedAt",
  ]);
  if (
    terms.version !== 1 ||
    serviceUint(terms.sourceChainId) !== BigInt(key.sourceChainId) ||
    serviceAddress(terms.sourceModule) !== module.toLowerCase() ||
    serviceUint(terms.commitmentId) !== key.commitmentId ||
    serviceAddress(terms.buyer) !== key.buyer.toLowerCase() ||
    serviceAddress(terms.recipient) !== key.buyer.toLowerCase()
  )
    throw new Error("Personal purchase source identity mismatch");
  const price = serviceUint(terms.price);
  const disclosedGrossAmount = serviceUint(terms.disclosedGrossAmount);
  const disclosedNetAmount = serviceUint(terms.disclosedNetAmount);
  const custodySafe = serviceAddress(terms.custodySafe);
  const authorizedDepositor = serviceAddress(terms.authorizedDepositor);
  const refundAccount = serviceAddress(terms.refundAccount);
  const buyerGarden = serviceAddress(terms.buyerGarden);
  if (
    serviceChainId(terms.destinationChainId) !== asset.chainId ||
    serviceAddress(terms.token) !== asset.token.toLowerCase() ||
    price === 0n ||
    disclosedNetAmount < price ||
    disclosedGrossAmount < disclosedNetAmount ||
    [custodySafe, authorizedDepositor, refundAccount, buyerGarden].includes(SERVICE_ZERO_ADDRESS) ||
    refundAccount === custodySafe ||
    serviceUint(funding.commitmentId) !== key.commitmentId ||
    serviceAddress(funding.funder) !== key.buyer.toLowerCase() ||
    serviceAddress(funding.garden) !== buyerGarden ||
    serviceAddress(funding.refundAccount) !== refundAccount ||
    serviceUint(funding.expectedAmount) !== price
  )
    throw new Error("Personal purchase funding binding mismatch");
  const state = serviceEnum(funding.state, [
    "none",
    "pledged",
    "deposit-recorded",
    "consumed",
    "closed",
    "refund-queued",
    "refunded",
    "withdrawn",
  ]);
  if (state === "none") throw new Error("Missing personal funding record");
  const outcome = serviceEnum(purchase.outcome, [
    "none",
    "payout",
    "refund",
    "settled",
    "refunded",
  ]) as PersonalServicePurchase["outcome"];
  const blockNumber = serviceUint(deposit.blockNumber, 64);
  const receivedAmount = serviceUint(deposit.receivedAmount);
  const grossDebit = serviceUint(deposit.grossDebit);
  let recorded: PersonalServicePurchase["deposit"] = null;
  if (blockNumber !== 0n) {
    const transactionHash = serviceHash(deposit.transactionHash);
    const blockHash = serviceHash(deposit.blockHash);
    if (
      serviceChainId(deposit.chainId) !== asset.chainId ||
      serviceAddress(deposit.token) !== asset.token.toLowerCase() ||
      serviceAddress(deposit.depositingAccount) !== authorizedDepositor ||
      serviceAddress(deposit.custodySafe) !== custodySafe ||
      transactionHash === SERVICE_ZERO_HASH ||
      blockHash === SERVICE_ZERO_HASH ||
      receivedAmount === 0n ||
      grossDebit < receivedAmount ||
      serviceUint(funding.depositedAmount) !== receivedAmount
    )
      throw new Error("Personal deposit binding mismatch");
    recorded = {
      chainId: asset.chainId,
      token: asset.token,
      transactionHash,
      logIndex: serviceUint32(deposit.logIndex),
      blockNumber,
      blockHash,
      depositingAccount: authorizedDepositor,
      custodySafe,
      grossDebit,
      receivedAmount,
      evidence: "privileged-steward",
    };
  } else if (
    receivedAmount !== 0n ||
    grossDebit !== 0n ||
    serviceUint(funding.depositedAmount) !== 0n
  )
    throw new Error("Malformed empty personal deposit");
  const termsRevision = serviceUint(terms.termsRevision, 64);
  const requestNonce = serviceUint(terms.requestNonce, 64);
  const termsHash = serviceHash(terms.termsHash);
  const claimHash = serviceHash(terms.claimHash);
  const purchaseId = serviceHash(terms.purchaseId);
  if (
    termsRevision === 0n ||
    requestNonce === 0n ||
    [termsHash, claimHash, purchaseId].includes(SERVICE_ZERO_HASH)
  )
    throw new Error("Malformed personal purchase identity");
  return {
    sourceModule: module,
    fundingId,
    purchaseId,
    termsRevision,
    termsHash,
    claimHash,
    requestNonce,
    buyer: key.buyer,
    recipient: key.buyer,
    buyerGarden,
    providerGarden: serviceAddress(terms.providerGarden),
    authorizedDepositor,
    refundAccount,
    asset,
    custodySafe,
    price,
    disclosedGrossAmount,
    disclosedNetAmount,
    deposit: recorded,
    paymentObservation: "none",
    state: state as PersonalServicePurchase["state"],
    outcome,
    payoutPlanId: serviceUint(purchase.payoutPlanId),
    refundDisbursementId: serviceUint(funding.refundDisbursementId),
  };
}
