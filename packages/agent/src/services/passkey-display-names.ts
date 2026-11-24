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
  const failedRecords = new Map<number, PasskeyAddressRecord>();
  let cursor = 0;
  let refresh: Promise<void> | undefined;

  async function indexRecords(records: PasskeyAddressRecord[]): Promise<number> {
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
          loggers.api.warn({ rowId: record.rowId }, "Skipping invalid passkey display-name record");
          return null;
        }
        const address = await deriveAddress(record);
        return address ? { name, address } : null;
      })
    );

    let failures = 0;
    for (const [index, outcome] of outcomes.entries()) {
      if (outcome.status === "rejected") {
        const record = records[index]!;
        failedRecords.set(record.rowId, record);
        failures += 1;
      } else if (outcome.value) {
        const { address, name } = outcome.value;
        const key = address.toLowerCase();
        names.set(key, names.has(key) ? null : name);
      }
    }
    return failures;
  }

  async function refreshIndex(): Promise<void> {
    // Retry one page per refresh. A persistent failure goes to the back of the queue.
    const retry: PasskeyAddressRecord[] = [];
    for (const [rowId, record] of failedRecords) {
      retry.push(record);
      failedRecords.delete(rowId);
      if (retry.length === DERIVATION_BATCH_SIZE) break;
    }
    if (retry.length > 0) await indexRecords(retry);

    for (;;) {
      const records = readRecords(cursor, DERIVATION_BATCH_SIZE);
      if (records.length === 0) return;

      const failures = await indexRecords(records);
      cursor = records[records.length - 1]!.rowId;
      if (failures > 0) {
        // Derivation errors may contain RPC URLs or credential identifiers.
        loggers.api.warn({ failures }, "Passkey display-name derivation deferred");
      }
      // Give the RPC a chance to recover before scanning more rows during a full-page outage.
      if (failures === records.length) return;
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
