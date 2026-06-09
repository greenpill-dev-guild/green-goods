import { describe, expect, it } from "vitest";

import {
  buildPasskeyRecoveryContext,
  classifyPasskeyCeremonyContext,
  getPasskeyRpId,
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
  describe("passkey recovery context", () => {
    it("normalizes usernames and ENS handles for lookup", () => {
      expect(normalizePasskeyAccountIdentifier(" @Alice ")).toBe("alice");
      expect(normalizePasskeyAccountIdentifier("@@Garden.Member")).toBe("garden.member");
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
      expect(getPasskeyRpId({ VITE_PASSKEY_RP_ID: "staging.greengoods.app" })).toBe(
        "staging.greengoods.app"
      );
    });
  });
});
