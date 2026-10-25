import assert from "node:assert/strict";
import { cosmoId, type CosmoEvent } from "../src/handlers/cosmo-local-projections";
import {
  projectIssuerAuthority,
  projectReserveAsset,
  projectPoolExchange,
} from "../src/handlers/voucher-issuer";
import { createTestIndexer, indexedAddress, processEvents } from "./v3";
import { EXACT, HOLDER, ISSUER, SOURCE, TOKEN, hash } from "./voucherServiceFixtures";

const OTHER = "0x000000000000000000000000000000000000e002";
const ZERO = "0x0000000000000000000000000000000000000000";
function event(eventName: string, params: CosmoEvent["params"], block = 10): CosmoEvent {
  return {
    eventName,
    params,
    chainId: 100,
    srcAddress: SOURCE,
    block: { number: block, timestamp: block },
    logIndex: 2,
    transaction: { hash: hash(block) },
  };
}

describe("voucher issuer configuration and exchange observations", () => {
  it("keeps current source authority scoped by chain, emitter, issuer and token", async () => {
    const db = createTestIndexer();
    const configured = event("IssuerAuthorityConfigured", {
      issuer: ISSUER,
      token: TOKEN,
      authority: HOLDER,
    });
    await projectIssuerAuthority(configured, db);
    await projectIssuerAuthority({ ...configured, chainId: 42161 }, db);
    await projectIssuerAuthority({ ...configured, srcAddress: OTHER }, db);
    await projectIssuerAuthority(
      { ...configured, params: { ...configured.params, issuer: HOLDER } },
      db
    );
    await projectIssuerAuthority(
      { ...configured, params: { ...configured.params, token: OTHER } },
      db
    );
    assert.equal((await db.VoucherIssuerAuthority.getAll()).length, 5);
    const id = cosmoId(100, SOURCE, `${ISSUER}-${TOKEN}`);
    await projectIssuerAuthority(
      event("IssuerAuthorityConfigured", { ...configured.params, authority: ZERO }, 12),
      db
    );
    await projectIssuerAuthority(configured, db);
    assert.equal((await db.VoucherIssuerAuthority.get(id))?.authority, ZERO);
    assert.equal((await db.VoucherIssuerAuthority.get(id))?.blockNumber, 12n);
    assert.equal((await db.EarnedVoucherRevision.getAll()).length, 0);
  });

  it("records reserve disable independently, with exact duplicate conflict checks", async () => {
    const db = createTestIndexer();
    const configured = event("AssetConfigured", {
      issuer: ISSUER,
      token: TOKEN,
      issuerAuthority: HOLDER,
      enabled: true,
    });
    await projectReserveAsset(configured, db);
    await projectReserveAsset(configured, db);
    await assert.rejects(
      projectReserveAsset({ ...configured, params: { ...configured.params, enabled: false } }, db),
      /Conflicting/
    );
    const disabled = event("AssetConfigured", { ...configured.params, enabled: false }, 11);
    await projectReserveAsset(disabled, db);
    await projectReserveAsset(configured, db);
    const row = (await db.VoucherReserveAsset.getAll())[0];
    assert.equal(row?.enabled, false);
    assert.equal(row?.issuerAuthority, HOLDER);
    assert.equal(Object.hasOwn(row!, "supply"), false);
    assert.equal(Object.hasOwn(row!, "capacity"), false);
    assert.equal(Object.hasOwn(row!, "issuerKind"), false);
    assert.equal((await db.VoucherServiceCustody.getAll()).length, 0);
  });

  it("keeps exchange amounts exact and immutable without inventing recipient or delivery", async () => {
    const db = createTestIndexer();
    const swapped = event("SwapSettlement", {
      initiator: HOLDER,
      tokenIn: TOKEN,
      tokenOut: OTHER,
      amountIn: EXACT,
      quotedAmountOut: 100n,
      nominalAmountOut: 99n,
      amountOut: 97n,
      poolFee: 1n,
      protocolFee: 1n,
    });
    await projectPoolExchange(swapped, db);
    await projectPoolExchange(swapped, db);
    const row = (await db.VoucherPoolExchange.getAll())[0];
    assert.equal(row?.amountIn, EXACT);
    assert.equal(row?.amountOut, 97n);
    assert.equal(Object.hasOwn(row!, "recipient"), false);
    assert.equal((await db.VoucherServiceFinalAllocation.getAll()).length, 0);
    await assert.rejects(
      projectPoolExchange({ ...swapped, params: { ...swapped.params, amountOut: 98n } }, db),
      /Conflicting/
    );
    await projectPoolExchange({ ...swapped, logIndex: 3 }, db);
    await projectPoolExchange({ ...swapped, chainId: 42161 }, db);
    assert.equal((await db.VoucherPoolExchange.getAll()).length, 3);
  });

  it("rejects wrong event routing and negative amounts before persisting", async () => {
    const db = createTestIndexer();
    await assert.rejects(projectReserveAsset(event("Transfer", {}), db), /Unrouted/);
    await assert.rejects(
      projectPoolExchange(
        event("SwapSettlement", {
          initiator: HOLDER,
          tokenIn: TOKEN,
          tokenOut: OTHER,
          amountIn: -1n,
        }),
        db
      ),
      /unsigned/
    );
    assert.equal((await db.VoucherPoolExchange.getAll()).length, 0);
  });

  it("discovers the source module only through the configured core's local pin event", async () => {
    const db = createTestIndexer();
    const untrusted = createTestIndexer();
    const block = { number: 517_687_714, timestamp: 1_792_800_000 };
    await assert.rejects(
      processEvents(untrusted, [
        {
          contract: "CommitmentPoolingModule",
          event: "EarnedVoucherModulePinned",
          chainId: 42161,
          srcAddress: OTHER,
          params: { module: SOURCE },
          block: { ...block, number: block.number - 2 },
          logIndex: 0,
          transaction: { hash: hash(98) },
        },
        {
          contract: "VoucherEntitlementModule",
          event: "IssuerAuthorityConfigured",
          chainId: 42161,
          srcAddress: SOURCE,
          params: { issuer: ISSUER, token: TOKEN, authority: HOLDER },
          block: { ...block, number: block.number - 1 },
          logIndex: 0,
          transaction: { hash: hash(99) },
        },
      ]),
      /never reached a handler/
    );
    assert.equal((await untrusted.VoucherIssuerAuthority.getAll()).length, 0);
    await processEvents(db, [
      {
        contract: "CommitmentPoolingModule",
        event: "EarnedVoucherModulePinned",
        chainId: 42161,
        srcAddress: indexedAddress("CommitmentPoolingModule", 42161),
        params: { module: SOURCE },
        block,
        logIndex: 0,
        transaction: { hash: hash(100) },
      },
      {
        contract: "VoucherEntitlementModule",
        event: "IssuerAuthorityConfigured",
        chainId: 42161,
        srcAddress: SOURCE,
        params: { issuer: ISSUER, token: TOKEN, authority: HOLDER },
        block: { ...block, number: block.number + 1 },
        logIndex: 0,
        transaction: { hash: hash(101) },
      },
    ]);
    assert.equal((await db.VoucherIssuerAuthority.getAll())[0]?.authority, HOLDER);
  });
});
