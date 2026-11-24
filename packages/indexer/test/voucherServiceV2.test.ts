import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { cosmoId } from "../src/handlers/cosmo-local-projections";
import { projectRedemptionCustody } from "../src/handlers/voucher-redemption-custody";
import { projectCoreVoucher } from "../src/handlers/core-voucher-acceptance";
import { projectVoucherServiceSource } from "../src/handlers/voucher-service-source";
import { projectVoucherServiceCustody } from "../src/handlers/voucher-service-custody";
import { projectVoucherServiceFinal } from "../src/handlers/voucher-service-final";
import { projectVoucherServiceAcknowledgment } from "../src/handlers/voucher-service-acks";
import { createTestIndexer } from "./v3";
import {
  SOURCE,
  ESCROW,
  HOLDER,
  CORE,
  TOKEN,
  SETUP,
  AUTH,
  DECISION,
  ACTIVATION,
  DEPOSIT,
  EXACT,
  hash,
  event,
  authEvent,
  setupResult,
  freeze,
  leg,
  finalResult,
  sharedPresentment,
} from "./voucherServiceFixtures";

const custodyId = cosmoId(100, ESCROW, SETUP),
  sourceId = cosmoId(42161, SOURCE, SETUP);

describe("voucher service v2 protocol separation", () => {
  it("keeps shared presentment before typed authorization out of legacy custody totals", async () => {
    const db = createTestIndexer();
    await projectRedemptionCustody(sharedPresentment(), db);
    const placeholder = await db.VoucherRedemptionCustody.get(custodyId);
    assert.equal(placeholder?.authorizationSeen, false);
    assert.equal(
      placeholder?.escrowedUnits,
      0n,
      "a shared-name observation must not establish authorized legacy-v1 custody"
    );
    assert.equal(placeholder?.presentedUnitsObserved, EXACT);
    await projectRedemptionCustody(
      event("RedemptionAuthorizationRecorded", {
        redemptionId: SETUP,
        payloadHash: AUTH,
        messageId: hash(12),
      }),
      db
    );
    assert.equal((await db.VoucherRedemptionCustody.get(custodyId))?.escrowedUnits, EXACT);
  });

  it("keeps v1 incomplete and v2 custody exact for both shared/auth arrival orders", async () => {
    for (const order of [0, 1]) {
      const db = createTestIndexer();
      if (order === 0) await projectRedemptionCustody(sharedPresentment(), db);
      await projectVoucherServiceCustody(authEvent(), db);
      if (order === 1) await projectRedemptionCustody(sharedPresentment(), db);
      await projectVoucherServiceCustody(setupResult(), db);
      assert.equal((await db.VoucherRedemptionCustody.get(custodyId))?.authorizationSeen, false);
      assert.equal((await db.VoucherRedemptionCustody.get(custodyId))?.escrowedUnits, 0n);
      const latest = await db.VoucherServiceSetupResult.get(`${custodyId}-${EXACT}`);
      assert.equal(latest?.depositedUnits, EXACT);
      assert.equal(latest?.endpointRole, "DESTINATION");
      assert.equal((await db.VoucherServiceCustody.get(custodyId))?.sourceSetupEntityId, sourceId);
    }
  });

  it("keeps source pending/unknown independently of destination success and lost acknowledgment", async () => {
    const db = createTestIndexer();
    await projectVoucherServiceSource(authEvent(true), db);
    await projectVoucherServiceCustody(setupResult(), db);
    await projectVoucherServiceAcknowledgment(
      event("VoucherServiceAcknowledgmentFailed", {
        finalResult: false,
        sequence: EXACT,
        reason: "0xdead",
      }),
      db
    );
    assert.equal((await db.VoucherServiceSetup.get(sourceId))?.latestSetupSequence, 0n);
    assert.equal((await db.VoucherServiceCustody.get(custodyId))?.latestSetupSequence, EXACT);
    assert.equal((await db.VoucherServiceAcknowledgment.getAll())[0]?.sent, false);
    await projectVoucherServiceSource(setupResult(EXACT, true), db);
    assert.equal((await db.VoucherServiceSetup.get(sourceId))?.latestSetupSequence, EXACT);
    assert.equal((await db.VoucherServiceSetupResult.getAll()).length, 2);
  });

  it("preserves incomplete result-before-auth and rejects same-sequence conflicting payloads", async () => {
    const db = createTestIndexer();
    await projectVoucherServiceCustody(setupResult(), db);
    assert.equal((await db.VoucherServiceCustody.get(custodyId))?.authorizationSeen, false);
    assert.equal((await db.VoucherServiceCustody.get(custodyId))?.holder, undefined);
    await projectVoucherServiceCustody(authEvent(), db);
    await projectVoucherServiceCustody(setupResult(), db);
    const changed = setupResult();
    const result = changed.params.result as Record<string, unknown>;
    await assert.rejects(
      projectVoucherServiceCustody(
        {
          ...changed,
          params: { ...changed.params, result: { ...result, issuerApproved: false } },
        },
        db
      ),
      /immutable setup sequence/
    );
    assert.equal((await db.VoucherServiceSetupResult.getAll()).length, 1);
    await projectVoucherServiceCustody(setupResult(EXACT - 1n, false, 1), db);
    assert.equal((await db.VoucherServiceCustody.get(custodyId))?.latestSetupSequence, EXACT);
  });

  it("freezes one final split and independently repairs/replays legs without adding units twice", async () => {
    const db = createTestIndexer();
    await projectVoucherServiceCustody(authEvent(), db);
    await projectVoucherServiceFinal(leg(0n, 2n, 3n), db);
    await projectVoucherServiceFinal(freeze(), db);
    await projectVoucherServiceFinal(leg(0n, 1n, 2n, 3), db);
    await projectVoucherServiceFinal(leg(1n), db);
    await projectVoucherServiceFinal(leg(1n), db);
    await projectVoucherServiceFinal(
      event("VoucherEscrowFinanciallyClosed", { decisionId: DECISION }, 8),
      db
    );
    const row = await db.VoucherServiceFinalAllocation.get(`${custodyId}-${DECISION}`);
    assert.equal(row?.approvedDeliveredServiceUnits, 4n);
    assert.equal(row?.releaseVoucherUnits, EXACT - 7n);
    assert.equal(row?.refundVoucherUnits, 7n);
    assert.equal(row?.releaseState, 3);
    assert.equal(row?.releaseAttempts, 2n);
    assert.equal(row?.financialClosedSeen, true);
    assert.equal((await db.VoucherServiceFinalLegResult.getAll()).length, 3);
    await assert.rejects(
      projectVoucherServiceFinal(
        { ...freeze(), params: { ...freeze().params, refundVoucherUnits: 8n } },
        db
      ),
      /immutable holder final allocation/
    );
    await assert.rejects(
      projectVoucherServiceFinal({ ...leg(), params: { ...leg().params, recipient: TOKEN } }, db),
      /final leg recipient/
    );
  });

  it("keeps authenticated final and setup sequences separate even when final acknowledgment arrives first", async () => {
    const db = createTestIndexer();
    await projectVoucherServiceSource(finalResult(), db);
    await projectVoucherServiceSource(setupResult(1n, true), db);
    await projectVoucherServiceSource(authEvent(true), db);
    const row = await db.VoucherServiceSetup.get(sourceId);
    assert.equal(row?.latestFinalSequence, EXACT);
    assert.equal(row?.latestSetupSequence, 1n);
    assert.equal(row?.authorizationSeen, true);
    assert.equal(row?.decisionSeen, false);
    const changed = finalResult();
    const result = changed.params.result as Record<string, unknown>;
    await assert.rejects(
      projectVoucherServiceSource(
        {
          ...changed,
          params: { ...changed.params, result: { ...result, issuerReturnApprovalAtFreeze: 8n } },
        },
        db
      ),
      /immutable final result sequence/
    );
  });

  it("rejects contradictory final holder and quantity facts when authorization arrives last", async () => {
    const db = createTestIndexer();
    await projectVoucherServiceFinal(
      { ...freeze(), params: { ...freeze().params, holder: TOKEN } },
      db
    );
    await assert.rejects(projectVoucherServiceCustody(authEvent(), db), /final.*holder/);
    const sourceDb = createTestIndexer();
    await projectVoucherServiceSource(finalResult(), sourceDb);
    const auth = authEvent(true);
    await assert.rejects(
      projectVoucherServiceSource(
        {
          ...auth,
          params: {
            ...auth.params,
            authorization: {
              ...(auth.params.authorization as Record<string, unknown>),
              voucherUnits: EXACT + 1n,
            },
          },
        },
        sourceDb
      ),
      /final voucher conservation/
    );
  });

  it("rejects setup quantity contradictions before and after either endpoint receives authorization", async () => {
    for (const source of [false, true]) {
      const project = source ? projectVoucherServiceSource : projectVoucherServiceCustody;
      const invalid = setupResult(EXACT, source);
      const result = invalid.params.result as Record<string, unknown>;
      const changed = {
        ...invalid,
        params: { ...invalid.params, result: { ...result, depositedUnits: EXACT - 1n } },
      };
      const lateAuth = createTestIndexer();
      await project(changed, lateAuth);
      await assert.rejects(project(authEvent(source), lateAuth), /setup deposited units/);
      const competingSnapshots = createTestIndexer();
      await project(changed, competingSnapshots);
      await assert.rejects(
        project(setupResult(EXACT + 1n, source), competingSnapshots),
        /setup deposited units/
      );
      const firstAuth = createTestIndexer();
      await project(authEvent(source), firstAuth);
      await assert.rejects(project(changed, firstAuth), /setup deposited units/);
    }
  });

  it("keeps accepted-ever core receipts distinct from source decisions and enforces exact claim joins", async () => {
    const db = createTestIndexer();
    const accepted = {
      ...event(
        "VoucherServiceAcceptanceRecorded",
        {
          commitmentId: EXACT,
          setupModule: SOURCE,
          claimHash: hash(7),
          revision: EXACT,
          requestNonce: EXACT,
          setupId: SETUP,
          authorizationHash: AUTH,
          depositReceiptHash: DEPOSIT,
        },
        1,
        true
      ),
      srcAddress: CORE,
    };
    await projectCoreVoucher(accepted, db);
    await projectCoreVoucher(accepted, db);
    const row = await db.VoucherServiceAcceptance.get(cosmoId(42161, CORE, EXACT));
    assert.equal(row?.sourceSetupEntityId, sourceId);
    assert.equal(row?.claimEntityId, cosmoId(42161, CORE, hash(7)));
    assert.equal(await db.VoucherServiceSetup.get(sourceId), undefined);
    await assert.rejects(
      projectCoreVoucher(
        { ...accepted, params: { ...accepted.params, depositReceiptHash: hash(99) } },
        db
      ),
      /accepted voucher setup/
    );
  });

  it("isolates identical setup/sequence IDs by chain and module and rejects false emitting scopes", async () => {
    const db = createTestIndexer();
    await projectVoucherServiceCustody(setupResult(), db);
    await projectVoucherServiceCustody({ ...setupResult(), chainId: 101 }, db);
    await projectVoucherServiceCustody({ ...setupResult(), srcAddress: TOKEN }, db);
    assert.equal((await db.VoucherServiceSetupResult.getAll()).length, 3);
    await assert.rejects(
      projectVoucherServiceCustody({ ...authEvent(), srcAddress: TOKEN }, db),
      /setup emitting module/
    );
  });

  it("executes every new event through actual registered Envio routes with decoded tuples", async () => {
    const directory = await mkdtemp(join(tmpdir(), "green-goods-voucher-v2-"));
    try {
      const packageRoot = fileURLToPath(new URL("../", import.meta.url));
      const production = await readFile(new URL("../config.yaml", import.meta.url), "utf8");
      const fixture =
        production
          .split("\nchains:\n")[0]!
          .replaceAll(
            "handler: src/EventHandlers.ts",
            `handler: "${packageRoot}src/EventHandlers.ts"`
          ) +
        `\nschema: "${packageRoot}schema.graphql"\nchains:\n  - id: 42161\n    start_block: 0\n    contracts:\n      - name: CommitmentPoolingModule\n        address: "${CORE}"\n      - name: VoucherRedemptionModule\n        address: "${SOURCE}"\n  - id: 100\n    start_block: 0\n    contracts:\n      - name: GnosisVoucherEscrow\n        address: "${ESCROW}"\n`;
      await writeFile(join(directory, "config.yaml"), fixture);
      const core = (name: string, params: Record<string, unknown>) => ({
        ...event(name, params, 1, true),
        srcAddress: CORE,
      });
      const sourceEvents = [
        core("EarnedVoucherModulePinned", { module: TOKEN }),
        core("VoucherServiceSetupModulePinned", { module: SOURCE }),
        core("EarnedVoucherTermsBound", {
          commitmentId: 1n,
          module: TOKEN,
          revision: EXACT,
          termsHash: AUTH,
        }),
        core("EarnedVoucherAcceptanceRecorded", {
          commitmentId: 1n,
          module: TOKEN,
          revision: EXACT,
          termsHash: AUTH,
          creator: HOLDER,
          counterparty: TOKEN,
        }),
        core("VoucherServiceAcceptanceRecorded", {
          commitmentId: EXACT,
          setupModule: SOURCE,
          claimHash: hash(7),
          revision: EXACT,
          requestNonce: EXACT,
          setupId: SETUP,
          authorizationHash: AUTH,
          depositReceiptHash: DEPOSIT,
        }),
        authEvent(true),
        event(
          "VoucherSetupDecisionSelected",
          {
            decisionId: ACTIVATION,
            command: {
              version: 2n,
              setupId: SETUP,
              authorizationHash: AUTH,
              decision: 1n,
              expectedDepositReceiptHash: DEPOSIT,
              coreAcceptanceHash: hash(30),
              abortReason: 0n,
            },
          },
          1,
          true
        ),
        event("VoucherSetupDispatched", { messageId: hash(31), kind: 1n }, 1, true),
        setupResult(EXACT, true),
        finalResult(),
        event("VoucherHolderAbortRequested", { holder: HOLDER, alreadyAccepted: true }, 1, true),
      ];
      const destinationEvents = [
        authEvent(),
        event("VoucherSetupDecisionApplied", { decisionId: ACTIVATION, decision: 1n }),
        setupResult(),
        event("VoucherSetupActionResult", {
          action: 1n,
          success: false,
          failureHash: hash(33),
          reason: "0xdead",
        }),
        event("VoucherSetupHolderAbortRequested", { holder: HOLDER, messageId: hash(34) }),
        freeze(),
        leg(),
        event("VoucherEscrowFinanciallyClosed", { decisionId: DECISION }),
        event("VoucherServiceAcknowledgmentSent", {
          finalResult: false,
          sequence: EXACT,
          messageId: hash(35),
        }),
        event("VoucherServiceAcknowledgmentFailed", {
          finalResult: true,
          sequence: EXACT,
          reason: "0xbeef",
        }),
      ];
      const encode = (value: unknown) =>
        JSON.stringify(value, (_key, v: unknown) =>
          typeof v === "bigint" ? { uint: v.toString() } : v
        );
      const script = `import assert from "node:assert/strict"; import { createTestIndexer } from ${JSON.stringify(import.meta.resolve("envio"))};
        await import(${JSON.stringify(new URL("../src/EventHandlers.ts", import.meta.url).href)}); const db=createTestIndexer();
        const decode=s=>JSON.parse(s,(_k,v)=>v&&typeof v==='object'&&'uint'in v?BigInt(v.uint):v);
        const src=decode(${JSON.stringify(encode(sourceEvents))}),dst=decode(${JSON.stringify(encode(destinationEvents))});
        const simulate=(events,source)=>events.map((e,i)=>({contract:source?(e.srcAddress===${JSON.stringify(CORE)}?'CommitmentPoolingModule':'VoucherRedemptionModule'):'GnosisVoucherEscrow',event:e.eventName,params:e.params,srcAddress:e.srcAddress,block:{number:1,timestamp:100},transaction:{hash:'0x'+(i+1000).toString(16).padStart(64,'0')},logIndex:i}));
        await db.process({chains:{42161:{simulate:simulate(src,true)},100:{simulate:simulate(dst,false)}}});
        for(const name of ['VoucherCoreConfiguration','EarnedVoucherRevision','VoucherServiceAcceptance','VoucherServiceSetup','VoucherServiceCustody','VoucherServiceSetupResult','VoucherServiceSetupAction','VoucherServiceFinalAllocation','VoucherServiceFinalLegResult','VoucherServiceFinalResult','VoucherServiceAcknowledgment'])assert.ok((await db[name].getAll()).length,name);
        assert.equal((await db.VoucherServiceSetup.getAll())[0].termsRevision,9007199254740993n); assert.equal((await db.VoucherServiceSetupResult.getAll()).length,2);
        assert.equal((await db.VoucherServiceFinalAllocation.getAll())[0].approvedDeliveredServiceUnits,4n); console.log('21 new registered routes,11 entities,24-field authorization and nested result tuples decoded');`;
      const result = spawnSync(
        process.execPath,
        ["--import", import.meta.resolve("tsx"), "--input-type=module", "-e", script],
        { cwd: directory, encoding: "utf8", timeout: 20000 }
      );
      assert.equal(result.status, 0, result.stderr + result.stdout);
      assert.match(result.stdout, /21 new registered routes/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
