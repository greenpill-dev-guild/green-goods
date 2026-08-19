import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Address } from "@green-goods/shared/types";

export type SavedOffersOwnerSession = { chainId: number; owner: Address; expiresAt: number };
export type SavedOffersSessionStore = {
  issueChallenge(input: {
    chainId: number;
    owner: Address;
    audience: string;
  }): Promise<{ nonce: string; expiresAt: number }>;
  consumeChallenge(input: {
    chainId: number;
    owner: Address;
    audience: string;
    nonce: string;
  }): Promise<"valid" | "expired" | "invalid">;
  createSession(input: {
    chainId: number;
    owner: Address;
  }): Promise<{ token: string; expiresAt: number }>;
  authenticate(token: string): Promise<SavedOffersOwnerSession | undefined>;
};

type SessionPayload = SavedOffersOwnerSession & { version: 1; nonce: string };

/**
 * Challenge storage stays one-time and bounded in-process. When tokenSecret is
 * provided, owner sessions are signed and portable across restarts/replicas.
 */
export class MemorySavedOffersSessionStore implements SavedOffersSessionStore {
  private readonly challenges = new Map<
    string,
    { chainId: number; owner: Address; audience: string; expiresAt: number }
  >();
  private readonly sessions = new Map<string, SavedOffersOwnerSession>();
  private readonly now: () => number;
  private readonly tokenKey?: Buffer;

  constructor(options: { now?: () => number; tokenSecret?: string } = {}) {
    this.now = options.now ?? Date.now;
    this.tokenKey = options.tokenSecret
      ? createHash("sha256").update(options.tokenSecret).digest()
      : undefined;
  }

  async issueChallenge(input: { chainId: number; owner: Address; audience: string }) {
    this.sweepExpired();
    const nonce = randomBytes(32).toString("hex");
    const expiresAt = Math.floor(this.now() / 1000) + 5 * 60;
    this.challenges.set(challengeHash(nonce), {
      ...input,
      owner: input.owner.toLowerCase() as Address,
      expiresAt,
    });
    return { nonce, expiresAt };
  }

  async consumeChallenge(input: {
    chainId: number;
    owner: Address;
    audience: string;
    nonce: string;
  }): Promise<"valid" | "expired" | "invalid"> {
    const key = challengeHash(input.nonce);
    const challenge = this.challenges.get(key);
    this.challenges.delete(key);
    if (!challenge) return "invalid";
    if (challenge.expiresAt < Math.floor(this.now() / 1000)) return "expired";
    if (
      challenge.chainId !== input.chainId ||
      challenge.owner !== input.owner.toLowerCase() ||
      challenge.audience !== input.audience
    ) {
      return "invalid";
    }
    return "valid";
  }

  async createSession(input: { chainId: number; owner: Address }) {
    this.sweepExpired();
    const expiresAt = Math.floor(this.now() / 1000) + 15 * 60;
    const session = {
      chainId: input.chainId,
      owner: input.owner.toLowerCase() as Address,
      expiresAt,
    };
    if (this.tokenKey) {
      return {
        token: this.signSession({ ...session, version: 1, nonce: randomBytes(16).toString("hex") }),
        expiresAt,
      };
    }
    const token = randomBytes(32).toString("hex");
    this.sessions.set(sessionHash(token), session);
    return { token, expiresAt };
  }

  async authenticate(token: string): Promise<SavedOffersOwnerSession | undefined> {
    this.sweepExpired();
    if (this.tokenKey) return this.authenticateSignedSession(token);
    const key = sessionHash(token);
    const session = this.sessions.get(key);
    if (!session) return undefined;
    if (session.expiresAt < Math.floor(this.now() / 1000)) {
      this.sessions.delete(key);
      return undefined;
    }
    return session;
  }

  private signSession(payload: SessionPayload): string {
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = createHmac("sha256", this.tokenKey!).update(encoded).digest("base64url");
    return `${encoded}.${signature}`;
  }

  private authenticateSignedSession(token: string): SavedOffersOwnerSession | undefined {
    const [encoded, suppliedSignature, extra] = token.split(".");
    if (!encoded || !suppliedSignature || extra) return undefined;
    const expectedSignature = createHmac("sha256", this.tokenKey!)
      .update(encoded)
      .digest("base64url");
    const supplied = Buffer.from(suppliedSignature);
    const expected = Buffer.from(expectedSignature);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
      return undefined;
    try {
      const payload = JSON.parse(
        Buffer.from(encoded, "base64url").toString("utf8")
      ) as SessionPayload;
      if (
        payload.version !== 1 ||
        !Number.isSafeInteger(payload.chainId) ||
        payload.chainId <= 0 ||
        !/^0x[0-9a-f]{40}$/.test(payload.owner) ||
        !Number.isSafeInteger(payload.expiresAt) ||
        typeof payload.nonce !== "string" ||
        payload.expiresAt < Math.floor(this.now() / 1000)
      ) {
        return undefined;
      }
      return { chainId: payload.chainId, owner: payload.owner, expiresAt: payload.expiresAt };
    } catch {
      return undefined;
    }
  }

  private sweepExpired(): void {
    const now = Math.floor(this.now() / 1000);
    for (const [key, challenge] of this.challenges) {
      if (challenge.expiresAt < now) this.challenges.delete(key);
    }
    for (const [key, session] of this.sessions) {
      if (session.expiresAt < now) this.sessions.delete(key);
    }
  }
}

function challengeHash(nonce: string): string {
  return createHash("sha256").update(`saved-offer-challenge:${nonce}`).digest("hex");
}

function sessionHash(token: string): string {
  return createHash("sha256").update(`saved-offer-session:${token}`).digest("hex");
}
