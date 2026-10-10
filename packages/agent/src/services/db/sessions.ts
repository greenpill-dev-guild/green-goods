import { Database } from "bun:sqlite";
import type { Platform, Session, SessionStep } from "../../types";
import { loggers } from "../logger";

const log = loggers.db;

export async function getSession(
  db: Database,
  platform: Platform,
  platformId: string
): Promise<Session | undefined> {
  const row = db
    .query("SELECT * FROM sessions WHERE platform = ? AND platformId = ?")
    .get(platform, platformId) as {
    platform: string;
    platformId: string;
    step: string;
    draft: string | null;
    updatedAt: number;
  } | null;

  if (!row) return undefined;

  let draft: unknown = undefined;
  if (row.draft) {
    try {
      draft = JSON.parse(row.draft);
    } catch {
      log.warn({ platform, platformId }, "Invalid session draft JSON");
    }
  }

  return {
    platform: row.platform as Platform,
    platformId: row.platformId,
    step: row.step as SessionStep,
    draft,
    updatedAt: row.updatedAt,
  };
}

export async function setSession(db: Database, session: Session): Promise<void> {
  const draftJson = session.draft ? JSON.stringify(session.draft) : null;
  db.query(
    `INSERT OR REPLACE INTO sessions (platform, platformId, step, draft, updatedAt)
         VALUES (?, ?, ?, ?, ?)`
  ).run(
    session.platform,
    session.platformId,
    session.step,
    draftJson,
    session.updatedAt || Date.now()
  );
}

export async function clearSession(
  db: Database,
  platform: Platform,
  platformId: string
): Promise<void> {
  db.query("DELETE FROM sessions WHERE platform = ? AND platformId = ?").run(platform, platformId);
}
