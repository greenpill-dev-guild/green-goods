import { randomBytes } from "node:crypto";

import type { FastifyReply, FastifyRequest } from "fastify";

import { NONCE_TTL_MS, SESSION_TTL_MS } from "./types";

export interface AuthChallenge {
  message: string;
  expiresAt: number;
}

interface AuthSession {
  address: string;
  expiresAt: number;
}

export const challenges = new Map<string, AuthChallenge>();
export const sessions = new Map<string, AuthSession>();

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  const tokenFromHeader = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;
  const tokenFromQuery = (() => {
    const query = request.query as { token?: string } | undefined;
    return query?.token?.trim() || null;
  })();

  const token = tokenFromHeader || tokenFromQuery;
  if (!token) {
    reply.code(401).send({ error: "Missing bearer token" });
    return;
  }

  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    reply.code(401).send({ error: "Session expired" });
    return;
  }

  request.sessionAddress = session.address;
}

export function createChallenge(address: string): AuthChallenge {
  const nonce = randomBytes(16).toString("hex");
  const issuedAt = new Date().toISOString();
  return {
    message: `Green Goods Ops Runner Authentication\nAddress: ${address}\nNonce: ${nonce}\nIssued At: ${issuedAt}`,
    expiresAt: Date.now() + NONCE_TTL_MS,
  };
}

export function createSession(address: string): { token: string; expiresAt: number } {
  const token = randomBytes(32).toString("hex");
  const expiresAt = Date.now() + SESSION_TTL_MS;
  sessions.set(token, { address, expiresAt });
  return { token, expiresAt };
}

export function pruneExpiredAuthState(): void {
  const now = Date.now();
  for (const [address, challenge] of challenges.entries()) {
    if (challenge.expiresAt < now) {
      challenges.delete(address);
    }
  }

  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt < now) {
      sessions.delete(token);
    }
  }
}
