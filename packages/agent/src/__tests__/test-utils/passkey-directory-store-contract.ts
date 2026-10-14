import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { PasskeyDirectoryStore } from "../../services/passkey-directory";

const NOW = 1_759_600_000_000;

/**
 * What every passkey directory store must guarantee. Each case uses its own names, so the
 * contract also runs against a database that outlives the test.
 */
export function passkeyDirectoryStoreContract(
  label: string,
  createStore: () => PasskeyDirectoryStore
) {
  describe(label, () => {
    it("keeps the first passkey for a name and for a credential", async () => {
      const store = createStore();
      const passkey = {
        userName: `ana-${randomUUID()}`,
        credentialId: `credential-${randomUUID()}`,
        publicKey: "0x04aa" as const,
        rpId: "greengoods.app",
        origin: "https://beta.greengoods.app",
        createdAt: new Date(NOW).toISOString(),
      };
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

    it("hands a pending registration out once and drops it when it expires", async () => {
      const store = createStore();
      const pending = {
        challenge: `challenge-${randomUUID()}`,
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

      expect(await store.takeChallenge(pending.challenge, NOW)).toEqual(pending);
      expect(await store.takeChallenge(pending.challenge, NOW)).toBeUndefined();
      expect(await store.takeChallenge(expiring.challenge, NOW + 1000)).toBeUndefined();

      // A later sign-up clears the ones nobody finished, so they cannot pile up.
      const later = { ...pending, challenge: `challenge-${randomUUID()}`, expiresAt: NOW + 2000 };
      await store.saveChallenge(later, NOW + 1000);
      expect(await store.takeChallenge(abandoned.challenge, NOW)).toBeUndefined();
      expect(await store.takeChallenge(later.challenge, NOW + 1000)).toEqual(later);
    });
  });
}
