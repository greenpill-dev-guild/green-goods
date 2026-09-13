import { openDB, type IDBPDatabase } from "idb";
import type { Address } from "../../types/domain";
import type { ProfileAvatarDraft } from "../profile-avatar/types";
import { hashWorkBytes } from "../work/work-attachments";
import type { AvatarDraftRecord, DraftDB } from "./draft-state";
import { trackPrivateQueueEvent } from "./job-analytics";

const LEGACY_NAME = "green-goods-profile-avatar-drafts";
type LegacyAvatar = ProfileAvatarDraft & { key: string };
const avatarDraftId = (chainId: number, address: string) =>
  `avatar:${chainId}:${address.toLowerCase()}`;

function validLegacy(value: unknown): value is LegacyAvatar {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<LegacyAvatar>;
  return (
    typeof row.key === "string" &&
    typeof row.address === "string" &&
    /^0x[0-9a-f]{40}$/i.test(row.address) &&
    Number.isSafeInteger(row.chainId) &&
    row.key === `${row.chainId}:${row.address.toLowerCase()}` &&
    Number.isFinite(row.updatedAt) &&
    (row.action === "set" || row.action === "clear") &&
    (row.fileData === null ||
      (!!row.fileData &&
        row.fileData.data instanceof ArrayBuffer &&
        row.fileData.data.byteLength > 0 &&
        typeof row.fileData.name === "string" &&
        typeof row.fileData.type === "string" &&
        Number.isFinite(row.fileData.lastModified)))
  );
}

async function fingerprint(row: LegacyAvatar): Promise<string> {
  return JSON.stringify([
    row.chainId,
    row.address.toLowerCase(),
    row.updatedAt,
    row.action,
    row.cid ?? null,
    row.fileData
      ? [
          row.fileData.name,
          row.fileData.type,
          row.fileData.lastModified,
          await hashWorkBytes(row.fileData.data),
        ]
      : null,
  ]);
}

function unchanged(a: LegacyAvatar, b: unknown): boolean {
  if (!validLegacy(b)) return false;
  const plain = (row: LegacyAvatar) =>
    JSON.stringify({ ...row, fileData: row.fileData ? { ...row.fileData, data: null } : null });
  if (plain(a) !== plain(b)) return false;
  const left = new Uint8Array(a.fileData?.data ?? new ArrayBuffer(0));
  const right = new Uint8Array(b.fileData?.data ?? new ArrayBuffer(0));
  return left.length === right.length && left.every((byte, index) => byte === right[index]);
}

function openLegacy(): Promise<IDBPDatabase> {
  return new Promise((resolve, reject) => {
    let abandoned = false;
    let connection: IDBPDatabase | undefined;
    const fail = (error: unknown) => {
      abandoned = true;
      reject(error);
    };
    const timer = setTimeout(() => fail(new Error("avatar-legacy-open-timeout")), 3000);
    openDB(LEGACY_NAME, 1, {
      // Some engines cannot enumerate databases. Keep an empty store compatible with rollback.
      upgrade(database) {
        database.createObjectStore("drafts", { keyPath: "key" });
      },
      blocked() {
        fail(new Error("avatar-legacy-upgrade-blocked"));
      },
      blocking() {
        connection?.close();
      },
    })
      .then((db) => {
        connection = db;
        if (abandoned) db.close();
        else resolve(db);
      }, fail)
      .finally(() => clearTimeout(timer));
  });
}

/** Copy one row transactionally with its receipt. Legacy deletion is independently retryable. */
export async function migrateAvatarDrafts(db: IDBPDatabase<DraftDB>): Promise<boolean> {
  let legacy: IDBPDatabase | undefined;
  let failures = 0;
  let readable = false;
  try {
    legacy = await openLegacy();
    if (!legacy.objectStoreNames.contains("drafts")) return true;
    const rows = await legacy.getAll("drafts");
    readable = true;
    for (const row of rows) {
      if (!validLegacy(row)) {
        failures++;
        continue;
      }
      try {
        const source = `profile-avatar:${row.key}`;
        const digest = await fingerprint(row);
        const id = avatarDraftId(row.chainId, row.address);
        const tx = db.transaction(["drafts", "draft_migrations"], "readwrite");
        try {
          const drafts = tx.objectStore("drafts");
          const existing = await drafts.get(id);
          // A conflicting work ID is never overwritten. Preserve the source for recovery.
          if (existing && existing.kind !== "profile-avatar")
            throw new Error("draft-kind-conflict");
          if (!existing || existing.updatedAt < row.updatedAt) {
            const { key: _key, ...value } = row;
            await drafts.put({
              ...value,
              kind: "profile-avatar",
              id,
              address: row.address.toLowerCase() as Address,
              userAddress: row.address.toLowerCase() as Address,
            });
          }
          await tx
            .objectStore("draft_migrations")
            .put({ source, fingerprint: digest, copiedAt: Date.now() });
          await tx.done;
        } catch (error) {
          try {
            tx.abort();
          } catch {
            /* Already aborted. */
          }
          await tx.done.catch(() => undefined);
          throw error;
        }
        // Verify durable destination + receipt before touching the original database.
        const saved = await db.get("drafts", id);
        const receipt = await db.get("draft_migrations", source);
        if (
          saved?.kind !== "profile-avatar" ||
          saved.updatedAt < row.updatedAt ||
          receipt?.fingerprint !== digest
        )
          throw new Error("draft-copy-unverified");
        if (
          saved.updatedAt === row.updatedAt &&
          !saved.deleted &&
          (await fingerprint({ ...saved, key: row.key })) !== digest
        )
          throw new Error("draft-copy-conflict");
        const remove = legacy.transaction("drafts", "readwrite");
        if (unchanged(row, await remove.store.get(row.key))) await remove.store.delete(row.key);
        await remove.done;
      } catch {
        failures++;
      }
    }
  } catch {
    failures++;
  } finally {
    legacy?.close();
  }
  if (failures) trackPrivateQueueEvent("job_queue_draft_migration_incomplete", { count: failures });
  return readable;
}

export async function readAvatarDraft(
  db: IDBPDatabase<DraftDB>,
  chainId: number,
  address: Address
): Promise<ProfileAvatarDraft | null> {
  const legacyReadable = await migrateAvatarDrafts(db);
  const record = await db.get("drafts", avatarDraftId(chainId, address));
  const current = record?.kind === "profile-avatar" ? record : undefined;
  if (!legacyReadable) {
    if (current) return current.deleted ? null : current;
    throw new Error("avatar-legacy-unavailable");
  }
  // A quota-failed migration must not hide the original recoverable bytes.
  let legacy: IDBPDatabase | undefined;
  try {
    legacy = await openLegacy();
    if (!legacy.objectStoreNames.contains("drafts"))
      return current && !current.deleted ? current : null;
    const row = await legacy.get("drafts", `${chainId}:${address.toLowerCase()}`);
    if (validLegacy(row) && (!current || row.updatedAt > current.updatedAt)) return row;
    return current && !current.deleted ? current : null;
  } catch (error) {
    // A legacy version/open failure cannot hide an already durable canonical draft.
    if (current) return current.deleted ? null : current;
    throw error;
  } finally {
    legacy?.close();
  }
}

export async function writeAvatarDraft(
  db: IDBPDatabase<DraftDB>,
  draft: ProfileAvatarDraft,
  deleted = false
): Promise<void> {
  const row: AvatarDraftRecord = {
    ...draft,
    kind: "profile-avatar",
    id: avatarDraftId(draft.chainId, draft.address),
    address: draft.address.toLowerCase() as Address,
    userAddress: draft.address.toLowerCase() as Address,
    ...(deleted ? { deleted: true } : {}),
  };
  const tx = db.transaction("drafts", "readwrite");
  try {
    const existing = await tx.store.get(row.id);
    if (existing && existing.kind !== "profile-avatar") throw new Error("draft-kind-conflict");
    // Monotonic revisions also protect against a device clock moving backwards.
    row.updatedAt = Math.max(row.updatedAt, (existing?.updatedAt ?? 0) + 1);
    await tx.store.put(row);
    await tx.done;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      /* Already aborted. */
    }
    await tx.done.catch(() => undefined);
    throw error;
  }
}
