import assert from "node:assert/strict";

import { cosmoId, type CosmoEvent } from "../src/handlers/cosmo-local-projections";
import { projectPersonalServicePurchase } from "../src/handlers/personal-service-purchases";
import { createTestIndexer, SettlementModule } from "./v3";

const MODULE = "0x000000000000000000000000000000000000a001";
const ACCOUNT = "0x000000000000000000000000000000000000b001";
const SAFE = "0x000000000000000000000000000000000000c001";
const TOKEN = "0x000000000000000000000000000000000000d001";
const hash = (n: number) => `0x${n.toString(16).padStart(64, "0")}`;
const EXACT = 9_007_199_254_740_993n;
const terms = {
  version: 1n,
  purchaseId: hash(1),
  sourceChainId: 42161n,
  sourceModule: MODULE,
  commitmentId: 10n,
  termsRevision: EXACT,
  termsHash: hash(2),
  claimHash: hash(3),
  requestNonce: EXACT,
  buyer: ACCOUNT,
  recipient: ACCOUNT,
  buyerGarden: ACCOUNT,
  providerGarden: SAFE,
  destinationChainId: 42220n,
  token: TOKEN,
  price: EXACT,
  custodySafe: SAFE,
  authorizedDepositor: ACCOUNT,
  refundAccount: ACCOUNT,
  disclosedGrossAmount: EXACT + 10n,
  disclosedNetAmount: EXACT,
};
const deposit = {
  chainId: 42220n,
  token: TOKEN,
  transactionHash: hash(5),
  logIndex: 3_000_000_001n,
  blockNumber: 75_178_393n,
  blockHash: hash(6),
  depositingAccount: ACCOUNT,
  custodySafe: SAFE,
  grossDebit: EXACT + 10n,
  receivedAmount: EXACT,
};
function event(eventName: string, params: CosmoEvent["params"], block: number): CosmoEvent {
  return {
    eventName,
    chainId: 42161,
    srcAddress: MODULE,
    params,
    block: { number: block, timestamp: block },
    transaction: { hash: hash(block + 100) },
    logIndex: 1,
  };
}
const pledge = () =>
  event(
    "PersonalServicePurchasePledged",
    { fundingId: 1n, purchaseId: hash(1), commitmentId: 10n, terms },
    1
  );
const receipt = () =>
  event(
    "PersonalServiceDepositVerified",
    { fundingId: 1n, purchaseId: hash(1), receiptKey: hash(7), deposit, verifiedBy: SAFE },
    2
  );
const selected = (outcome: bigint, block = 3, refundDisbursementId = 0n) =>
  event(
    "PersonalServicePurchaseOutcomeSelected",
    {
      fundingId: 1n,
      purchaseId: hash(1),
      outcome,
      payoutPlanId: outcome === 1n ? 99n : 0n,
      refundDisbursementId,
    },
    block
  );
const completed = (outcome: bigint) =>
  event(
    "PersonalServicePurchaseOutcomeCompleted",
    { fundingId: 1n, purchaseId: hash(1), outcome },
    5
  );

describe("personal service purchase receipts and commercial outcomes", () => {
  it("preserves every immutable pledge field and exact large integers", async () => {
    const db = createTestIndexer();
    await projectPersonalServicePurchase(pledge(), db);
    const row = await db.PersonalServicePurchase.get(cosmoId(42161, MODULE, 1n));
    assert.ok(row);
    assert.equal(row.pledgeSeen, true);
    for (const [field, value] of Object.entries(terms)) {
      assert.equal(row[field as keyof typeof row], field === "version" ? 1 : value, field);
    }
  });

  it("backfills pledge after a typed attestation without conflating source and Celo provenance", async () => {
    const db = createTestIndexer();
    await projectPersonalServicePurchase(receipt(), db);
    await projectPersonalServicePurchase(pledge(), db);
    await projectPersonalServicePurchase(receipt(), db);
    const row = await db.PersonalServiceDepositReceipt.get(cosmoId(42161, MODULE, hash(7)));
    assert.ok(row);
    assert.equal(row.attestationKind, "PRIVILEGED_STEWARD");
    assert.equal(row.verifiedBy, SAFE);
    assert.equal(row.depositLogIndex, 3_000_000_001n);
    assert.equal(row.depositTransactionHash, hash(5));
    assert.equal(row.txHash, hash(102));
    assert.equal(row.logIndex, 1);
    assert.equal(row.grossDebit, EXACT + 10n);
    assert.equal(row.receivedAmount, EXACT);
    assert.equal(row.feeAmount, 10n);
    assert.equal((await db.PersonalServiceDepositReceipt.getAll()).length, 1);
    assert.equal(
      (await db.PersonalServicePurchase.get(cosmoId(42161, MODULE, 1n)))?.receiptEntityId,
      row.id
    );
  });

  it("converges late-deposit refund selection, queued child and completion in reverse delivery order", async () => {
    const events = [pledge(), receipt(), selected(2n), selected(2n, 4, 88n), completed(4n)];
    const projections = [];
    for (const order of [events, [...events].reverse(), [...events, ...events]]) {
      const db = createTestIndexer();
      for (const item of order) await projectPersonalServicePurchase(item, db);
      projections.push(await db.PersonalServicePurchase.get(cosmoId(42161, MODULE, 1n)));
    }
    assert.deepEqual(projections[0], projections[1]);
    assert.deepEqual(projections[0], projections[2]);
    assert.equal(projections[0]?.selectedOutcome, 2);
    assert.equal(projections[0]?.completedOutcome, 4);
    assert.equal(projections[0]?.refundDisbursementId, 88n);
  });

  it("retains settled completion when selection and pledge arrive later", async () => {
    const db = createTestIndexer();
    for (const item of [completed(3n), selected(1n), pledge()])
      await projectPersonalServicePurchase(item, db);
    const row = await db.PersonalServicePurchase.get(cosmoId(42161, MODULE, 1n));
    assert.equal(row?.selectedOutcome, 1);
    assert.equal(row?.completedOutcome, 3);
    assert.equal(row?.payoutPlanId, 99n);
  });

  it("rejects contradictory commercial branches and a conflicting immutable pledge", async () => {
    const db = createTestIndexer();
    await projectPersonalServicePurchase(selected(1n), db);
    await assert.rejects(
      projectPersonalServicePurchase(completed(4n), db),
      /completed personal branch/
    );
    await assert.rejects(
      projectPersonalServicePurchase(selected(2n, 4), db),
      /exclusive personal outcome/
    );
    await projectPersonalServicePurchase(pledge(), db);
    await assert.rejects(
      projectPersonalServicePurchase(
        { ...pledge(), params: { ...pledge().params, terms: { ...terms, price: EXACT + 1n } } },
        db
      ),
      /immutable personal terms price/
    );
    assert.equal(
      (await db.PersonalServicePurchase.get(cosmoId(42161, MODULE, 1n)))?.selectedOutcome,
      1
    );
  });

  it("isolates same funding and receipt keys by module and chain", async () => {
    const db = createTestIndexer();
    for (const item of [
      receipt(),
      { ...receipt(), srcAddress: ACCOUNT },
      { ...receipt(), chainId: 100 },
    ]) {
      await projectPersonalServicePurchase(item, db);
    }
    assert.equal((await db.PersonalServicePurchase.getAll()).length, 3);
    assert.equal((await db.PersonalServiceDepositReceipt.getAll()).length, 3);
  });

  it("does not reclassify an opaque legacy funding deposit as a typed service receipt", async () => {
    const db = createTestIndexer();
    await SettlementModule.FundingDepositRecorded.processEvent({
      mockDb: db,
      event: SettlementModule.FundingDepositRecorded.createMockEvent({
        fundingId: 11n,
        depositReference: hash(11),
        amount: EXACT,
        recordedBy: SAFE,
        mockEventData: {
          chainId: 42161,
          block: { number: 433_713_813, timestamp: 1 },
          transaction: { hash: hash(12) },
        },
      }),
    });
    assert.equal((await db.PersonalServicePurchase.getAll()).length, 0);
    assert.equal((await db.PersonalServiceDepositReceipt.getAll()).length, 0);
    assert.equal((await db.CommitmentFunding.get("42161-11"))?.depositedAmount, EXACT);
  });
});
