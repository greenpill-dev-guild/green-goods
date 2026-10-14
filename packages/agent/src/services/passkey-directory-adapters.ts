/**
 * What the passkey directory is plugged into: where it keeps passkeys, and how it asks the
 * hosted passkey server about a name.
 */

import * as db from "./db";
import type {
  PasskeyInsertResult,
  PendingPasskeyRegistration,
  StoredPasskey,
} from "./db/passkey-directory";
import type { HostedPasskeyNameCheck, PasskeyDirectoryStore } from "./passkey-directory";

/** A sign-up waits on this answer, and the app asks again by itself when it gets none. */
const HOSTED_LOOKUP_TIMEOUT_MS = 4_000;

/**
 * Ask the hosted passkey server whether it holds a name. Accounts created before the directory
 * live only there, and their names must stay taken.
 */
export function createHostedPasskeyNameCheck(options: {
  /** The hosted server's JSON-RPC address, including its API key. */
  rpcUrl: string;
  /** An origin the hosted server recognizes; it refuses requests without one. */
  origin: string;
  fetch?: typeof fetch;
}): HostedPasskeyNameCheck {
  const request = options.fetch ?? fetch;
  return async (userName) => {
    const response = await request(options.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json", origin: options.origin },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "pks_getCredentials",
        params: [{ userName }],
      }),
      signal: AbortSignal.timeout(HOSTED_LOOKUP_TIMEOUT_MS),
    }).catch((cause: unknown) => {
      // The address carries the API key, and a transport error can quote the address, so only
      // the kind of failure is passed on to the log.
      throw new Error(
        `Hosted passkey lookup could not connect (${cause instanceof Error ? cause.name : "unknown"})`
      );
    });
    if (!response.ok) {
      throw new Error(`Hosted passkey lookup answered ${response.status}`);
    }
    const body = (await response.json()) as { result?: unknown } | null;
    if (!Array.isArray(body?.result)) {
      throw new Error("Hosted passkey lookup returned no result");
    }
    return body.result.length > 0;
  };
}

export class MemoryPasskeyDirectoryStore implements PasskeyDirectoryStore {
  private passkeys = new Map<string, StoredPasskey>();
  private challenges = new Map<string, PendingPasskeyRegistration>();

  async findByName(userName: string): Promise<StoredPasskey | undefined> {
    return this.passkeys.get(userName);
  }

  async insert(passkey: StoredPasskey): Promise<PasskeyInsertResult> {
    if (this.passkeys.has(passkey.userName)) return { ok: false, reason: "name_taken" };
    for (const existing of this.passkeys.values()) {
      if (existing.credentialId === passkey.credentialId) {
        return { ok: false, reason: "credential_exists" };
      }
    }
    this.passkeys.set(passkey.userName, passkey);
    return { ok: true };
  }

  async saveChallenge(pending: PendingPasskeyRegistration, now: number): Promise<void> {
    this.dropExpired(now);
    this.challenges.set(pending.challenge, pending);
  }

  async takeChallenge(
    challenge: string,
    now: number
  ): Promise<PendingPasskeyRegistration | undefined> {
    this.dropExpired(now);
    const pending = this.challenges.get(challenge);
    this.challenges.delete(challenge);
    return pending;
  }

  private dropExpired(now: number): void {
    for (const [key, pending] of this.challenges) {
      if (pending.expiresAt <= now) this.challenges.delete(key);
    }
  }
}

/** The directory's store in the agent's own database, which outlives a restart. */
export function createSqlitePasskeyDirectoryStore(): PasskeyDirectoryStore {
  // Look the database up on each call, so the store can be made before the database is opened.
  const queries = () => db.getDB().passkeyDirectory();
  return {
    findByName: async (userName) => queries().findByName(userName),
    insert: async (passkey) => queries().insert(passkey),
    saveChallenge: async (pending, now) => queries().saveChallenge(pending, now),
    takeChallenge: async (challenge, now) => queries().takeChallenge(challenge, now),
  };
}
