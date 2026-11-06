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
// Username observations come from a public endpoint. Bound the in-memory backlog.
const MAX_QUEUED_NAMES = 256;
const MAX_CREDENTIALS = 32;
const EMPTY_RESULT_TTL_MS = 60_000;
const MAX_EMPTY_RESULTS = 1024;

export class HostedPasskeyQueueFullError extends Error {}

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
  const waiting: (() => void)[] = [];
  const emptyResults = new Map<string, number>();
  let running = 0;

  async function remember(userName: string) {
    const listed = await lookup(userName);
    if (listed.length === 0) {
      if (emptyResults.size >= MAX_EMPTY_RESULTS) {
        const oldest = emptyResults.keys().next();
        if (!oldest.done) emptyResults.delete(oldest.value);
      }
      emptyResults.set(userName, Date.now() + EMPTY_RESULT_TTL_MS);
      return;
    }
    if (listed.length > MAX_CREDENTIALS) throw new Error("Unexpected hosted passkey count");
    const identities = listed.map(readHostedIdentity);
    const addresses = (await Promise.all(identities.map((identity) => derive(identity)))).filter(
      (address) => address !== null
    );
    if (addresses.length) store.rememberHostedDisplayName(chainId, userName, addresses);
  }

  async function rememberWhenReady(userName: string) {
    if (running < MAX_CONCURRENT_NAMES) {
      running += 1;
    } else {
      await new Promise<void>((resume) => waiting.push(resume));
    }
    try {
      await remember(userName);
    } finally {
      // Hand this slot to the oldest waiter before another observation can claim it.
      const next = waiting.shift();
      if (next) next();
      else running -= 1;
    }
  }

  return {
    async observe(userName: string) {
      if (!displayablePasskeyName(userName)) return;
      const existing = pending.get(userName);
      if (existing) return existing;
      const emptyUntil = emptyResults.get(userName);
      if (emptyUntil !== undefined) {
        if (Date.now() < emptyUntil) return;
        emptyResults.delete(userName);
      }
      if (store.hasHostedDisplayName(chainId, userName)) return;
      if (waiting.length >= MAX_QUEUED_NAMES) {
        throw new HostedPasskeyQueueFullError("Hosted passkey observation queue is full");
      }
      const task = rememberWhenReady(userName).finally(() => pending.delete(userName));
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
