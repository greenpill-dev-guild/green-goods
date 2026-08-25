import { describe, expect, it } from "vitest";

import {
  buildPasskeyRecoveryContext,
  classifyPasskeyCeremonyContext,
  getPasskeyRpId,
  isPasskeyServerEnabled,
  normalizePasskeyAccountIdentifier,
} from "../../config/passkeyServer";

const locationFor = (origin: string): Pick<Location, "hostname" | "origin" | "protocol"> => {
  const url = new URL(origin);
  return {
    hostname: url.hostname,
    origin: url.origin,
    protocol: url.protocol,
  };
};

describe("config/passkeyServer", () => {
  describe("passkey server enablement", () => {
    it("defaults the passkey server on in production builds", () => {
      expect(isPasskeyServerEnabled({ PROD: true })).toBe(true);
    });

    it("keeps the passkey server off by default outside production", () => {
      expect(isPasskeyServerEnabled({ DEV: true, PROD: false })).toBe(false);
    });

    it("honors explicit env overrides", () => {
      expect(isPasskeyServerEnabled({ PROD: true, VITE_PASSKEY_SERVER_ENABLED: "false" })).toBe(
        false
      );
      expect(
        isPasskeyServerEnabled({ DEV: true, PROD: false, VITE_PASSKEY_SERVER_ENABLED: "true" })
      ).toBe(true);
    });
  });

  describe("passkey recovery context", () => {
    it("normalizes usernames and ENS handles for lookup", () => {
      expect(normalizePasskeyAccountIdentifier(" @Alice ")).toBe("alice");
      expect(normalizePasskeyAccountIdentifier("@@Garden.Member")).toBe("garden.member");
      expect(buildPasskeyRecoveryContext(" @Alice ")).toEqual({ userName: "alice" });
    });

    it("rejects recovery identifiers that are too short", () => {
      expect(() => buildPasskeyRecoveryContext("ab")).toThrow(
        "Username is required for passkey recovery"
      );
    });
  });

  describe("passkey ceremony context classification", () => {
    it("allows localhost over HTTP only in development", () => {
      expect(
        classifyPasskeyCeremonyContext({
          env: { DEV: true },
          location: locationFor("http://localhost:5173"),
        })
      ).toEqual({
        supported: true,
        rpId: "localhost",
        origin: "http://localhost:5173",
      });
    });

    it("uses 127.0.0.1 as the RP ID for 127.0.0.1 development ceremonies", () => {
      expect(
        classifyPasskeyCeremonyContext({
          env: { DEV: true },
          location: locationFor("http://127.0.0.1:5173"),
        })
      ).toEqual({
        supported: true,
        rpId: "127.0.0.1",
        origin: "http://127.0.0.1:5173",
      });
    });

    it("blocks local development ceremonies when a custom RP ID does not match", () => {
      expect(
        classifyPasskeyCeremonyContext({
          env: { DEV: true, VITE_PASSKEY_RP_ID: "staging.greengoods.app" },
          location: locationFor("http://127.0.0.1:5173"),
        })
      ).toMatchObject({
        supported: false,
        reason: "rp_origin_mismatch",
        rpId: "staging.greengoods.app",
      });
    });

    it("blocks localhost ceremonies in production", () => {
      expect(
        classifyPasskeyCeremonyContext({
          env: { PROD: true },
          location: locationFor("https://127.0.0.1:5173"),
        })
      ).toMatchObject({
        supported: false,
        reason: "preview_or_localhost_production",
      });
    });

    it("blocks production RP ID mismatch on unrelated origins", () => {
      expect(
        classifyPasskeyCeremonyContext({
          env: { PROD: true },
          location: locationFor("https://example.com"),
        })
      ).toMatchObject({
        supported: false,
        reason: "rp_origin_mismatch",
        rpId: "greengoods.app",
      });
    });

    // Pins the property the pending staging rollout depends on: with no RP
    // override, a subdomain resolves the apex RP rather than its own hostname.
    // Staging still sets an override today, so this describes the code, not the
    // deployment. A narrower RP would not change the address formula (`rpId` is
    // a signing-ceremony parameter and never enters Kernel's validator data);
    // it would keep the browser from offering the existing credential at all,
    // so the gardener registers a new one and that new public key gives them a
    // second account. Tightening `matchesRpId` to an exact hostname comparison
    // is what this case is here to catch.
    it("resolves the apex RP ID for subdomains of the production origin", () => {
      for (const origin of [
        "https://greengoods.app",
        "https://www.greengoods.app",
        "https://staging.greengoods.app",
      ]) {
        expect(
          classifyPasskeyCeremonyContext({
            env: { PROD: true },
            location: locationFor(origin),
          })
        ).toMatchObject({
          supported: true,
          rpId: "greengoods.app",
          origin,
        });
      }
    });

    // Characterization, not endorsement. The check trusts every subdomain, so
    // hosts the spec does not approve pass it too. `staging-admin` is the live
    // example: it is deliberately outside the rollout because `packages/admin`
    // has no passkey entrypoint, yet the check still admits it. Closing that
    // gap is an open decision (see the spec's "Approved origins versus enforced
    // origins"), and these are the cases that will fail if it is closed.
    it("currently trusts any production subdomain, approved or not", () => {
      for (const origin of [
        "https://unapproved.greengoods.app",
        "https://staging-admin.greengoods.app",
      ]) {
        expect(
          classifyPasskeyCeremonyContext({
            env: { PROD: true },
            location: locationFor(origin),
          })
        ).toMatchObject({
          supported: true,
          rpId: "greengoods.app",
        });
      }
    });

    // Sharing the RP with the named staging alias must not extend to the
    // per-deployment preview URLs, which are unbounded and publicly guessable.
    it("still blocks preview deployment origins in production", () => {
      expect(
        classifyPasskeyCeremonyContext({
          env: { PROD: true },
          location: locationFor("https://green-goods-abc123-greenpilldevguild.vercel.app"),
        })
      ).toMatchObject({
        supported: false,
        reason: "preview_or_localhost_production",
      });
    });

    it("enforces custom staging RP IDs", () => {
      const env = { VITE_PASSKEY_RP_ID: "staging.greengoods.app" };

      expect(
        classifyPasskeyCeremonyContext({
          env,
          location: locationFor("https://app.staging.greengoods.app"),
        })
      ).toMatchObject({
        supported: true,
        rpId: "staging.greengoods.app",
      });

      expect(
        classifyPasskeyCeremonyContext({
          env,
          location: locationFor("https://app.greengoods.app"),
        })
      ).toMatchObject({
        supported: false,
        reason: "rp_origin_mismatch",
        rpId: "staging.greengoods.app",
      });
    });

    it("returns custom RP ID from env overrides", () => {
      expect(getPasskeyRpId({ VITE_PASSKEY_RP_ID: " Staging.GreenGoods.App " })).toBe(
        "staging.greengoods.app"
      );
    });
  });
});
