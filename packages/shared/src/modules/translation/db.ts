import { type IDBPDatabase, openDB } from "idb";
import { logger } from "../app/logger";

const DB_NAME = "green-goods-translations";
const DB_VERSION = 1;
const CACHE_TTL_DAYS = 90; // Long cache for stability

interface CachedTranslation {
  id: string; // `${hash(text)}_${sourceLang}_${targetLang}`
  text: string;
  translated: string;
  sourceLang: string;
  targetLang: string;
  createdAt: number;
  expiresAt: number;
}

interface TranslationDB {
  translations: CachedTranslation;
}

class TranslationCache {
  private db: IDBPDatabase<TranslationDB> | null = null;

  async init(): Promise<IDBPDatabase<TranslationDB>> {
    if (this.db) return this.db;

    this.db = await openDB<TranslationDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore("translations", { keyPath: "id" });
        store.createIndex("targetLang", "targetLang");
        store.createIndex("expiresAt", "expiresAt");
      },
    });

    this.cleanup();
    return this.db;
  }

  private hash(text: string): string {
    // Simple hash for cache key
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private key(text: string, source: string, target: string): string {
    return `${this.hash(text)}_${source}_${target}`;
  }

  async get(text: string, source: string, target: string): Promise<string | null> {
    const db = await this.init();
    const cached = await db.get("translations", this.key(text, source, target));

    if (!cached || cached.expiresAt < Date.now()) {
      if (cached) await db.delete("translations", cached.id);
      return null;
    }

    logger.debug("[Translation] Cache hit", { text: text.substring(0, 30), target });
    return cached.translated;
  }

  async set(text: string, translated: string, source: string, target: string): Promise<void> {
    const db = await this.init();
    const now = Date.now();

    await db.put("translations", {
      id: this.key(text, source, target),
      text,
      translated,
      sourceLang: source,
      targetLang: target,
      createdAt: now,
      expiresAt: now + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000,
    });

    logger.debug("[Translation] Cached", { text: text.substring(0, 30), target });
  }

  private async cleanup(): Promise<void> {
    try {
      const db = await this.init();
      const tx = db.transaction("translations", "readwrite");
      const index = tx.objectStore("translations").index("expiresAt");
      const expired = await index.getAll(IDBKeyRange.upperBound(Date.now()));

      for (const item of expired) {
        await tx.objectStore("translations").delete(item.id);
      }
      await tx.done;
    } catch {
      // Silently handle cleanup errors
    }
  }

  async getStats(): Promise<{ total: number; byLanguage: Record<string, number> }> {
    const db = await this.init();
    const all = await db.getAll("translations");

    const byLanguage: Record<string, number> = {};
    for (const item of all) {
      byLanguage[item.targetLang] = (byLanguage[item.targetLang] || 0) + 1;
    }

    return { total: all.length, byLanguage };
  }
}

export const translationCache = new TranslationCache();
