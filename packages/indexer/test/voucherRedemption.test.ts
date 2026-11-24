import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { cosmoId, type CosmoEvent } from "../src/handlers/cosmo-local-projections";
import { projectRedemptionSource } from "../src/handlers/voucher-redemption-source";
import { projectRedemptionCustody } from "../src/handlers/voucher-redemption-custody";
import { projectRedemptionActionResult } from "../src/handlers/voucher-redemption-actions";
import { projectRedemptionAcknowledgment } from "../src/handlers/voucher-redemption-acks";
import { createTestIndexer } from "./v3";

const SOURCE = "0x000000000000000000000000000000000000a001";
const ESCROW = "0x000000000000000000000000000000000000b001";
const HOLDER = "0x000000000000000000000000000000000000c001";
const ISSUER = "0x000000000000000000000000000000000000d001";
const TOKEN = "0x000000000000000000000000000000000000e001";
const hash = (n: number) => `0x${n.toString(16).padStart(64, "0")}`;
const REDEMPTION = hash(1);
const PAYLOAD = hash(2);
const EXACT = 9_007_199_254_740_993n;
function event(
  eventName: string,
  params: CosmoEvent["params"],
  block: number,
  source = false
): CosmoEvent {
  return {
    eventName,
    chainId: source ? 42161 : 100,
    srcAddress: source ? SOURCE : ESCROW,
    params: { redemptionId: REDEMPTION, ...params },
    block: { number: block, timestamp: block },
    transaction: { hash: hash(block + 100) },
    logIndex: 0,
  };
}
const auth = () =>
  event("RedemptionAuthorizationRecorded", { payloadHash: PAYLOAD, messageId: hash(3) }, 1);
const approval = () =>
  event(
    "HolderDeliveryApproved",
    {
      holder: HOLDER,
      actionHash: hash(5),
      newlyApprovedServiceUnits: 2n,
      cumulativeApprovedServiceUnits: 2n,
      voucherUnits: EXACT,
      cumulativeApprovedVoucherUnits: EXACT,
    },
    3
  );
const result = (
  kind: bigint,
  sequence: bigint,
  success: boolean,
  actionHash = hash(5),
  block = 4
) =>
  event(
    "RedemptionActionResult",
    {
      actionHash,
      sequence,
      kind,
      voucherUnits: kind === 3n ? 7n : EXACT,
      serviceUnits: kind === 2n ? 2n : 0n,
      success,
      failureHash: success ? hash(0) : hash(9),
      reason: success ? "0x" : "0xdead",
    },
    block
  );
const sourceResult = (sequence: bigint, state: bigint, block = 8) =>
  event(
    "RedemptionResultRecorded",
    {
      sequence,
      state,
      escrowedUnits: EXACT,
      holderApprovedServiceUnits: 2n,
      holderApprovedVoucherUnits: EXACT,
      mutualReturnUnits: 0n,
      releasedUnits: EXACT,
      returnedUnits: 0n,
      actionSucceeded: true,
      failureHash: hash(0),
    },
    block,
    true
  );

describe("voucher service source versus durable destination facts", () => {
  it("rejects cumulative approval changes under an already recorded action hash", async () => {
    for (const field of [
      "cumulativeApprovedServiceUnits",
      "cumulativeApprovedVoucherUnits",
    ] as const) {
      const db = createTestIndexer();
      await projectRedemptionCustody(approval(), db);
      await assert.rejects(
        projectRedemptionCustody(
          {
            ...approval(),
            params: {
              ...approval().params,
              [field]: field === "cumulativeApprovedServiceUnits" ? 3n : EXACT + 1n,
            },
          },
          db
        ),
        /immutable action approval/
      );
    }
    const db = createTestIndexer();
    const returned = event(
      "HolderReturnApproved",
      { holder: HOLDER, actionHash: hash(6), units: 7n, cumulativeReturnUnits: 7n },
      7
    );
    await projectRedemptionCustody(returned, db);
    await assert.rejects(
      projectRedemptionCustody(
        { ...returned, params: { ...returned.params, cumulativeReturnUnits: 8n } },
        db
      ),
      /immutable action approval/
    );
  });

  it("rejects a changed approval signer even if its parent holder hint is unavailable", async () => {
    const db = createTestIndexer();
    await projectRedemptionCustody(approval(), db);
    const custody = await db.VoucherRedemptionCustody.get(cosmoId(100, ESCROW, REDEMPTION));
    assert.ok(custody);
    // Model partial relation hydration; the action's explicit signer remains an immutable fact.
    await db.VoucherRedemptionCustody.set({ ...custody, holder: undefined });
    await assert.rejects(
      projectRedemptionCustody(
        { ...approval(), params: { ...approval().params, holder: ISSUER } },
        db
      ),
      /immutable action approval/
    );
  });

  it("executes all additive registrations through real Envio v3 using an isolated fictional chain configuration", async () => {
    const directory = await mkdtemp(join(tmpdir(), "green-goods-service-events-"));
    try {
      const packageRoot = fileURLToPath(new URL("../", import.meta.url));
      const production = await readFile(new URL("../config.yaml", import.meta.url), "utf8");
      const definitions = production.split("\nchains:\n")[0]!;
      const settlement = "0x000000000000000000000000000000000000f001";
      const core = "0x000000000000000000000000000000000000f002";
      const fixture =
        definitions.replaceAll(
          "handler: src/EventHandlers.ts",
          `handler: "${packageRoot}src/EventHandlers.ts"`
        ) +
        `\nschema: "${packageRoot}schema.graphql"\nchains:\n  - id: 42161\n    start_block: 0\n    contracts:\n      - name: CommitmentPoolingModule\n        address: "${core}"\n      - name: SettlementModule\n        address: "${settlement}"\n      - name: VoucherRedemptionModule\n        address: "${SOURCE}"\n  - id: 100\n    start_block: 0\n    contracts:\n      - name: GnosisVoucherEscrow\n        address: "${ESCROW}"\n`;
      await writeFile(join(directory, "config.yaml"), fixture);
      // A separate process loads its own test-only config. Production codegen/config stay untouched.
      const script = `
        import assert from "node:assert/strict";
        import { createTestIndexer } from ${JSON.stringify(import.meta.resolve("envio"))};
        await import(${JSON.stringify(new URL("../src/EventHandlers.ts", import.meta.url).href)});
        const db = createTestIndexer();
        const exact = 9007199254740993n;
        const source = ${JSON.stringify(SOURCE)}, escrow = ${JSON.stringify(ESCROW)};
        const core = ${JSON.stringify(core)}, settlement = ${JSON.stringify(settlement)};
        const holder = ${JSON.stringify(HOLDER)}, issuer = ${JSON.stringify(ISSUER)}, token = ${JSON.stringify(TOKEN)};
        const id = ${JSON.stringify(REDEMPTION)}, payload = ${JSON.stringify(PAYLOAD)};
        const hash = n => "0x" + n.toString(16).padStart(64, "0");
        const simulate = (contract, event, srcAddress, params, index) => ({ contract, event, srcAddress, params,
          block: { number: 1, timestamp: 100 }, transaction: { hash: hash(1000 + index) }, logIndex: index });
        const sourceEvents = [
          ["CommitmentPoolingModule", "ServiceOfferTermsSet", core, { commitmentId: 10n, revision: exact, termsHash: hash(21), route: 2n, gdPrice: 0n }],
          ["CommitmentPoolingModule", "ServiceClaimConsentRequested", core, { commitmentId: 10n, buyer: holder, claimHash: hash(22), revision: exact, requestNonce: exact, buyerGarden: holder, voucherHolder: holder }],
          ["CommitmentPoolingModule", "ServiceClaimConsentWithdrawn", core, { commitmentId: 10n, buyer: holder, claimHash: hash(22) }],
          ["CommitmentPoolingModule", "ServiceClaimConsentAccepted", core, { commitmentId: 10n, buyer: holder, claimHash: hash(23), revision: exact, requestNonce: exact + 1n }],
          ["SettlementModule", "PersonalServicePurchasePledged", settlement, { fundingId: 1n, purchaseId: hash(24), commitmentId: 11n, terms: {
            version: 1n, purchaseId: hash(24), sourceChainId: 42161n, sourceModule: settlement, commitmentId: 11n,
            termsRevision: exact, termsHash: hash(21), claimHash: hash(23), requestNonce: exact,
            buyer: holder, recipient: holder, buyerGarden: holder, providerGarden: issuer,
            destinationChainId: 42220n, token, price: exact, custodySafe: issuer,
            authorizedDepositor: holder, refundAccount: holder, disclosedGrossAmount: exact + 1n, disclosedNetAmount: exact } }],
          ["SettlementModule", "PersonalServiceDepositVerified", settlement, { receiptKey: hash(25), fundingId: 1n, purchaseId: hash(24), verifiedBy: issuer,
            deposit: { chainId: 42220n, token, transactionHash: hash(26), logIndex: 3000000001n, blockNumber: 75178393n,
              blockHash: hash(27), depositingAccount: holder, custodySafe: issuer, grossDebit: exact + 1n, receivedAmount: exact } }],
          ["SettlementModule", "PersonalServicePurchaseOutcomeSelected", settlement, { fundingId: 1n, purchaseId: hash(24), outcome: 2n, payoutPlanId: 0n, refundDisbursementId: 8n }],
          ["SettlementModule", "PersonalServicePurchaseOutcomeCompleted", settlement, { fundingId: 1n, purchaseId: hash(24), outcome: 4n }],
          ["VoucherRedemptionModule", "VoucherEndpointPinned", source, { localChainId: 42161n, router: token, remoteChainSelector: exact, remoteChainId: 100n, remotePeer: escrow }],
          ["VoucherRedemptionModule", "VoucherPauseChanged", source, { paused: false }],
          ["VoucherRedemptionModule", "RedemptionPrepared", source, { redemptionId: id, commitmentId: 10n, payloadHash: payload }],
          ["VoucherRedemptionModule", "RedemptionDispatched", source, { redemptionId: id, messageId: hash(28) }],
          ["VoucherRedemptionModule", "RedemptionResultRecorded", source, { redemptionId: id, sequence: exact, state: 3n,
            escrowedUnits: exact, holderApprovedServiceUnits: 2n, holderApprovedVoucherUnits: exact,
            mutualReturnUnits: 0n, releasedUnits: exact, returnedUnits: 0n, actionSucceeded: true, failureHash: hash(0) }],
        ];
        const destinationEvents = [
          ["GnosisVoucherEscrow", "VoucherEndpointPinned", escrow, { localChainId: 100n, router: token, remoteChainSelector: exact, remoteChainId: 42161n, remotePeer: source }],
          ["GnosisVoucherEscrow", "VoucherPauseChanged", escrow, { paused: false }],
          ["GnosisVoucherEscrow", "RedemptionAuthorizationRecorded", escrow, { redemptionId: id, payloadHash: payload, messageId: hash(28) }],
          ["GnosisVoucherEscrow", "RedemptionIssuerApproved", escrow, { redemptionId: id, issuer, payloadHash: payload }],
          ["GnosisVoucherEscrow", "VoucherPresented", escrow, { redemptionId: id, holder, token, units: exact + 7n }],
          ["GnosisVoucherEscrow", "HolderDeliveryApproved", escrow, { redemptionId: id, holder, actionHash: hash(29), newlyApprovedServiceUnits: 2n,
            cumulativeApprovedServiceUnits: 2n, voucherUnits: exact, cumulativeApprovedVoucherUnits: exact }],
          ["GnosisVoucherEscrow", "RedemptionReturnAuthorized", escrow, { redemptionId: id, issuer, cumulativeReturnCeiling: 7n }],
          ["GnosisVoucherEscrow", "HolderReturnApproved", escrow, { redemptionId: id, holder, actionHash: hash(30), units: 7n, cumulativeReturnUnits: 7n }],
          ["GnosisVoucherEscrow", "RedemptionActionResult", escrow, { redemptionId: id, actionHash: hash(29), sequence: exact, kind: 2n,
            voucherUnits: exact, serviceUnits: 2n, success: true, failureHash: hash(0), reason: "0x" }],
          ["GnosisVoucherEscrow", "RedemptionAcknowledgmentFailed", escrow, { redemptionId: id, sequence: exact, reason: "0xdead" }],
          ["GnosisVoucherEscrow", "RedemptionAcknowledgmentSent", escrow, { redemptionId: id, sequence: exact, messageId: hash(31) }],
        ];
        await db.process({ chains: {
          42161: { simulate: sourceEvents.map((row, index) => simulate(...row, index)) },
          100: { simulate: destinationEvents.map((row, index) => simulate(...row, index)) },
        } });
        const offer = (await db.ServiceOfferRevision.getAll())[0];
        assert.equal(offer.paymentRoute, 2); assert.equal(offer.revision, exact);
        const purchase = (await db.PersonalServicePurchase.getAll())[0];
        assert.equal(purchase.version, 1); assert.equal(purchase.completedOutcome, 4); assert.equal(purchase.price, exact);
        assert.equal((await db.PersonalServiceDepositReceipt.getAll())[0].depositLogIndex, 3000000001n);
        assert.equal((await db.VoucherRedemption.getAll())[0].sourceState, 3);
        const custody = (await db.VoucherRedemptionCustody.getAll())[0];
        assert.equal(custody.releasedUnits, exact); assert.equal(custody.holderApprovedServiceUnits, 2n);
        assert.equal((await db.VoucherRedemptionActionResult.getAll())[0].actionKind, 2);
        assert.equal((await db.VoucherRedemptionAcknowledgment.getAll()).length, 2);
        for (const name of ["ServiceOfferRevision", "ServiceClaimConsent", "PersonalServicePurchase", "PersonalServiceDepositReceipt",
          "VoucherEndpointConfiguration", "VoucherRedemption", "VoucherRedemptionCustody", "VoucherRedemptionAction",
          "VoucherRedemptionActionResult", "VoucherRedemptionAcknowledgment"]) assert.ok((await db[name].getAll()).length, name);
        console.log("24 real registered simulated events; uint8 discriminants and nested tuples decoded; all10entity stores populated; fictional local accounts only");
      `;
      const result = spawnSync(
        process.execPath,
        ["--import", import.meta.resolve("tsx"), "--input-type=module", "-e", script],
        {
          cwd: directory,
          encoding: "utf8",
          timeout: 20_000,
        }
      );
      assert.equal(result.status, 0, result.stderr + result.stdout);
      assert.match(result.stdout, /24 real registered simulated events/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("keeps source pending when destination delivery succeeds but acknowledgment fails", async () => {
    const db = createTestIndexer();
    await projectRedemptionSource(
      event("RedemptionPrepared", { commitmentId: 10n, payloadHash: PAYLOAD }, 1, true),
      db
    );
    await projectRedemptionSource(
      event("RedemptionDispatched", { messageId: hash(3) }, 2, true),
      db
    );
    await projectRedemptionCustody(auth(), db);
    await projectRedemptionActionResult(result(1n, 2n, true, hash(4), 2), db);
    await projectRedemptionCustody(approval(), db);
    await projectRedemptionActionResult(result(2n, 3n, true), db);
    await projectRedemptionAcknowledgment(
      event("RedemptionAcknowledgmentFailed", { sequence: 3n, reason: "0xbeef" }, 5),
      db
    );
    assert.equal(
      (await db.VoucherRedemption.get(cosmoId(42161, SOURCE, REDEMPTION)))?.sourceState,
      2
    );
    assert.equal(
      (await db.VoucherRedemptionCustody.get(cosmoId(100, ESCROW, REDEMPTION)))?.releasedUnits,
      EXACT
    );
    assert.equal((await db.VoucherRedemptionAcknowledgment.getAll())[0]?.sent, false);
  });

  it("preserves holder approval through failure and repaired retry without repeating transfers", async () => {
    const db = createTestIndexer();
    await projectRedemptionCustody(approval(), db);
    await projectRedemptionActionResult(result(2n, 3n, false), db);
    let custody = await db.VoucherRedemptionCustody.get(cosmoId(100, ESCROW, REDEMPTION));
    assert.equal(custody?.holderApprovedServiceUnits, 2n);
    assert.equal(custody?.holderApprovedVoucherUnits, EXACT);
    assert.equal(custody?.releasedUnits, 0n);
    assert.equal(custody?.pendingActionHash, hash(5));
    await projectRedemptionActionResult(result(2n, 4n, true, hash(5), 5), db);
    await projectRedemptionActionResult(result(2n, 4n, true, hash(5), 5), db);
    await projectRedemptionActionResult(result(2n, 3n, false), db);
    custody = await db.VoucherRedemptionCustody.get(cosmoId(100, ESCROW, REDEMPTION));
    assert.equal(custody?.releasedUnits, EXACT);
    assert.equal(custody?.pendingActionHash, undefined);
    assert.equal((await db.VoucherRedemptionActionResult.getAll()).length, 2);
    const action = await db.VoucherRedemptionAction.get(
      cosmoId(100, ESCROW, `${REDEMPTION}-${hash(5)}`)
    );
    assert.equal(action?.holderApprovalSeen, true);
    assert.equal(action?.everSucceeded, true);
    assert.equal(action?.latestSuccess, true);
  });

  it("converges approvals, failed attempts, releases and returns under reorder and replay", async () => {
    const inputs = [
      auth(),
      approval(),
      result(2n, 3n, false),
      result(2n, 4n, true, hash(5), 5),
      event("RedemptionReturnAuthorized", { issuer: ISSUER, cumulativeReturnCeiling: 7n }, 6),
      event(
        "HolderReturnApproved",
        { holder: HOLDER, actionHash: hash(6), units: 7n, cumulativeReturnUnits: 7n },
        7
      ),
      result(3n, 6n, true, hash(6), 8),
    ];
    const rows = [];
    for (const order of [inputs, [...inputs].reverse(), [...inputs, ...inputs]]) {
      const db = createTestIndexer();
      for (const item of order) {
        if (item.eventName === "RedemptionActionResult")
          await projectRedemptionActionResult(item, db);
        else await projectRedemptionCustody(item, db);
      }
      rows.push(await db.VoucherRedemptionCustody.get(cosmoId(100, ESCROW, REDEMPTION)));
    }
    assert.deepEqual(rows[0], rows[1]);
    assert.deepEqual(rows[0], rows[2]);
    assert.equal(rows[0]?.releasedUnits, EXACT);
    assert.equal(rows[0]?.returnedUnits, 7n);
    assert.equal(rows[0]?.holderApprovedServiceUnits, 2n);
    assert.equal(rows[0]?.holderApprovedVoucherUnits, EXACT);
  });

  it("joins late endpoint provenance and keeps pause observations independent", async () => {
    const db = createTestIndexer();
    await projectRedemptionCustody(auth(), db);
    await projectRedemptionCustody(event("VoucherPauseChanged", { paused: false }, 5), db);
    await projectRedemptionCustody(
      event(
        "VoucherEndpointPinned",
        {
          localChainId: 100n,
          router: TOKEN,
          remoteChainSelector: EXACT,
          remoteChainId: 42161n,
          remotePeer: SOURCE,
        },
        1
      ),
      db
    );
    await projectRedemptionCustody(event("VoucherPauseChanged", { paused: true }, 2), db);
    const custody = await db.VoucherRedemptionCustody.get(cosmoId(100, ESCROW, REDEMPTION));
    const endpoint = await db.VoucherEndpointConfiguration.get(custody!.endpointEntityId);
    assert.equal(endpoint?.remotePeer, SOURCE);
    assert.equal(endpoint?.remoteChainSelector, EXACT);
    assert.equal(endpoint?.paused, false);
    assert.equal(custody?.authorizationSeen, true);
    await assert.rejects(
      projectRedemptionCustody(event("VoucherPauseChanged", { paused: true }, 5), db),
      /pause event position/
    );
  });

  it("applies only newer authenticated source snapshots without changing confirmation provenance", async () => {
    const db = createTestIndexer();
    await projectRedemptionSource(sourceResult(EXACT, 4n), db);
    await projectRedemptionSource(sourceResult(EXACT - 1n, 3n, 7), db);
    await projectRedemptionSource(
      event("RedemptionDispatched", { messageId: hash(4) }, 2, true),
      db
    );
    const source = await db.VoucherRedemption.get(cosmoId(42161, SOURCE, REDEMPTION));
    assert.equal(source?.sourceState, 4);
    assert.equal(source?.latestResultSequence, EXACT);
    assert.equal(source?.holderApprovedServiceUnits, 2n);
    assert.equal((await db.Commitment.getAll()).length, 0);
    assert.equal((await db.VoucherRedemptionCustody.getAll()).length, 0);
    await assert.rejects(
      projectRedemptionSource(
        {
          ...sourceResult(EXACT, 4n),
          params: { ...sourceResult(EXACT, 4n).params, returnedUnits: 1n },
        },
        db
      ),
      /Conflicting redemption result sequence/
    );
  });

  it("stores sent and failed acknowledgments as observations without modifying custody or source", async () => {
    const db = createTestIndexer();
    await projectRedemptionActionResult(result(2n, 4n, true), db);
    const before = await db.VoucherRedemptionCustody.getAll();
    const sent = event("RedemptionAcknowledgmentSent", { sequence: 4n, messageId: hash(8) }, 8);
    const failed = event("RedemptionAcknowledgmentFailed", { sequence: 3n, reason: "0xdead" }, 7);
    for (const item of [sent, failed, sent]) await projectRedemptionAcknowledgment(item, db);
    assert.deepEqual(await db.VoucherRedemptionCustody.getAll(), before);
    assert.equal((await db.VoucherRedemptionAcknowledgment.getAll()).length, 2);
    assert.equal((await db.VoucherRedemption.getAll()).length, 0);
  });

  it("keeps the same redemption and action hashes isolated across chains and modules", async () => {
    const db = createTestIndexer();
    for (const item of [
      result(2n, 4n, true),
      { ...result(2n, 4n, true), srcAddress: SOURCE },
      { ...result(2n, 4n, true), chainId: 42161 },
    ]) {
      await projectRedemptionActionResult(item, db);
    }
    assert.equal((await db.VoucherRedemptionAction.getAll()).length, 3);
    assert.equal((await db.VoucherRedemptionCustody.getAll()).length, 3);
  });

  it("rejects conflicting payload/result identities instead of rewriting durable facts", async () => {
    const db = createTestIndexer();
    await projectRedemptionCustody(auth(), db);
    await assert.rejects(
      projectRedemptionCustody(
        { ...auth(), params: { ...auth().params, payloadHash: hash(99) } },
        db
      ),
      /custody payload/
    );
    await projectRedemptionActionResult(result(2n, 4n, true), db);
    await assert.rejects(
      projectRedemptionActionResult(
        {
          ...result(2n, 4n, true),
          params: { ...result(2n, 4n, true).params, voucherUnits: EXACT + 1n },
        },
        db
      ),
      /immutable action result/
    );
    assert.equal(
      (await db.VoucherRedemptionCustody.get(cosmoId(100, ESCROW, REDEMPTION)))?.releasedUnits,
      EXACT
    );
  });
});
