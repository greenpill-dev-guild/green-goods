import type { Database } from "bun:sqlite";
import type {
  ServiceIssuerDeskRecord,
  ServiceIssuerDeskSelection,
} from "@green-goods/shared/public-contracts/service-issuer-desk";
import {
  decodeServiceIssuerDesk,
  encodeServiceIssuerDesk,
} from "@green-goods/shared/modules/commitment-pooling/service-issuer-desk-protocol";

export class ServiceIssuerDeskConflict extends Error {
  readonly code = "revision_conflict";
}
export function initServiceIssuerDeskSchema(db: Database): void {
  db.run(`CREATE TABLE IF NOT EXISTS service_issuer_drafts (
    id TEXT PRIMARY KEY, member TEXT NOT NULL, routeId TEXT NOT NULL, poolId TEXT NOT NULL,
    sent INTEGER NOT NULL, revision INTEGER NOT NULL, payload TEXT NOT NULL
  )`);
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_issuer_drafts_member ON service_issuer_drafts(member,sent)"
  );
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_issuer_drafts_pool ON service_issuer_drafts(routeId,poolId)"
  );
  db.run(
    "CREATE TABLE IF NOT EXISTS service_issuer_draft_revisions (id TEXT NOT NULL, revision INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(id,revision))"
  );
}
export function createServiceIssuerDeskStore(db: Database) {
  initServiceIssuerDeskSchema(db);
  const decode = (row: unknown) =>
    row
      ? (decodeServiceIssuerDesk((row as { payload: string }).payload) as ServiceIssuerDeskRecord)
      : undefined;
  const get = (id: string) =>
    decode(db.query("SELECT payload FROM service_issuer_drafts WHERE id=?").get(id));
  return {
    get,
    list(selection: ServiceIssuerDeskSelection | null, member: string): ServiceIssuerDeskRecord[] {
      const rows = selection
        ? db
            .query(
              "SELECT payload FROM service_issuer_drafts WHERE routeId=? AND poolId=? ORDER BY rowid DESC LIMIT 200"
            )
            .all(selection.routeId, selection.poolId)
        : db
            .query(
              "SELECT payload FROM service_issuer_drafts WHERE member=? AND sent=1 ORDER BY rowid DESC LIMIT 200"
            )
            .all(member.toLowerCase());
      return rows.map((row) => decode(row)!);
    },
    write(
      record: ServiceIssuerDeskRecord,
      expectedRevision: number | null
    ): ServiceIssuerDeskRecord {
      db.run("BEGIN IMMEDIATE");
      try {
        const previous = get(record.draft.id);
        if (
          expectedRevision === null
            ? Boolean(previous)
            : !previous || previous.revision !== expectedRevision
        )
          throw new ServiceIssuerDeskConflict();
        if (
          previous &&
          (previous.draft.member !== record.draft.member ||
            previous.createdBy !== record.createdBy ||
            encodeServiceIssuerDesk(previous.context) !== encodeServiceIssuerDesk(record.context))
        )
          throw new ServiceIssuerDeskConflict();
        const next = { ...record, revision: expectedRevision === null ? 0 : expectedRevision + 1 };
        const payload = encodeServiceIssuerDesk(next);
        if (previous)
          db.query("UPDATE service_issuer_drafts SET sent=?,revision=?,payload=? WHERE id=?").run(
            next.draft.sentAt === null ? 0 : 1,
            next.revision,
            payload,
            next.draft.id
          );
        else
          db.query(
            "INSERT INTO service_issuer_drafts(id,member,routeId,poolId,sent,revision,payload) VALUES(?,?,?,?,?,?,?)"
          ).run(
            next.draft.id,
            next.draft.member.toLowerCase(),
            next.context.routeId,
            next.context.poolId,
            next.draft.sentAt === null ? 0 : 1,
            next.revision,
            payload
          );
        db.query(
          "INSERT INTO service_issuer_draft_revisions(id,revision,payload) VALUES(?,?,?)"
        ).run(next.draft.id, next.revision, payload);
        db.run("COMMIT");
        return next;
      } catch (error) {
        db.run("ROLLBACK");
        throw error;
      }
    },
  };
}
export type ServiceIssuerDeskStore = ReturnType<typeof createServiceIssuerDeskStore>;
