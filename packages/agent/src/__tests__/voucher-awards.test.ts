import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildVoucherAwardMessage,
  type VoucherAwardInput,
  type VoucherAwardRecord,
} from "@green-goods/shared/public-contracts";
import { recoverMessageAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createVoucherAwardStore } from "../services/db/voucher-awards";
import { createVoucherAwardService, type VoucherAwardChain } from "../services/voucher-awards";

const reserve = "0x1111111111111111111111111111111111111111";
const token = "0x2222222222222222222222222222222222222222";
const recipient = "0x3333333333333333333333333333333333333333";
const actor = "0x4444444444444444444444444444444444444444";
const hash = `0x${"ab".repeat(32)}` as const;
const now = 1_800_000_000;
const input: VoucherAwardInput = {
  awardId: "past-request-21-member-3",
  reserve,
  token,
  recipient,
  amount: "3000000",
  reason: "Past garden contribution",
  reference: "request:21",
};
const databases: Database[] = [];
// The package unit mock deliberately ignores filenames; this boundary test uses real disk SQLite.
function diskDatabase(file: string): Database {
  const db = new DatabaseSync(file);
  return {
    run: (sql: string) => db.exec(sql),
    close: () => db.close(),
    query: (sql: string) => {
      const statement = db.prepare(sql);
      return {
        get: (...values: Parameters<typeof statement.get>) => statement.get(...values),
        all: (...values: Parameters<typeof statement.all>) => statement.all(...values),
        run: (...values: Parameters<typeof statement.run>) => {
          const r = statement.run(...values);
          return { ...r, changes: Number(r.changes) };
        },
      };
    },
  } as unknown as Database;
}
const fixture = () => {
  const database = new Database(":memory:");
  databases.push(database);
  const store = createVoucherAwardStore(database);
  const chain = {
    canPrepare: vi.fn(async () => true),
    nonceMatches: vi.fn(async () => true),
    prepare: vi.fn<VoucherAwardChain["prepare"]>(async () => ({
      safe: reserve,
      chainId: 100 as const,
      to: token,
      value: "0" as const,
      data: "0xa9059cbb" as const,
      operation: 0 as const,
      safeTxGas: "0" as const,
      baseGas: "0" as const,
      gasPrice: "0" as const,
      gasToken: `0x${"0".repeat(40)}` as const,
      refundReceiver: `0x${"0".repeat(40)}` as const,
      nonce: "4",
      safeTxHash: hash,
      threshold: 1,
    })),
    reconcile: vi.fn<VoucherAwardChain["reconcile"]>(async () => ({
      status: "confirmed",
      transactionHash: hash,
    })),
  };
  const verify = vi.fn(async () => true);
  const service = createVoucherAwardService({ store, chain, verify, now: () => now });
  const request = (command: unknown) =>
    service.request(
      {
        version: 1,
        chainId: 100,
        actor,
        issuedAt: now,
        audience: "https://greengoods.app",
        command,
        signature: "0x1234",
      },
      "https://greengoods.app"
    );
  return { database, store, service, chain, verify, request };
};

afterEach(() => {
  for (const db of databases.splice(0)) db.close();
});

describe("retrospective voucher awards", () => {
  it("returns one frozen transfer for concurrent identical award claims", async () => {
    const f = fixture();
    const [first, repeated] = await Promise.all([
      f.request({ action: "prepare", award: input }),
      f.request({ action: "prepare", award: input }),
    ]);
    expect(first).toEqual(repeated);
    expect(first.record?.state).toBe("awaiting_authorization");
    expect(f.store.list(reserve)).toHaveLength(1);
    const reopened = createVoucherAwardStore(f.database);
    expect(reopened.get(reserve, input.awardId)?.safe.safeTxHash).toBe(hash);
  });

  it("rejects changing a claimed award or reusing its Safe nonce for another award", async () => {
    const f = fixture();
    await f.request({ action: "prepare", award: input });
    await expect(
      f.request({ action: "prepare", award: { ...input, amount: "4000000" } })
    ).rejects.toMatchObject({ code: "award_conflict" });
    await expect(
      f.request({ action: "prepare", award: { ...input, awardId: "different" } })
    ).rejects.toMatchObject({ code: "safe_nonce_claimed" });
  });

  it("rejects invalid signatures, expired proof and revoked signer eligibility before writing", async () => {
    const f = fixture();
    f.verify.mockResolvedValueOnce(false);
    await expect(f.request({ action: "prepare", award: input })).rejects.toMatchObject({
      code: "signature_invalid",
    });
    f.chain.canPrepare.mockResolvedValue(false);
    await expect(f.request({ action: "prepare", award: input })).rejects.toMatchObject({
      code: "not_authorized",
    });
    await expect(
      f.service.request(
        {
          version: 1,
          chainId: 100,
          actor,
          issuedAt: now - 301,
          audience: "https://greengoods.app",
          command: { action: "list", reserve },
          signature: "0x1234",
        },
        "https://greengoods.app"
      )
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(f.store.list(reserve)).toEqual([]);
  });

  it("confirms only through the chain verifier and never rewrites a confirmed receipt", async () => {
    const f = fixture();
    await f.request({ action: "prepare", award: input });
    const result = await f.request({
      action: "reconcile",
      reserve,
      awardId: input.awardId,
      transactionHash: hash,
    });
    expect(result.record?.state).toBe("confirmed");
    expect(f.chain.reconcile).toHaveBeenCalledOnce();
    const repeated = await f.request({
      action: "reconcile",
      reserve,
      awardId: input.awardId,
      transactionHash: hash,
    });
    expect(repeated).toEqual(result);
    expect(f.chain.reconcile).toHaveBeenCalledOnce();
  });

  it("returns only the authenticated recipient's confirmed award receipts", async () => {
    const f = fixture();
    await f.request({ action: "prepare", award: input });
    await f.request({
      action: "reconcile",
      reserve,
      awardId: input.awardId,
      transactionHash: hash,
    });
    expect((await f.request({ action: "received" })).records).toEqual([]);
    const own = await f.service.request(
      {
        version: 1,
        chainId: 100,
        actor: recipient,
        issuedAt: now,
        audience: "https://greengoods.app",
        command: { action: "received" },
        signature: "0x1234",
      },
      "https://greengoods.app"
    );
    expect(own.records?.map((record) => record.award.awardId)).toEqual([input.awardId]);
  });

  it("keeps a frozen claim across independent database connections and a process restart", async () => {
    const f = fixture();
    const r = (await f.request({ action: "prepare", award: input })).record!;
    const dir = mkdtempSync(join(tmpdir(), "voucher-ledger-"));
    let a: Database | undefined;
    let b: Database | undefined;
    try {
      a = diskDatabase(join(dir, "ledger.db"));
      b = diskDatabase(join(dir, "ledger.db"));
      const first = createVoucherAwardStore(a);
      const second = createVoucherAwardStore(b);
      expect(first.claim(r)).toEqual(r);
      expect(second.claim({ ...r, safe: { ...r.safe, nonce: "8" } })).toEqual(r);
      const changed = first.update({ ...r, state: "submitted", transactionHash: hash }, 0);
      expect(() => second.update({ ...r, state: "submitted", transactionHash: hash }, 0)).toThrow(
        "revision_conflict"
      );
      a.close();
      a = undefined;
      b.close();
      b = undefined;
      b = diskDatabase(join(dir, "ledger.db"));
      expect(createVoucherAwardStore(b).get(reserve, input.awardId)).toEqual(changed);
    } finally {
      a?.close();
      b?.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects a changed body or audience with a real signature", async () => {
    const f = fixture();
    const signer = privateKeyToAccount(generatePrivateKey());
    const proof = {
      version: 1 as const,
      chainId: 100 as const,
      actor: signer.address as VoucherAwardRecord["createdBy"],
      issuedAt: now,
      audience: "https://greengoods.app",
      command: { action: "prepare" as const, award: input },
    };
    const signature = await signer.signMessage({ message: buildVoucherAwardMessage(proof) });
    const service = createVoucherAwardService({
      store: f.store,
      chain: f.chain,
      now: () => now,
      verify: async ({ address, message, signature: signed }) =>
        (await recoverMessageAddress({ message, signature: signed })).toLowerCase() ===
        address.toLowerCase(),
    });
    await expect(
      service.request(
        {
          ...proof,
          signature,
          command: { ...proof.command, award: { ...input, recipient: actor } },
        },
        proof.audience
      )
    ).rejects.toMatchObject({ code: "signature_invalid" });
    await expect(
      service.request({ ...proof, signature }, "https://other.example")
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(f.store.list(reserve)).toEqual([]);
    expect((await service.request({ ...proof, signature }, proof.audience)).record?.award).toEqual(
      input
    );
  });

  it("blocks nonce replacement without changing the reviewed award", async () => {
    const f = fixture();
    const r = (await f.request({ action: "prepare", award: input })).record!;
    f.chain.nonceMatches.mockResolvedValue(false);
    const read = (await f.request({ action: "read", reserve, awardId: input.awardId })).record!;
    expect(read).toMatchObject({
      state: "needs_reconciliation",
      failure: "safe_nonce_changed",
      safe: r.safe,
      award: r.award,
    });
    expect((await f.request({ action: "prepare", award: input })).record).toEqual(read);
    expect(f.chain.prepare).toHaveBeenCalledOnce();
  });

  it("allows a proven replacement receipt while refusing an unrelated pending hash", async () => {
    const f = fixture();
    await f.request({ action: "prepare", award: input });
    f.chain.reconcile.mockResolvedValueOnce({ status: "submitted", transactionHash: hash });
    await f.request({
      action: "reconcile",
      reserve,
      awardId: input.awardId,
      transactionHash: hash,
    });
    const replacement = `0x${"cd".repeat(32)}` as const;
    f.chain.reconcile.mockResolvedValueOnce({ status: "submitted", transactionHash: replacement });
    await expect(
      f.request({
        action: "reconcile",
        reserve,
        awardId: input.awardId,
        transactionHash: replacement,
      })
    ).rejects.toMatchObject({ code: "submission_unresolved" });
    expect(f.store.get(reserve, input.awardId)?.transactionHash).toBe(hash);
    f.chain.reconcile.mockResolvedValueOnce({ status: "confirmed", transactionHash: replacement });
    expect(
      (
        await f.request({
          action: "reconcile",
          reserve,
          awardId: input.awardId,
          transactionHash: replacement,
        })
      ).record
    ).toMatchObject({ state: "confirmed", transactionHash: replacement });
  });

  it("filters confirmed receipts before the bounded newest-200 window", async () => {
    const f = fixture();
    const r = (await f.request({ action: "prepare", award: input })).record!;
    f.store.update({ ...r, state: "confirmed", transactionHash: hash }, 0);
    for (let i = 0; i < 201; i++)
      f.store.claim({
        ...r,
        award: { ...input, awardId: `pending-${i}` },
        safe: {
          ...r.safe,
          nonce: String(i + 10),
          safeTxHash: `0x${(i + 10).toString(16).padStart(64, "0")}`,
        },
      } as VoucherAwardRecord);
    expect(f.store.received(recipient).map((a) => a.award.awardId)).toEqual([input.awardId]);
    expect(f.store.list(reserve)).toHaveLength(200);
  });
});
