// The effect store stands in for Grove memory in this spike: an IndexedDB database with an
// `effects` counter and a `receipts` table. `applyEffectOnce` writes the effect and its receipt in
// one transaction, so a rerun of the apply phase finds the receipt and writes nothing twice. This
// is the idempotent-apply contract from durable-execution.md, reduced to a counter.

export interface EffectReceipt {
  commandId: string;
  appliedAt: string;
  effectCountAfter: number;
  replayed: boolean;
}

const DB_NAME = "grove-g0-effects";
const DB_VERSION = 1;

function openEffectsDb(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("effects")) db.createObjectStore("effects");
      if (!db.objectStoreNames.contains("receipts")) db.createObjectStore("receipts", { keyPath: "commandId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("could not open the effects database"));
  });
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export class EffectStore {
  private constructor(private readonly db: IDBDatabase) {}

  static async open(factory: IDBFactory = indexedDB): Promise<EffectStore> {
    return new EffectStore(await openEffectsDb(factory));
  }

  /** Apply the command's effect unless a receipt for `commandId` already exists. One transaction. */
  async applyEffectOnce(commandId: string): Promise<EffectReceipt> {
    const transaction = this.db.transaction(["effects", "receipts"], "readwrite");
    const receipts = transaction.objectStore("receipts");
    const effects = transaction.objectStore("effects");
    const existing = (await requestValue(receipts.get(commandId))) as EffectReceipt | undefined;
    if (existing) {
      await transactionDone(transaction);
      return { ...existing, replayed: true };
    }
    const count = ((await requestValue(effects.get("count"))) as number | undefined) ?? 0;
    const receipt: EffectReceipt = {
      commandId,
      appliedAt: new Date().toISOString(),
      effectCountAfter: count + 1,
      replayed: false,
    };
    effects.put(count + 1, "count");
    receipts.put(receipt);
    await transactionDone(transaction);
    return receipt;
  }

  async effectCount(): Promise<number> {
    const transaction = this.db.transaction("effects", "readonly");
    const count = ((await requestValue(transaction.objectStore("effects").get("count"))) as number | undefined) ?? 0;
    await transactionDone(transaction);
    return count;
  }

  async reset(): Promise<void> {
    const transaction = this.db.transaction(["effects", "receipts"], "readwrite");
    transaction.objectStore("effects").clear();
    transaction.objectStore("receipts").clear();
    await transactionDone(transaction);
  }

  close(): void {
    this.db.close();
  }
}
