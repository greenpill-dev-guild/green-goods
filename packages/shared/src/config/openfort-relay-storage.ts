import { createStore, del, entries, get, keys, set } from "idb-keyval";

export function createRelayStorage(prefix: string) {
  // The providers write some unprefixed keys directly, even with customStoragePrefix.
  const namespace = `${prefix}:`;
  const store = createStore("gg-openfort-walletconnect", "sdk");
  const persisted = Promise.resolve()
    .then(() => get(namespace, store))
    .then(
      () => true,
      () => false
    );
  const memory = new Map<string, unknown>();
  return {
    async getKeys() {
      if (!(await persisted)) return [...memory.keys()];
      return (await keys<string>(store))
        .filter((key) => key.startsWith(namespace))
        .map((key) => key.slice(namespace.length));
    },
    async getEntries<T>() {
      if (!(await persisted)) return [...memory.entries()] as [string, T][];
      return (await entries<string, T>(store))
        .filter(([key]) => key.startsWith(namespace))
        .map(([key, value]): [string, T] => [key.slice(namespace.length), value]);
    },
    async getItem<T>(key: string): Promise<T | undefined> {
      if (await persisted) return get<T>(namespace + key, store);
      return memory.get(key) as T | undefined;
    },
    async setItem<T>(key: string, value: T) {
      if (await persisted) await set(namespace + key, value, store);
      else memory.set(key, value);
    },
    async removeItem(key: string) {
      if (await persisted) await del(namespace + key, store);
      else memory.delete(key);
    },
  };
}
