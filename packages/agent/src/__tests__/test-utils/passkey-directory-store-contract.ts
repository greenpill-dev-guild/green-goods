import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { StoredPasskey } from "../../services/db/passkey-directory";
import type { PasskeyDirectoryStore } from "../../services/passkey-directory";

const NOW = 1_759_600_000_000;
/** Two P-256 keys in the stored form: 0x04, then lowercase x and y. */
const KEY = `0x04${"1a".repeat(32)}${"2b".repeat(32)}` as const;
const OTHER_KEY = `0x04${"3c".repeat(32)}${"4d".repeat(32)}` as const;

/** A registered passkey under fresh names, so the contract also runs on a database that lasts. */
function passkeyFor(overrides: Partial<StoredPasskey> = {}): StoredPasskey {
  const credentialId = `credential-${randomUUID()}`;
  return {
    userName: `ana-${randomUUID()}`,
    credentialId,
    credentialKey: credentialId,
    publicKey: KEY,
    rpId: "greengoods.app",
    origin: "https://beta.greengoods.app",
    source: "registered",
    createdAt: new Date(NOW).toISOString(),
    ...overrides,
  };
}

/**
 * What every passkey directory store must guarantee. Each case uses its own names, so the
 * contract also runs against a database that outlives the test.
 */
export function passkeyDirectoryStoreContract(
  label: string,
  createStore: () => PasskeyDirectoryStore
) {
  describe(label, () => {
    it("keeps the first passkey for a name, and one account under one name", async () => {
      const store = createStore();
      const passkey = passkeyFor();
      const otherName = `bea-${randomUUID()}`;

      expect(await store.insert(passkey)).toEqual({ ok: true });
      expect(
        await store.insert({ ...passkey, credentialId: `credential-${randomUUID()}` })
      ).toEqual({ ok: false, reason: "name_taken" });
      expect(await store.insert({ ...passkey, userName: otherName })).toEqual({
        ok: false,
        reason: "credential_exists",
      });
      expect(await store.findByName(passkey.userName)).toEqual(passkey);
      expect(await store.findByName(otherName)).toBeUndefined();
    });

    it("refuses one account under a second name, however its key is spelled", async () => {
      const store = createStore();
      const passkey = passkeyFor();
      const bareKey = `0x${KEY.slice(4)}` as const;
      const upperKey = `0x${KEY.slice(2).toUpperCase()}` as const;

      expect(await store.insert(passkey)).toEqual({ ok: true });
      for (const publicKey of [bareKey, upperKey]) {
        expect(
          await store.insert({ ...passkey, userName: `bea-${randomUUID()}`, publicKey })
        ).toEqual({ ok: false, reason: "credential_exists" });
      }
    });

    it("stores every key in one spelling, and refuses one that is not a P-256 point", async () => {
      const store = createStore();
      const passkey = passkeyFor({ publicKey: `0x${KEY.slice(4).toUpperCase()}` as const });

      expect(await store.insert(passkey)).toEqual({ ok: true });
      expect((await store.findByName(passkey.userName))?.publicKey).toBe(KEY);
      await expect(store.insert(passkeyFor({ publicKey: "0x04aa" }))).rejects.toThrow(
        "not an uncompressed P-256 point"
      );
    });

    it("takes the other spelling of a held passkey as its own account", async () => {
      const store = createStore();
      // One passkey's bytes, stored as two strings: Kernel hashes each into its own address.
      const bytes = `bytes-${randomUUID()}`;
      const legacy = passkeyFor({ credentialId: `hex-${bytes}`, credentialKey: bytes });
      const hosted = passkeyFor({ credentialId: `b64-${bytes}`, credentialKey: bytes });

      expect(await store.insert(hosted)).toEqual({ ok: true });
      expect(await store.insert({ ...legacy, source: "adopted" })).toEqual({ ok: true });
      expect((await store.findByName(legacy.userName))?.credentialId).toBe(legacy.credentialId);
      expect((await store.findByName(hosted.userName))?.credentialId).toBe(hosted.credentialId);
    });

    it("stores a claimed ID with another key beside the real one, blocking neither", async () => {
      const store = createStore();
      const claim = passkeyFor({ publicKey: OTHER_KEY });
      const owner = { ...claim, userName: `bea-${randomUUID()}`, publicKey: KEY };

      expect(await store.insert(claim)).toEqual({ ok: true });
      expect(await store.insert(owner)).toEqual({ ok: true });
      expect((await store.findByName(owner.userName))?.publicKey).toBe(KEY);
    });

    it("keeps an adopted row with the domain and the page it was adopted from", async () => {
      const store = createStore();
      const adopted = passkeyFor({
        source: "adopted",
        rpId: "www.greengoods.app",
        origin: "https://www.greengoods.app",
      });

      expect(await store.insert(adopted)).toEqual({ ok: true });
      expect(await store.findByName(adopted.userName)).toEqual(adopted);
    });

    it("hands a pending registration out once and drops it when it expires", async () => {
      const store = createStore();
      const pending = {
        challenge: `challenge-${randomUUID()}`,
        purpose: "registration" as const,
        userName: "ana",
        rpId: "greengoods.app",
        origin: "https://beta.greengoods.app",
        expiresAt: NOW + 1000,
      };
      const expiring = { ...pending, challenge: `challenge-${randomUUID()}` };
      const abandoned = { ...pending, challenge: `challenge-${randomUUID()}` };
      await store.saveChallenge(pending, NOW);
      await store.saveChallenge(expiring, NOW);
      await store.saveChallenge(abandoned, NOW);

      expect(await store.takeChallenge(pending.challenge, NOW, "registration")).toEqual(pending);
      expect(await store.takeChallenge(pending.challenge, NOW, "registration")).toBeUndefined();
      expect(
        await store.takeChallenge(expiring.challenge, NOW + 1000, "registration")
      ).toBeUndefined();

      // A later sign-up clears the ones nobody finished, so they cannot pile up.
      const later = { ...pending, challenge: `challenge-${randomUUID()}`, expiresAt: NOW + 2000 };
      await store.saveChallenge(later, NOW + 1000);
      expect(await store.takeChallenge(abandoned.challenge, NOW, "registration")).toBeUndefined();
      expect(await store.takeChallenge(later.challenge, NOW + 1000, "registration")).toEqual(later);
    });

    it("spends a challenge taken for the wrong purpose, and keeps an adoption's name and site", async () => {
      const store = createStore();
      const adoption = {
        challenge: `challenge-${randomUUID()}`,
        purpose: "adoption" as const,
        userName: "ana",
        rpId: "www.greengoods.app",
        origin: "https://www.greengoods.app",
        expiresAt: NOW + 1000,
      };
      const wrongPurpose = { ...adoption, challenge: `challenge-${randomUUID()}` };
      await store.saveChallenge(adoption, NOW);
      await store.saveChallenge(wrongPurpose, NOW);

      expect(
        await store.takeChallenge(wrongPurpose.challenge, NOW, "registration")
      ).toBeUndefined();
      expect(await store.takeChallenge(wrongPurpose.challenge, NOW, "adoption")).toBeUndefined();
      expect(await store.takeChallenge(adoption.challenge, NOW, "adoption")).toEqual(adoption);
    });
  });
}
