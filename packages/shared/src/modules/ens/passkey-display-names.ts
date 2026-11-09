import type { Address } from "viem";
import { readPasskeyDisplayNames } from "../../config/passkeyServer";
import { PASSKEY_DISPLAY_NAMES_BATCH_LIMIT } from "../../public-contracts/passkey-directory";

type Read = {
  address: Address;
  resolve: (name: string | null) => void;
  reject: (error: unknown) => void;
};

const pending = new Map<number, Read[]>();

/** Coalesce the address queries made by rows that render together. */
export function readPasskeyDisplayName(chainId: number, address: Address): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const reads = pending.get(chainId);
    if (reads) {
      reads.push({ address, resolve, reject });
      return;
    }

    pending.set(chainId, [{ address, resolve, reject }]);
    setTimeout(() => {
      const reads = pending.get(chainId)!;
      pending.delete(chainId);
      for (let offset = 0; offset < reads.length; offset += PASSKEY_DISPLAY_NAMES_BATCH_LIMIT) {
        const batch = reads.slice(offset, offset + PASSKEY_DISPLAY_NAMES_BATCH_LIMIT);
        void readPasskeyDisplayNames(
          chainId,
          batch.map((read) => read.address)
        ).then(
          (names) => batch.forEach((read, index) => read.resolve(names[index] ?? null)),
          (error) => batch.forEach((read) => read.reject(error))
        );
      }
    }, 0);
  });
}
