import { displayablePasskeyName } from "@green-goods/shared/public-contracts";
import type { Address } from "viem";
import type { PasskeyAddressRecord } from "./db/passkey-directory";

const DERIVATION_BATCH_SIZE = 32;

/** Directory rows are append-only. Share one incremental address index per chain. */
export function createPasskeyDisplayNames(
  readRecords: (after: number, limit: number) => PasskeyAddressRecord[],
  deriveAddress: (record: PasskeyAddressRecord) => Promise<Address | null>
) {
  const names = new Map<string, string | null>();
  let cursor = 0;
  let refresh: Promise<void> | undefined;

  async function refreshIndex(): Promise<void> {
    for (;;) {
      const records = readRecords(cursor, DERIVATION_BATCH_SIZE);
      if (records.length === 0) return;

      const outcomes = await Promise.allSettled(
        records.map(async (record) => {
          const name = displayablePasskeyName(record.userName);
          return { name, address: name ? await deriveAddress(record) : null };
        })
      );
      // Wait for all RPCs to finish before retrying a failed batch.
      const failure = outcomes.find((outcome) => outcome.status === "rejected");
      if (failure) throw failure.reason;
      for (const outcome of outcomes) {
        if (outcome.status === "rejected") continue;
        const { address, name } = outcome.value;
        if (!address) continue;
        const key = address.toLowerCase();
        names.set(key, names.has(key) ? null : name);
      }
      // A failed RPC batch leaves the cursor untouched so the next request can retry it.
      cursor = records[records.length - 1]!.rowId;
    }
  }

  return async (addresses: readonly Address[]): Promise<(string | null)[]> => {
    refresh ??= refreshIndex().finally(() => {
      refresh = undefined;
    });
    await refresh;
    return addresses.map((address) => names.get(address.toLowerCase()) ?? null);
  };
}
