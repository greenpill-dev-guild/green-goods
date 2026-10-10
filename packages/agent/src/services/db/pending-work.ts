import { Database } from "bun:sqlite";
import type { PendingWork, Platform, WorkDraftData } from "../../types";

interface PendingWorkRow {
  id: string;
  actionUID: number;
  gardenerAddress: string;
  gardenerPlatform: string;
  gardenerPlatformId: string;
  gardenAddress: string;
  data: string;
  createdAt: number;
}

export async function addPendingWork(
  db: Database,
  work: Omit<PendingWork, "createdAt">
): Promise<void> {
  db.query(
    `INSERT INTO pending_works (id, actionUID, gardenerAddress, gardenerPlatform, gardenerPlatformId, gardenAddress, data)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    work.id,
    work.actionUID,
    work.gardenerAddress,
    work.gardenerPlatform,
    work.gardenerPlatformId,
    work.gardenAddress,
    JSON.stringify(work.data)
  );
}

export async function getPendingWork(db: Database, id: string): Promise<PendingWork | undefined> {
  const row = db.query("SELECT * FROM pending_works WHERE id = ?").get(id) as PendingWorkRow | null;
  return row ? deserializePendingWork(row) : undefined;
}

export async function getPendingWorksForGarden(
  db: Database,
  gardenAddress: string
): Promise<PendingWork[]> {
  const rows = db
    .query("SELECT * FROM pending_works WHERE gardenAddress = ? ORDER BY createdAt DESC")
    .all(gardenAddress) as PendingWorkRow[];

  return rows.map(deserializePendingWork);
}

export async function removePendingWork(db: Database, id: string): Promise<void> {
  db.query("DELETE FROM pending_works WHERE id = ?").run(id);
}

function deserializePendingWork(row: PendingWorkRow): PendingWork {
  return {
    id: row.id,
    actionUID: row.actionUID,
    gardenerAddress: row.gardenerAddress,
    gardenerPlatform: row.gardenerPlatform as Platform,
    gardenerPlatformId: row.gardenerPlatformId,
    gardenAddress: row.gardenAddress,
    data: JSON.parse(row.data) as WorkDraftData,
    createdAt: row.createdAt,
  };
}
