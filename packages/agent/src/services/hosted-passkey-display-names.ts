import {
  displayablePasskeyName,
  LEGACY_PASSKEY_PROFILE,
} from "@green-goods/shared/public-contracts";
import type { Address } from "viem";
import {
  storedPasskeyPublicKey,
  type passkeyDirectoryQueries,
  type PasskeyAddressRecord,
} from "./db/passkey-directory";

export type LookupHostedPasskeys = (userName: string) => Promise<unknown[]>;
type AddressIdentity = Pick<PasskeyAddressRecord, "accountProfile" | "credentialId" | "publicKey">;
const MAX_CONCURRENT_NAMES = 8;
const MAX_CREDENTIALS = 32;

/** Learn display labels from the provider's name lookup without writing sign-in records. */
export function createHostedPasskeyDisplayNames({
  chainId,
  store,
  derive,
  lookup,
}: {
  chainId: number;
  store: Pick<
    ReturnType<typeof passkeyDirectoryQueries>,
    "hasHostedDisplayName" | "rememberHostedDisplayName" | "readHostedDisplayNames"
  >;
  derive(credential: AddressIdentity): Promise<Address | null>;
  lookup: LookupHostedPasskeys;
}) {
  const pending = new Map<string, Promise<void>>();

  async function remember(userName: string) {
    if (store.hasHostedDisplayName(chainId, userName)) return;
    const listed = await lookup(userName);
    if (listed.length > MAX_CREDENTIALS) throw new Error("Unexpected hosted passkey count");
    const identities = listed.map(readHostedIdentity);
    const addresses = (await Promise.all(identities.map((identity) => derive(identity)))).filter(
      (address) => address !== null
    );
    if (addresses.length) store.rememberHostedDisplayName(chainId, userName, addresses);
  }

  return {
    async observe(userName: string) {
      if (!displayablePasskeyName(userName)) return;
      const existing = pending.get(userName);
      if (existing) return existing;
      if (pending.size >= MAX_CONCURRENT_NAMES) return;
      const task = remember(userName).finally(() => pending.delete(userName));
      pending.set(userName, task);
      await task;
    },
    read(addresses: readonly Address[]): (string | null)[] {
      const names = new Map(
        store.readHostedDisplayNames(chainId, addresses).map((row) => [row.address, row.userName])
      );
      return addresses.map((address) => names.get(address.toLowerCase() as Address) ?? null);
    },
  };
}

function readHostedIdentity(value: unknown): AddressIdentity {
  const { id, publicKey } = (value ?? {}) as { id?: unknown; publicKey?: unknown };
  if (typeof id !== "string" || !id || id.length > 2048 || typeof publicKey !== "string") {
    throw new Error("Invalid hosted passkey record");
  }
  return {
    accountProfile: LEGACY_PASSKEY_PROFILE,
    credentialId: id,
    publicKey: storedPasskeyPublicKey(publicKey),
  };
}
