import assert from "node:assert/strict";
import { cosmoId, type CosmoEvent } from "../src/handlers/cosmo-local-projections";
import { projectVoucherDistributionDelivery } from "../src/handlers/earned-voucher-destination";
import {
  projectEarnedVoucherDistribution,
  projectEarnedVoucherTerms,
} from "../src/handlers/earned-voucher-source";
import {
  projectStewardRoleMirror,
  projectStewardRoleSource,
  projectStewardSafeBootstrap,
} from "../src/handlers/steward-safe";
import { createTestIndexer, indexedAddress, processEvents } from "./v3";
import { HOLDER, ISSUER, SOURCE, hash } from "./voucherServiceFixtures";

const ENTITLEMENT = hash(70);
const OTHER = "0x000000000000000000000000000000000000e002";

function event(
  eventName: string,
  params: CosmoEvent["params"],
  block = 10,
  logIndex = 0,
  chainId = 42161
): CosmoEvent {
  return {
    eventName,
    params,
    chainId,
    srcAddress: SOURCE,
    block: { number: block, timestamp: block },
    logIndex,
    transaction: { hash: hash(block * 100 + logIndex) },
  };
}

describe("earned voucher delivery and steward Safe observations", () => {
  it("keeps exact terms, approval and first consent per revision without inferring acceptance", async () => {
    const db = createTestIndexer();
    const registered = event("VoucherTermsRegistered", {
      commitmentId: 7n,
      revision: 1n,
      termsHash: hash(1),
    });
    const approved = event("VoucherTermsApproved", {
      commitmentId: 7n,
      revision: 1n,
      issuerAuthority: ISSUER,
    });
    await projectEarnedVoucherTerms(approved, db);
    await projectEarnedVoucherTerms(registered, db);
    await projectEarnedVoucherTerms(approved, db);
    const terms = await db.EarnedVoucherTerms.get(cosmoId(42161, SOURCE, "7-1"));
    assert.equal(terms?.termsHash, hash(1));
    assert.equal(terms?.issuerAuthority, ISSUER.toLowerCase());
    assert.equal(terms?.approvedBlockNumber, 10n);
    await assert.rejects(
      projectEarnedVoucherTerms(
        { ...registered, params: { ...registered.params, termsHash: hash(2) } },
        db
      ),
      /Conflicting earned voucher terms termsHash/
    );
    const consent = event("VoucherTermsConsented", {
      commitmentId: 7n,
      revision: 1n,
      participant: HOLDER,
    });
    await projectEarnedVoucherTerms(consent, db);
    await projectEarnedVoucherTerms({ ...consent, block: { number: 12, timestamp: 12 } }, db);
    await projectEarnedVoucherTerms(
      event("VoucherTermsConsented", { commitmentId: 7n, revision: 2n, participant: HOLDER }, 13),
      db
    );
    const consents = await db.EarnedVoucherConsent.getAll();
    assert.equal(consents.length, 2);
    assert.equal(consents.find((row) => row.revision === 1n)?.blockNumber, 10n);
    assert.equal((await db.EarnedVoucherRevision.getAll()).length, 0);
  });

  it("records every dispatch and only the newest authenticated result", async () => {
    const db = createTestIndexer();
    await projectEarnedVoucherDistribution(
      event("VoucherDistributionPrepared", {
        entitlementId: ENTITLEMENT,
        commitmentId: 7n,
        payloadHash: hash(3),
      }),
      db
    );
    for (const [block, message] of [
      [11, hash(41)],
      [13, hash(42)],
    ] as const) {
      const dispatched = event(
        "VoucherDistributionDispatched",
        { entitlementId: ENTITLEMENT, messageId: message },
        block
      );
      await projectEarnedVoucherDistribution(dispatched, db);
      await projectEarnedVoucherDistribution(dispatched, db);
    }
    const failed = event(
      "VoucherResultRecorded",
      { entitlementId: ENTITLEMENT, resultSequence: 1n, success: false, failureHash: hash(5) },
      14
    );
    const delivered = event(
      "VoucherResultRecorded",
      { entitlementId: ENTITLEMENT, resultSequence: 2n, success: true, failureHash: hash(0) },
      15
    );
    await projectEarnedVoucherDistribution(delivered, db);
    await projectEarnedVoucherDistribution(failed, db);
    const row = await db.EarnedVoucherDistribution.get(cosmoId(42161, SOURCE, ENTITLEMENT));
    assert.equal(row?.commitmentId, 7n);
    assert.equal(row?.lastMessageId, hash(42));
    assert.equal(row?.resultSequence, 2n);
    assert.equal(row?.delivered, true);
    assert.equal((await db.EarnedVoucherDispatch.getAll()).length, 2);
    await assert.rejects(
      projectEarnedVoucherDistribution(
        { ...delivered, params: { ...delivered.params, success: false } },
        db
      ),
      /Conflicting earned voucher result delivered/
    );
  });

  it("keeps adapter attempts and acknowledgments separate from source delivery", async () => {
    const db = createTestIndexer();
    const recorded = event(
      "CommandRecorded",
      { entitlementId: ENTITLEMENT, payloadHash: hash(3), messageId: hash(41) },
      20,
      0,
      100
    );
    const attempt = (sequence: bigint, success: boolean, block: number) =>
      event(
        "DistributionResult",
        {
          entitlementId: ENTITLEMENT,
          sequence,
          success,
          failureHash: success ? hash(0) : hash(6),
          reason: success ? "0x" : "0xdead",
        },
        block,
        1,
        100
      );
    await projectVoucherDistributionDelivery(recorded, db);
    await projectVoucherDistributionDelivery(attempt(1n, false, 20), db);
    await projectVoucherDistributionDelivery(
      event(
        "AcknowledgmentFailed",
        { entitlementId: ENTITLEMENT, sequence: 1n, reason: "0xbeef" },
        20,
        2,
        100
      ),
      db
    );
    await projectVoucherDistributionDelivery(attempt(2n, true, 22), db);
    await projectVoucherDistributionDelivery(attempt(2n, true, 22), db);
    await projectVoucherDistributionDelivery(
      event(
        "AcknowledgmentSent",
        { entitlementId: ENTITLEMENT, sequence: 2n, messageId: hash(43) },
        23,
        0,
        100
      ),
      db
    );
    const command = await db.VoucherDistributionCommand.get(cosmoId(100, SOURCE, ENTITLEMENT));
    assert.equal(command?.firstMessageId, hash(41));
    assert.equal(command?.latestSequence, 2n);
    assert.equal(command?.delivered, true);
    assert.equal((await db.VoucherDistributionAttempt.getAll()).length, 2);
    const acknowledgments = await db.VoucherDistributionAcknowledgment.getAll();
    assert.deepEqual(acknowledgments.map((row) => row.sent).sort(), [false, true]);
    assert.equal((await db.EarnedVoucherDistribution.getAll()).length, 0);
    await assert.rejects(
      projectVoucherDistributionDelivery(attempt(2n, false, 22), db),
      /Conflicting distribution attempt success/
    );
  });

  it("orders steward sends and mirrors by revision, and finalizes the bootstrap once", async () => {
    const db = createTestIndexer();
    await projectStewardRoleSource(
      event("StewardQueued", { account: HOLDER, revision: 1n, eligible: true }),
      db
    );
    await projectStewardRoleSource(
      event("DispatchDeferred", { account: HOLDER, revision: 1n }, 11),
      db
    );
    await projectStewardRoleSource(
      event(
        "StewardDispatched",
        { account: HOLDER, revision: 1n, eligible: true, messageId: hash(50) },
        12
      ),
      db
    );
    const source = await db.StewardRoleSource.get(cosmoId(42161, SOURCE, HOLDER));
    assert.equal(source?.dispatchedRevision, 1n);
    assert.equal(source?.deferredRevision, 1n);
    assert.equal(source?.lastMessageId, hash(50));

    const mirror = (revision: bigint, eligible: boolean, block: number) =>
      event("StewardMirrored", { account: HOLDER, revision, eligible }, block, 0, 100);
    await projectStewardRoleMirror(mirror(2n, false, 30), db);
    await projectStewardRoleMirror(mirror(1n, true, 31), db);
    await projectStewardRoleMirror(
      event("ReconciliationDeferred", { account: HOLDER }, 30, 1, 100),
      db
    );
    await projectStewardRoleMirror(
      event("StewardReconciled", { account: HOLDER, eligible: false }, 32, 0, 100),
      db
    );
    const mirrored = await db.StewardRoleMirror.get(cosmoId(100, SOURCE, HOLDER));
    assert.equal(mirrored?.revision, 2n);
    assert.equal(mirrored?.eligible, false);
    assert.equal(mirrored?.reconciledEligible, false);
    assert.equal(mirrored?.reconciliationDeferred, false);
    await assert.rejects(
      projectStewardRoleMirror(mirror(2n, true, 33), db),
      /Conflicting mirrored steward revision/
    );

    const finalized = { ...event("BootstrapFinalized", {}, 34, 0, 100) };
    await projectStewardSafeBootstrap(finalized, db);
    await projectStewardSafeBootstrap({ ...finalized, block: { number: 35, timestamp: 35 } }, db);
    const state = await db.StewardSafeReceiverState.get(cosmoId(100, SOURCE));
    assert.equal(state?.bootstrapFinalized, true);
    assert.equal(state?.finalizedBlockNumber, 34n);
  });

  it("routes the live pilot through configured Gnosis addresses and the core's setup pin", async () => {
    const db = createTestIndexer();
    const receiver = indexedAddress("StewardSafeReceiver", 100);
    const adapter = indexedAddress("GnosisVoucherAdapter", 100);
    const core = indexedAddress("CommitmentPoolingModule", 42161);
    await processEvents(db, [
      {
        contract: "StewardSafeReceiver",
        event: "StewardMirrored",
        chainId: 100,
        srcAddress: receiver,
        params: { account: HOLDER, revision: 1n, eligible: true },
        block: { number: 48_930_000, timestamp: 1_792_900_000 },
        logIndex: 0,
        transaction: { hash: hash(900) },
      },
      {
        contract: "GnosisVoucherAdapter",
        event: "CommandRecorded",
        chainId: 100,
        srcAddress: adapter,
        params: { entitlementId: ENTITLEMENT, payloadHash: hash(3), messageId: hash(41) },
        block: { number: 48_930_001, timestamp: 1_792_900_005 },
        logIndex: 0,
        transaction: { hash: hash(901) },
      },
      {
        contract: "CommitmentPoolingModule",
        event: "VoucherServiceSetupModulePinned",
        chainId: 42161,
        srcAddress: core,
        params: { module: OTHER },
        block: { number: 518_000_000, timestamp: 1_792_900_000 },
        logIndex: 0,
        transaction: { hash: hash(902) },
      },
      {
        contract: "VoucherRedemptionModule",
        event: "VoucherPauseChanged",
        chainId: 42161,
        srcAddress: OTHER,
        params: { paused: false },
        block: { number: 518_000_001, timestamp: 1_792_900_010 },
        logIndex: 0,
        transaction: { hash: hash(903) },
      },
    ]);
    assert.equal((await db.StewardRoleMirror.getAll())[0]?.moduleAddress, receiver.toLowerCase());
    assert.equal((await db.VoucherDistributionCommand.getAll())[0]?.payloadHash, hash(3));
    assert.equal((await db.VoucherEndpointConfiguration.get(cosmoId(42161, OTHER)))?.paused, false);

    const unpinned = createTestIndexer();
    await assert.rejects(
      processEvents(unpinned, [
        {
          contract: "VoucherRedemptionModule",
          event: "VoucherPauseChanged",
          chainId: 42161,
          srcAddress: ISSUER,
          params: { paused: false },
          block: { number: 518_000_002, timestamp: 1_792_900_020 },
          logIndex: 0,
          transaction: { hash: hash(904) },
        },
      ]),
      /never reached a handler/
    );
  });
});
