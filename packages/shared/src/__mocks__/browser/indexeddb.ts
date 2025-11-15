// Mock IndexedDB for testing
export class MockIDBDatabase {
  stores = new Map();

  constructor(
    public name: string,
    public version: number
  ) {}

  createObjectStore(name: string, options?: any) {
    const store = new MockIDBObjectStore(name, options);
    this.stores.set(name, store);
    return store;
  }

  transaction(_storeNames: string | string[], _mode = "readonly") {
    return new MockIDBTransaction(this);
  }

  get objectStoreNames() {
    const names = Array.from(this.stores.keys());
    return {
      contains: (name: string) => names.includes(name),
      length: names.length,
      item: (index: number) => names[index] || null,
      toString: () => names.join(","),
      // Allow spread/iteration fallback
      [Symbol.iterator]: function* () {
        yield* names;
      },
    } as any;
  }

  close() {
    // Mock close method
  }

  // Convenience methods like IDBPDatabase
  add(storeName: string, value: any) {
    const store = this.stores.get(storeName) as MockIDBObjectStore | undefined;
    if (!store) throw new Error(`Store not found: ${storeName}`);
    return store.add(value);
  }

  get(storeName: string, key: any) {
    const store = this.stores.get(storeName) as MockIDBObjectStore | undefined;
    if (!store) throw new Error(`Store not found: ${storeName}`);
    return store.get(key);
  }

  getAll(storeName: string) {
    const store = this.stores.get(storeName) as MockIDBObjectStore | undefined;
    if (!store) throw new Error(`Store not found: ${storeName}`);
    return store.getAll();
  }

  put(storeName: string, value: any) {
    const store = this.stores.get(storeName) as MockIDBObjectStore | undefined;
    if (!store) throw new Error(`Store not found: ${storeName}`);
    return store.put(value);
  }

  delete(storeName: string, key: any) {
    const store = this.stores.get(storeName) as MockIDBObjectStore | undefined;
    if (!store) throw new Error(`Store not found: ${storeName}`);
    return store.delete(key);
  }
}

export class MockIDBObjectStore {
  data = new Map();
  indices = new Map<string, MockIDBIndex>();

  constructor(
    public name: string,
    public options: any
  ) {}

  add(value: any) {
    const key = value[this.options?.keyPath] || crypto.randomUUID();
    this.data.set(key, value);
    return Promise.resolve(key);
  }

  get(key: any) {
    return Promise.resolve(this.data.get(key));
  }

  getAll() {
    return Promise.resolve(Array.from(this.data.values()));
  }

  put(value: any) {
    const key = value[this.options?.keyPath];
    this.data.set(key, value);
    return Promise.resolve(key);
  }

  delete(key: any) {
    this.data.delete(key);
    return Promise.resolve();
  }

  createIndex(name: string, keyPath: string) {
    const idx = new MockIDBIndex(name, keyPath, this.data);
    this.indices.set(name, idx);
    return idx;
  }

  index(name: string) {
    return this.indices.get(name);
  }

  clear() {
    this.data.clear();
    return Promise.resolve();
  }
}

export class MockIDBIndex {
  constructor(
    public name: string,
    public keyPath: string,
    private data: Map<any, any>
  ) {}

  getAll(query?: any) {
    if (query === undefined) {
      return Promise.resolve(Array.from(this.data.values()));
    }

    const results = Array.from(this.data.values()).filter((item) => item[this.keyPath] === query);
    return Promise.resolve(results);
  }

  get(query: any) {
    const results = Array.from(this.data.values()).filter((item) => item[this.keyPath] === query);
    return Promise.resolve(results[0] || undefined);
  }
}

export class MockIDBTransaction {
  done: Promise<void>;

  constructor(private db: MockIDBDatabase) {
    this.done = Promise.resolve();
  }

  objectStore(name: string) {
    return this.db.stores.get(name);
  }
}

export const openDB = (name: string, version: number, config?: any) => {
  const db = new MockIDBDatabase(name, version);

  if (config?.upgrade) {
    config.upgrade(db, 0, version);
  }

  return Promise.resolve(db);
};

// Mock function for jest/vitest
(openDB as any).mockImplementation = (fn: any) => {
  Object.assign(openDB, fn);
};

// Mock IDBPDatabase type
export type IDBPDatabase = MockIDBDatabase;
