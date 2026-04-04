/**
 * Auth module tests — SIWE challenge/verify/session lifecycle
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  challenges,
  sessions,
  createChallenge,
  createSession,
  pruneExpiredAuthState,
  type AuthChallenge,
} from "../auth";

describe("Auth", () => {
  const VALID_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

  beforeEach(() => {
    challenges.clear();
    sessions.clear();
  });

  describe("createChallenge", () => {
    it("returns a challenge with the address embedded in the message", () => {
      const challenge = createChallenge(VALID_ADDRESS);

      expect(challenge.message).toContain(VALID_ADDRESS);
      expect(challenge.message).toContain("Green Goods Ops Runner Authentication");
      expect(challenge.message).toContain("Nonce:");
      expect(challenge.message).toContain("Issued At:");
    });

    it("sets an expiration time in the future", () => {
      const before = Date.now();
      const challenge = createChallenge(VALID_ADDRESS);

      expect(challenge.expiresAt).toBeGreaterThan(before);
    });

    it("generates unique nonces for each challenge", () => {
      const challenge1 = createChallenge(VALID_ADDRESS);
      const challenge2 = createChallenge(VALID_ADDRESS);

      // Nonces are embedded in the message, so different messages means different nonces
      expect(challenge1.message).not.toBe(challenge2.message);
    });
  });

  describe("createSession", () => {
    it("returns a token and expiration", () => {
      const session = createSession(VALID_ADDRESS);

      expect(session.token).toBeDefined();
      expect(typeof session.token).toBe("string");
      expect(session.token.length).toBeGreaterThan(0);
      expect(session.expiresAt).toBeGreaterThan(Date.now());
    });

    it("stores the session in the sessions map", () => {
      const session = createSession(VALID_ADDRESS);

      const stored = sessions.get(session.token);
      expect(stored).toBeDefined();
      expect(stored!.address).toBe(VALID_ADDRESS);
      expect(stored!.expiresAt).toBe(session.expiresAt);
    });

    it("generates unique tokens per call", () => {
      const session1 = createSession(VALID_ADDRESS);
      const session2 = createSession(VALID_ADDRESS);

      expect(session1.token).not.toBe(session2.token);
    });
  });

  describe("pruneExpiredAuthState", () => {
    it("removes expired challenges", () => {
      const expiredChallenge: AuthChallenge = {
        message: "test",
        expiresAt: Date.now() - 1000,
      };
      challenges.set(VALID_ADDRESS, expiredChallenge);

      expect(challenges.size).toBe(1);
      pruneExpiredAuthState();
      expect(challenges.size).toBe(0);
    });

    it("keeps non-expired challenges", () => {
      const validChallenge: AuthChallenge = {
        message: "test",
        expiresAt: Date.now() + 60_000,
      };
      challenges.set(VALID_ADDRESS, validChallenge);

      pruneExpiredAuthState();
      expect(challenges.size).toBe(1);
    });

    it("removes expired sessions", () => {
      sessions.set("expired-token", {
        address: VALID_ADDRESS,
        expiresAt: Date.now() - 1000,
      });

      expect(sessions.size).toBe(1);
      pruneExpiredAuthState();
      expect(sessions.size).toBe(0);
    });

    it("keeps non-expired sessions", () => {
      sessions.set("valid-token", {
        address: VALID_ADDRESS,
        expiresAt: Date.now() + 60_000,
      });

      pruneExpiredAuthState();
      expect(sessions.size).toBe(1);
    });

    it("handles mixed expired and valid entries", () => {
      const addr2 = "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B";

      challenges.set(VALID_ADDRESS, { message: "expired", expiresAt: Date.now() - 1000 });
      challenges.set(addr2, { message: "valid", expiresAt: Date.now() + 60_000 });

      sessions.set("expired-token", { address: VALID_ADDRESS, expiresAt: Date.now() - 1000 });
      sessions.set("valid-token", { address: addr2, expiresAt: Date.now() + 60_000 });

      pruneExpiredAuthState();

      expect(challenges.size).toBe(1);
      expect(challenges.has(addr2)).toBe(true);
      expect(sessions.size).toBe(1);
      expect(sessions.has("valid-token")).toBe(true);
    });
  });
});
