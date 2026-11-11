import type { Database } from "bun:sqlite";
import type { VoucherAwardRecord } from "@green-goods/shared/public-contracts";

export class VoucherAwardStoreConflict extends Error {
  constructor(readonly code: "award_conflict" | "safe_nonce_claimed" | "revision_conflict") {
    super(code);
  }
}
export function initVoucherAwardSchema(db: Database): void {
  db.run(`CREATE TABLE IF NOT EXISTS voucher_awards (
    chainId INTEGER NOT NULL, reserve TEXT NOT NULL, awardId TEXT NOT NULL,
    nonce TEXT NOT NULL, safeTxHash TEXT NOT NULL, recipient TEXT NOT NULL,
    payload TEXT NOT NULL, revision INTEGER NOT NULL, state TEXT NOT NULL,
    PRIMARY KEY(chainId, reserve, awardId), UNIQUE(chainId, reserve, nonce),
    UNIQUE(chainId, reserve, safeTxHash)
  )`);
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_voucher_awards_recipient ON voucher_awards(chainId, recipient, state)"
  );
}
export function createVoucherAwardStore(db: Database) {
  initVoucherAwardSchema(db);
  const decode = (row: unknown): VoucherAwardRecord | undefined =>
    row ? JSON.parse((row as { payload: string }).payload) : undefined;
  const get = (reserve: string, awardId: string) =>
    decode(
      db
        .query(
          "SELECT payload FROM voucher_awards WHERE chainId = 100 AND reserve = ? AND awardId = ?"
        )
        .get(reserve.toLowerCase(), awardId)
    );
  return {
    get,
    list(reserve: string): VoucherAwardRecord[] {
      return db
        .query(
          "SELECT payload FROM voucher_awards WHERE chainId = 100 AND reserve = ? ORDER BY rowid DESC LIMIT 200"
        )
        .all(reserve.toLowerCase())
        .map((row) => decode(row)!);
    },
    received(recipient: string): VoucherAwardRecord[] {
      return db
        .query(
          "SELECT payload FROM voucher_awards WHERE chainId = 100 AND recipient = ? AND state = 'confirmed' ORDER BY rowid DESC LIMIT 200"
        )
        .all(recipient.toLowerCase())
        .map((row) => decode(row)!);
    },
    claim(record: VoucherAwardRecord): VoucherAwardRecord {
      db.run("BEGIN IMMEDIATE");
      try {
        const existing = get(record.award.reserve, record.award.awardId);
        if (existing) {
          if (JSON.stringify(existing.award) !== JSON.stringify(record.award))
            throw new VoucherAwardStoreConflict("award_conflict");
          db.run("COMMIT");
          return existing;
        }
        const occupied = db
          .query(
            "SELECT awardId FROM voucher_awards WHERE chainId = 100 AND reserve = ? AND (nonce = ? OR safeTxHash = ?)"
          )
          .get(record.award.reserve.toLowerCase(), record.safe.nonce, record.safe.safeTxHash);
        if (occupied) throw new VoucherAwardStoreConflict("safe_nonce_claimed");
        db.query(
          "INSERT INTO voucher_awards (chainId,reserve,awardId,nonce,safeTxHash,recipient,payload,revision,state) VALUES (100,?,?,?,?,?,?,?,?)"
        ).run(
          record.award.reserve.toLowerCase(),
          record.award.awardId,
          record.safe.nonce,
          record.safe.safeTxHash,
          record.award.recipient.toLowerCase(),
          JSON.stringify(record),
          record.revision,
          record.state
        );
        db.run("COMMIT");
        return record;
      } catch (error) {
        db.run("ROLLBACK");
        throw error;
      }
    },
    update(record: VoucherAwardRecord, revision: number): VoucherAwardRecord {
      const existing = get(record.award.reserve, record.award.awardId);
      if (!existing || existing.revision !== revision)
        throw new VoucherAwardStoreConflict("revision_conflict");
      if (
        JSON.stringify(existing.award) !== JSON.stringify(record.award) ||
        JSON.stringify(existing.safe) !== JSON.stringify(record.safe) ||
        existing.createdAt !== record.createdAt ||
        existing.createdBy !== record.createdBy ||
        existing.state === "confirmed"
      )
        throw new VoucherAwardStoreConflict("award_conflict");
      const next = { ...record, revision: revision + 1 };
      const result = db
        .query(
          "UPDATE voucher_awards SET payload = ?, revision = ?, state = ? WHERE chainId = 100 AND reserve = ? AND awardId = ? AND revision = ?"
        )
        .run(
          JSON.stringify(next),
          next.revision,
          next.state,
          record.award.reserve.toLowerCase(),
          record.award.awardId,
          revision
        );
      if (result.changes !== 1) throw new VoucherAwardStoreConflict("revision_conflict");
      return next;
    },
  };
}
export type VoucherAwardStore = ReturnType<typeof createVoucherAwardStore>;
