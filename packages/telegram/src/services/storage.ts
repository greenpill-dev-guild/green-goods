import { Database } from "bun:sqlite";
import path from "path";
import fs from "fs";

export interface User {
  telegramId: number;
  privateKey: string; // Encrypted or raw for MVP (custodial)
  address: string;
  currentGarden?: string; // Address of current garden context
  role?: "gardener" | "operator";
}

export interface Session {
  telegramId: number;
  step: "idle" | "joining_garden" | "submitting_work" | "approving_work";
  draft?: any; // JSON string of WorkDraft
}

export class StorageService {
  private db: Database;

  constructor(dbPath: string = "bot.db") {
    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.init();
  }

  private init() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        telegramId INTEGER PRIMARY KEY,
        privateKey TEXT NOT NULL,
        address TEXT NOT NULL,
        currentGarden TEXT,
        role TEXT
      );

      CREATE TABLE IF NOT EXISTS sessions (
        telegramId INTEGER PRIMARY KEY,
        step TEXT NOT NULL,
        draft TEXT
      );

      CREATE TABLE IF NOT EXISTS pending_works (
        id TEXT PRIMARY KEY,
        actionUID INTEGER,
        gardenerAddress TEXT,
        gardenerTelegramId INTEGER,
        data TEXT
      );
    `);
  }

  getUser(telegramId: number): User | undefined {
    return this.db.query("SELECT * FROM users WHERE telegramId = ?").get(telegramId) as User | undefined;
  }

  createUser(user: User) {
    this.db.query(`
      INSERT INTO users (telegramId, privateKey, address, currentGarden, role)
      VALUES ($telegramId, $privateKey, $address, $currentGarden, $role)
    `).run({
      $telegramId: user.telegramId,
      $privateKey: user.privateKey,
      $address: user.address,
      $currentGarden: user.currentGarden,
      $role: user.role
    });
  }

  updateUser(user: Partial<User> & { telegramId: number }) {
    const fields = Object.keys(user).filter(k => k !== "telegramId").map(k => `${k} = $${k}`).join(", ");
    if (!fields) return;
    
    const params: any = { $telegramId: user.telegramId };
    for (const [key, value] of Object.entries(user)) {
      if (key !== "telegramId") params[`$${key}`] = value;
    }

    this.db.query(`UPDATE users SET ${fields} WHERE telegramId = $telegramId`).run(params);
  }

  getSession(telegramId: number): Session | undefined {
    const session = this.db.query("SELECT * FROM sessions WHERE telegramId = ?").get(telegramId) as Session | undefined;
    if (session && session.draft) {
      try {
        session.draft = JSON.parse(session.draft);
      } catch (e) {
        session.draft = undefined;
      }
    }
    return session;
  }

  setSession(session: Session) {
    const data = {
      $telegramId: session.telegramId,
      $step: session.step,
      $draft: session.draft ? JSON.stringify(session.draft) : null
    };
    this.db.query(`
      INSERT OR REPLACE INTO sessions (telegramId, step, draft)
      VALUES ($telegramId, $step, $draft)
    `).run(data);
  }

  clearSession(telegramId: number) {
    this.db.query("DELETE FROM sessions WHERE telegramId = ?").run(telegramId);
  }

  addPendingWork(work: any) {
    this.db.query(`
      INSERT INTO pending_works (id, actionUID, gardenerAddress, gardenerTelegramId, data)
      VALUES ($id, $actionUID, $gardenerAddress, $gardenerTelegramId, $data)
    `).run({
      $id: work.id,
      $actionUID: work.actionUID,
      $gardenerAddress: work.gardenerAddress,
      $gardenerTelegramId: work.gardenerTelegramId,
      $data: JSON.stringify(work.data)
    });
  }

  getPendingWork(id: string): any | undefined {
    const work = this.db.query("SELECT * FROM pending_works WHERE id = ?").get(id) as any;
    if (work) {
      work.data = JSON.parse(work.data);
    }
    return work;
  }

  removePendingWork(id: string) {
    this.db.query("DELETE FROM pending_works WHERE id = ?").run(id);
  }

  getOperatorForGarden(gardenAddress: string): User | undefined {
    return this.db.query("SELECT * FROM users WHERE role = 'operator' AND currentGarden = ?").get(gardenAddress) as User | undefined;
  }
}

export const storage = new StorageService(process.env.DB_PATH || "data/bot.db");
