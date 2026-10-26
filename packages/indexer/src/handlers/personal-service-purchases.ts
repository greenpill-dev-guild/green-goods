import { indexer, type PersonalServicePurchase } from "envio";

import { cursorWins } from "./commitment-pool-projections";
import {
  assertSame,
  cosmoId,
  cursor,
  identity,
  integer,
  position,
  smallInteger,
  text,
  times,
  tuple,
  type CosmoContext,
  type CosmoEvent,
} from "./cosmo-local-projections";

function emptyPurchase(event: CosmoEvent, fundingId: bigint): PersonalServicePurchase {
  return {
    ...identity(event, fundingId),
    fundingId,
    purchaseId: undefined,
    pledgeSeen: false,
    version: undefined,
    sourceChainId: undefined,
    sourceModule: undefined,
    commitmentId: undefined,
    termsRevision: undefined,
    termsHash: undefined,
    claimHash: undefined,
    requestNonce: undefined,
    buyer: undefined,
    recipient: undefined,
    buyerGarden: undefined,
    providerGarden: undefined,
    destinationChainId: undefined,
    token: undefined,
    price: undefined,
    custodySafe: undefined,
    authorizedDepositor: undefined,
    refundAccount: undefined,
    disclosedGrossAmount: undefined,
    disclosedNetAmount: undefined,
    receiptEntityId: undefined,
    selectedOutcome: undefined,
    completedOutcome: undefined,
    payoutPlanId: undefined,
    refundDisbursementId: undefined,
    ...cursor("pledged"),
    ...cursor("selected"),
    ...cursor("completed"),
    ...times(event),
  };
}

export async function projectPersonalServicePurchase(
  event: CosmoEvent,
  context: CosmoContext
): Promise<void> {
  const params = event.params;
  const fundingId = integer(params, "fundingId");
  const purchaseId = text(params, "purchaseId");
  const id = cosmoId(event.chainId, event.srcAddress, fundingId);
  const existing = await context.PersonalServicePurchase.get(id);
  const purchase = existing ?? emptyPurchase(event, fundingId);
  if (purchase.purchaseId !== undefined)
    assertSame(purchase.purchaseId, purchaseId, "personal purchase identity");
  let next = { ...purchase, purchaseId, ...times(event, purchase) };
  if (event.eventName === "PersonalServicePurchasePledged") {
    const terms = tuple(params, "terms");
    const facts = {
      version: smallInteger(terms, "version", 1n),
      purchaseId: text(terms, "purchaseId"),
      sourceChainId: integer(terms, "sourceChainId"),
      sourceModule: text(terms, "sourceModule"),
      commitmentId: integer(terms, "commitmentId"),
      termsRevision: integer(terms, "termsRevision"),
      termsHash: text(terms, "termsHash"),
      claimHash: text(terms, "claimHash"),
      requestNonce: integer(terms, "requestNonce"),
      buyer: text(terms, "buyer"),
      recipient: text(terms, "recipient"),
      buyerGarden: text(terms, "buyerGarden"),
      providerGarden: text(terms, "providerGarden"),
      destinationChainId: integer(terms, "destinationChainId"),
      token: text(terms, "token"),
      price: integer(terms, "price"),
      custodySafe: text(terms, "custodySafe"),
      authorizedDepositor: text(terms, "authorizedDepositor"),
      refundAccount: text(terms, "refundAccount"),
      disclosedGrossAmount: integer(terms, "disclosedGrossAmount"),
      disclosedNetAmount: integer(terms, "disclosedNetAmount"),
    };
    assertSame(facts.version, 1, "personal purchase version");
    assertSame(facts.purchaseId, purchaseId, "personal purchase tuple identity");
    assertSame(facts.sourceChainId, BigInt(event.chainId), "personal purchase source chain");
    assertSame(facts.sourceModule, next.moduleAddress, "personal purchase source module");
    assertSame(facts.commitmentId, integer(params, "commitmentId"), "personal purchase commitment");
    if (purchase.pledgeSeen) {
      for (const [key, value] of Object.entries(facts)) {
        assertSame(
          purchase[key as keyof PersonalServicePurchase],
          value,
          `immutable personal terms ${key}`
        );
      }
      return;
    }
    next = { ...next, ...facts, pledgeSeen: true, ...cursor("pledged", event) };
  } else if (event.eventName === "PersonalServiceDepositVerified") {
    const deposit = tuple(params, "deposit");
    const receiptKey = text(params, "receiptKey");
    const receiptEntityId = cosmoId(event.chainId, event.srcAddress, receiptKey);
    const receipt = {
      ...identity(event, receiptKey),
      receiptKey,
      fundingId,
      purchaseId,
      purchaseEntityId: id,
      verifiedBy: text(params, "verifiedBy"),
      attestationKind: "PRIVILEGED_STEWARD",
      depositChainId: integer(deposit, "chainId"),
      token: text(deposit, "token"),
      depositTransactionHash: text(deposit, "transactionHash"),
      depositLogIndex: integer(deposit, "logIndex"),
      depositBlockNumber: integer(deposit, "blockNumber"),
      depositBlockHash: text(deposit, "blockHash"),
      depositingAccount: text(deposit, "depositingAccount"),
      custodySafe: text(deposit, "custodySafe"),
      grossDebit: integer(deposit, "grossDebit"),
      receivedAmount: integer(deposit, "receivedAmount"),
      ...position(event),
    };
    if (receipt.receivedAmount > receipt.grossDebit)
      throw new Error("Invalid personal deposit gross/net");
    if (purchase.receiptEntityId !== undefined)
      assertSame(purchase.receiptEntityId, receiptEntityId, "personal purchase receipt");
    const prior = await context.PersonalServiceDepositReceipt.get(receiptEntityId);
    if (prior) {
      for (const [key, value] of Object.entries(receipt)) {
        assertSame(prior[key as keyof typeof receipt], value, `immutable personal receipt ${key}`);
      }
    } else {
      await context.PersonalServiceDepositReceipt.set({
        ...receipt,
        feeAmount: receipt.grossDebit - receipt.receivedAmount,
      });
    }
    next = { ...next, receiptEntityId };
  } else if (event.eventName === "PersonalServicePurchaseOutcomeSelected") {
    const outcome = smallInteger(params, "outcome", 4n);
    if (outcome !== 1 && outcome !== 2) throw new Error("Invalid selected personal outcome");
    if (purchase.selectedOutcome !== undefined)
      assertSame(purchase.selectedOutcome, outcome, "exclusive personal outcome");
    if (purchase.completedOutcome !== undefined)
      assertSame(purchase.completedOutcome, outcome + 2, "completed personal branch");
    if (
      cursorWins(
        event.block.number,
        event.logIndex,
        purchase.selectedBlockNumber,
        purchase.selectedLogIndex
      )
    ) {
      next = {
        ...next,
        selectedOutcome: outcome,
        payoutPlanId: integer(params, "payoutPlanId"),
        refundDisbursementId: integer(params, "refundDisbursementId"),
        ...cursor("selected", event),
      };
    }
  } else if (event.eventName === "PersonalServicePurchaseOutcomeCompleted") {
    const outcome = smallInteger(params, "outcome", 4n);
    if (outcome !== 3 && outcome !== 4) throw new Error("Invalid completed personal outcome");
    if (purchase.selectedOutcome !== undefined)
      assertSame(outcome, purchase.selectedOutcome + 2, "completed personal branch");
    if (purchase.completedOutcome !== undefined)
      assertSame(purchase.completedOutcome, outcome, "exclusive completed outcome");
    if (
      cursorWins(
        event.block.number,
        event.logIndex,
        purchase.completedBlockNumber,
        purchase.completedLogIndex
      )
    ) {
      next = { ...next, completedOutcome: outcome, ...cursor("completed", event) };
    }
  } else {
    throw new Error(`Unrouted personal service event: ${event.eventName}`);
  }
  await context.PersonalServicePurchase.set(next);
}

for (const eventName of [
  "PersonalServicePurchasePledged",
  "PersonalServiceDepositVerified",
  "PersonalServicePurchaseOutcomeSelected",
  "PersonalServicePurchaseOutcomeCompleted",
] as const) {
  indexer.onEvent(
    { contract: "SettlementModule", event: eventName },
    async ({ event, context }) => {
      await projectPersonalServicePurchase(event, context);
    }
  );
}
