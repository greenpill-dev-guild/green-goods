import {
  displayablePasskeyName,
  KERNEL_033_PASSKEY_PROFILE,
} from "@green-goods/shared/public-contracts";
import type { Address } from "viem";
import type { PasskeyAddressRecord } from "./db/passkey-directory";
import { loggers } from "./logger";

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
          if (!name) return null;
          // The 0.3.3 recipe requires a canonical browser ID. Preserve the exact legacy ID.
          const invalidBrowserId =
            record.accountProfile === KERNEL_033_PASSKEY_PROFILE &&
            (!record.credentialKey ||
              Buffer.from(record.credentialKey, "base64url").toString("base64url") !==
                record.credentialKey);
          if (!record.credentialId || invalidBrowserId) {
            loggers.api.warn(
              { rowId: record.rowId },
              "Skipping invalid passkey display-name record"
            );
            return null;
          }
          const address = await deriveAddress(record);
          return address ? { name, address } : null;
        })
      );
      // Wait for all RPCs to finish before retrying a failed batch.
      const failure = outcomes.find((outcome) => outcome.status === "rejected");
      if (failure) throw failure.reason;
      for (const outcome of outcomes) {
        if (outcome.status === "rejected" || !outcome.value) continue;
        const { address, name } = outcome.value;
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
