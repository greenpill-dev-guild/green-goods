import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
// Avoid importing optional types package to keep deps minimal; use `unknown` safely cast below

// Load environment variables: prefer monorepo root .env, then local
try {
  const rootEnv = path.resolve(process.cwd(), "../../.env");
  if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv, override: true });
} catch {}
dotenv.config({ override: false });

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
  },
});

const PORT = Number(process.env.PORT) || 3000;

// In-memory stores (replace with DB in production)
type UserRecord = { id: string; createdAt: string };
type CredentialRecord = {
  id: string; // base64url credential ID
  userId: string;
  publicKey: string; // base64url
  counter: number;
};
const users = new Map<string, UserRecord>();
const credentials = new Map<string, CredentialRecord>();
const userToCredIds = new Map<string, Set<string>>();

// Very simple session store keyed by signed cookie SID
type SessionRecord = {
  userId?: string;
  challenge?: string;
};
const sessions = new Map<string, SessionRecord>();

function getCookieDomain(): string | undefined {
  if (process.env.NODE_ENV === "production") return ".greengoods.app";
  return undefined;
}

function getRpFromRequest(reqHost?: string): { rpID: string; origin: string } {
  const envRpId = process.env.RP_ID;
  const envOrigin = process.env.RP_ORIGIN;
  if (envRpId && envOrigin) return { rpID: envRpId, origin: envOrigin };
  if (process.env.NODE_ENV === "production") {
    return { rpID: "greengoods.app", origin: "https://greengoods.app" };
  }
  // Dev
  const host = reqHost || "localhost:3001";
  const hostname = host.split(":")[0] || "localhost";
  return { rpID: hostname, origin: "http://localhost:3001" };
}

function getOrCreateSessionId(): string {
  // lightweight random SID
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function getPimlicoRpcUrl(chainId?: number | string): string {
  const id = chainId ? Number(chainId) : Number(process.env.VITE_CHAIN_ID || 0);
  const apiKey = process.env.PIMLICO_API_KEY || "";
  const slug = (() => {
    switch (id) {
      case 31337:
        return "31337";
      case 11155111:
        return "11155111";
      case 42161:
        return "42161";
      case 8453:
        return "8453";
      case 84532:
        return "84532";
      case 10:
        return "10";
      case 42220: // Celo
        return "42220";
      case 44787: // Alfajores
        return "44787";
      default:
        return String(id);
    }
  })();
  const base = `https://api.pimlico.io/v2/${slug}/rpc`;
  return apiKey ? `${base}?apikey=${apiKey}` : base;
}

function getEntryPoint(chainId: number): `0x${string}` {
  try {
    const p = path.resolve(process.cwd(), "../contracts/deployments/networks.json");
    const raw = fs.readFileSync(p, "utf-8");
    const json = JSON.parse(raw) as Record<string, { contracts?: { erc4337EntryPoint?: string } }>;
    const key = String(chainId);
    const ep = json?.[key]?.contracts?.erc4337EntryPoint;
    if (typeof ep === "string" && ep.startsWith("0x") && ep.length === 42)
      return ep as `0x${string}`;
  } catch {}
  // Default canonical entry point
  return "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
}

// Register CORS & Cookie plugins
await fastify.register(cors, {
  origin:
    process.env.NODE_ENV === "production"
      ? ["https://greengoods.app", "https://staging.greengoods.app"]
      : ["http://localhost:3001"],
  credentials: true,
});

await fastify.register(cookie, {
  secret: process.env.SESSION_SECRET || "dev-secret",
  hook: "onRequest",
  parseOptions: getCookieDomain()
    ? {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        domain: getCookieDomain()!,
        path: "/",
      }
    : {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      },
});

// Helper to load or create a session per request
fastify.addHook("onRequest", async (request, reply) => {
  const reqAny = request as unknown as { cookies?: Record<string, string> };
  let sid = (reqAny.cookies?.sid as string | undefined) || undefined;
  if (!sid || !sessions.has(sid)) {
    sid = getOrCreateSessionId();
    sessions.set(sid, {});
    const dom = getCookieDomain();
    reply.setCookie(
      "sid",
      sid,
      dom
        ? {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            domain: dom,
            path: "/",
            signed: false,
          }
        : {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            signed: false,
          }
    );
  }
  (request as unknown as { sid: string }).sid = sid;
});

// Auth: WebAuthn registration options
fastify.post("/auth/register/options", async (request, reply) => {
  try {
    const sid: string = (request as unknown as { sid: string }).sid;
    const session = sessions.get(sid)!;
    const { rpID, origin } = getRpFromRequest(request.headers.host);

    // Create or reuse a user for this session
    const userId =
      users.get(session.userId || "")?.id ||
      Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    if (!users.has(userId)) {
      users.set(userId, { id: userId, createdAt: new Date().toISOString() });
    }
    session.userId = userId;

    const userCredIds = Array.from(userToCredIds.get(userId) || []);
    const options = await generateRegistrationOptions({
      rpName: process.env.RP_NAME || "GreenGoods",
      rpID,
      userID: userId,
      userName: userId,
      attestationType: "none",
      excludeCredentials: userCredIds.map((credId) => ({ id: credId })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    } as unknown as Parameters<typeof generateRegistrationOptions>[0]);
    session.challenge = options.challenge;
    return reply.send({ publicKey: options, origin });
  } catch (error) {
    fastify.log.error({ err: error }, "register/options error");
    return reply.status(500).send({ error: "Internal server error" });
  }
});

// Auth: WebAuthn registration verify
fastify.post("/auth/register/verify", async (request, reply) => {
  try {
    const sid: string = (request as unknown as { sid: string }).sid;
    const session = sessions.get(sid)!;
    const expectedChallenge = session.challenge;
    if (!expectedChallenge) return reply.status(400).send({ error: "No challenge in session" });
    const { rpID, origin } = getRpFromRequest(request.headers.host);

    const verification = await verifyRegistrationResponse({
      response: (request as unknown as { body: unknown }).body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    } as unknown as Parameters<typeof verifyRegistrationResponse>[0]);
    if (!verification.verified || !verification.registrationInfo) {
      return reply.status(400).send({ error: "Registration verification failed" });
    }
    const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
    const userId = session.userId!;

    const credIdB64u = Buffer.from(credentialID).toString("base64url");
    credentials.set(credIdB64u, {
      id: credIdB64u,
      userId,
      publicKey: Buffer.from(credentialPublicKey).toString("base64url"),
      counter,
    });
    const setForUser = userToCredIds.get(userId) || new Set<string>();
    setForUser.add(credIdB64u);
    userToCredIds.set(userId, setForUser);
    delete session.challenge;
    return reply.send({ ok: true, user: { id: userId } });
  } catch (error) {
    fastify.log.error({ err: error }, "register/verify error");
    return reply.status(500).send({ error: "Internal server error" });
  }
});

// Auth: login options (allow resident keys; allowCredentials omitted)
fastify.post("/auth/login/options", async (request, reply) => {
  try {
    const sid: string = (request as unknown as { sid: string }).sid;
    const session = sessions.get(sid)!;
    const { rpID, origin } = getRpFromRequest(request.headers.host);
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "preferred",
      allowCredentials: [],
    });
    session.challenge = options.challenge;
    return reply.send({ publicKey: options, origin });
  } catch (error) {
    fastify.log.error({ err: error }, "login/options error");
    return reply.status(500).send({ error: "Internal server error" });
  }
});

// Auth: login verify
fastify.post("/auth/login/verify", async (request, reply) => {
  try {
    const sid: string = (request as unknown as { sid: string }).sid;
    const session = sessions.get(sid)!;
    const expectedChallenge = session.challenge;
    if (!expectedChallenge) return reply.status(400).send({ error: "No challenge in session" });
    const { rpID, origin } = getRpFromRequest(request.headers.host);

    // Extract credential ID from response to find stored public key
    const body = (request as unknown as { body: { id?: string } & Record<string, unknown> }).body;
    const credIdB64u: string | undefined = body?.id;
    if (!credIdB64u) return reply.status(400).send({ error: "Missing credential id" });
    const stored = credentials.get(credIdB64u);
    if (!stored) return reply.status(404).send({ error: "Credential not found" });

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: Buffer.from(stored.id, "base64url"),
        credentialPublicKey: Buffer.from(stored.publicKey, "base64url"),
        counter: stored.counter,
        transports: undefined,
      },
    } as unknown as Parameters<typeof verifyAuthenticationResponse>[0]);
    if (!verification.verified || !verification.authenticationInfo) {
      return reply.status(400).send({ error: "Authentication verification failed" });
    }
    // Update counter
    credentials.set(stored.id, { ...stored, counter: verification.authenticationInfo.newCounter });

    delete session.challenge;
    session.userId = stored.userId;
    return reply.send({ ok: true, user: { id: stored.userId } });
  } catch (error) {
    fastify.log.error({ err: error }, "login/verify error");
    return reply.status(500).send({ error: "Internal server error" });
  }
});

// Auth: logout
fastify.post("/auth/logout", async (request, reply) => {
  const sid: string = (request as unknown as { sid: string }).sid;
  const session = sessions.get(sid);
  if (session) {
    delete session.userId;
    delete session.challenge;
  }
  const dom = getCookieDomain();
  reply.clearCookie("sid", dom ? { path: "/", domain: dom } : { path: "/" });
  return reply.send({ ok: true });
});

// Current session/user
fastify.get("/me", async (request, reply) => {
  const sid: string = (request as unknown as { sid: string }).sid;
  const session = sessions.get(sid) || {};
  const user = session.userId ? users.get(session.userId) : undefined;
  return reply.send({ user: user ? { id: user.id } : null, smartAccountAddress: null });
});

// Current user's first passkey credential metadata (for client-driven validators)
fastify.get("/auth/credential", async (request, reply) => {
  const sid: string = (request as unknown as { sid: string }).sid;
  const session = sessions.get(sid) || {};
  if (!session.userId) return reply.status(401).send({ error: "Unauthorized" });
  const credIds = Array.from(userToCredIds.get(session.userId) || []);
  if (credIds.length === 0) return reply.send({ credential: null });
  const first = credentials.get(credIds[0]);
  if (!first) return reply.send({ credential: null });
  return reply.send({ credential: { id: first.id, publicKey: first.publicKey } });
});

// Subscribe route
fastify.post<{
  Body: { email: string };
}>("/subscribe", async (request, reply) => {
  const { email } = request.body;

  if (!email) {
    return reply.status(400).send({
      success: false,
      error: "Email is required",
    });
  }

  // Basic email validation - using a safer regex pattern that avoids ReDoS
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!emailRegex.test(email)) {
    return reply.status(400).send({
      success: false,
      error: "Invalid email format",
    });
  }

  try {
    const mailchimpUrl = `https://app.us13.list-manage.com/subscribe/post?u=16db3a1a92dd56e81459cd500&id=c6c12d1a3f&f_id=0021fae1f0`;

    const data = new URLSearchParams();
    data.append("EMAIL", email);
    data.append("b_16db3a1a92dd56e81459cd500_c6c12d1a3f", "");

    const response = await fetch(mailchimpUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: data.toString(),
    });

    if (response.ok) {
      return reply.status(200).send({
        success: true,
        message: "Subscription successful!",
      });
    } else {
      return reply.status(response.status).send({
        success: false,
        message: "Subscription failed.",
      });
    }
  } catch (error) {
    fastify.log.error({ err: error }, "Subscribe error");
    return reply.status(500).send({
      success: false,
      message: "Internal Server Error",
    });
  }
});

// Placeholder AA routes (to be implemented with Kernel + Pimlico sponsorship)
fastify.post("/aa/init", async (request, reply) => {
  const sid: string = (request as unknown as { sid: string }).sid;
  const session = sessions.get(sid) || {};
  if (!session.userId) return reply.status(401).send({ error: "Unauthorized" });
  // TODO: compute deterministic smart account address and return it
  return reply.send({ smartAccountAddress: null });
});

fastify.post("/aa/userop/options", async (request, reply) => {
  const sid: string = (request as unknown as { sid: string }).sid;
  const session = sessions.get(sid) || {};
  if (!session.userId) return reply.status(401).send({ error: "Unauthorized" });
  // TODO: build userOp and return a WebAuthn challenge bound to op for assertion
  return reply.send({ publicKey: null });
});

fastify.post("/aa/userop/submit", async (request, reply) => {
  const sid: string = (request as unknown as { sid: string }).sid;
  const session = sessions.get(sid) || {};
  if (!session.userId) return reply.status(401).send({ error: "Unauthorized" });
  // TODO: verify assertion, attach to userOp, add sponsorship, submit to bundler
  return reply.send({ userOpHash: null, txHash: null, smartAccountAddress: null });
});

// Bundler JSON-RPC proxy: forwards client JSON-RPC to Pimlico bundler
fastify.post("/aa/bundler", async (request, reply) => {
  const sid: string = (request as unknown as { sid: string }).sid;
  const session = sessions.get(sid) || {};
  if (!session.userId) return reply.status(401).send({ error: "Unauthorized" });
  const chainId = Number(
    ((request as unknown as { query?: { chainId?: string } }).query?.chainId as string) ??
      process.env.VITE_CHAIN_ID
  );
  const rpc = getPimlicoRpcUrl(chainId);
  const apiKey = process.env.PIMLICO_API_KEY || "";
  try {
    const rawBody = (request as unknown as { body?: Record<string, any> }).body;
    // Auto-sponsor if sending a user operation without paymaster
    if (
      rawBody?.method === "eth_sendUserOperation" &&
      Array.isArray(rawBody.params) &&
      rawBody.params[0]
    ) {
      const userOp = rawBody.params[0];
      const needsSponsor = !userOp.paymasterAndData || userOp.paymasterAndData === "0x";
      if (needsSponsor) {
        const base = `${request.protocol}://${request.headers.host}`;
        const sponsorRes = await fetch(`${base}/aa/sponsor`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userOp, chainId }),
        });
        if (sponsorRes.ok) {
          const s = (await sponsorRes.json()) as Record<string, unknown>;
          rawBody.params[0] = {
            ...userOp,
            paymasterAndData: s.paymasterAndData,
            preVerificationGas: s.preVerificationGas,
            verificationGasLimit: s.verificationGasLimit,
            callGasLimit: s.callGasLimit,
            maxFeePerGas: s.maxFeePerGas,
            maxPriorityFeePerGas: s.maxPriorityFeePerGas,
          } as typeof userOp;
        } else {
          const detail = await sponsorRes.text();
          return reply.status(502).send({ error: "auto_sponsor_failed", detail });
        }
      }
    }
    const res = await fetch(rpc, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(rawBody ?? (request as unknown as { body?: unknown }).body),
    });
    const text = await res.text();
    reply
      .status(res.status)
      .header("content-type", res.headers.get("content-type") || "application/json")
      .send(text);
  } catch (err) {
    fastify.log.error({ err }, "bundler proxy error");
    return reply.status(500).send({ error: "bundler_proxy_error" });
  }
});

// Sponsorship proxy (client-driven userOp): stamps paymaster data; returns enriched fields
fastify.post("/aa/sponsor", async (request, reply) => {
  const sid: string = (request as unknown as { sid: string }).sid;
  const session = sessions.get(sid) || {};
  if (!session.userId) return reply.status(401).send({ error: "Unauthorized" });
  const body = (
    request as unknown as { body?: { userOp?: Record<string, unknown>; chainId?: number } }
  ).body as { userOp: Record<string, unknown>; chainId?: number } | undefined;
  if (!body || !body.userOp) return reply.status(400).send({ error: "missing_userop" });
  const chainId = Number(body.chainId ?? process.env.VITE_CHAIN_ID);
  const rpc = getPimlicoRpcUrl(chainId);
  const apiKey = process.env.PIMLICO_PAYMASTER_API_KEY || process.env.PIMLICO_API_KEY || "";
  if (!apiKey) return reply.status(500).send({ error: "missing_paymaster_key" });

  // Call Pimlico "sponsorUserOperation" (v2) endpoint
  try {
    const url = new URL(rpc);
    // v2 sponsor endpoint path per Pimlico docs
    url.pathname = url.pathname.replace(/\/rpc$/, "/sponsorUserOperation");
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "pimlico_sponsorUserOperation",
        params: [body.userOp, getEntryPoint(chainId), { preferredFeeToken: null }],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return reply.status(502).send({ error: "paymaster_failed", detail: text });
    }
    const json = (await res.json()) as { result?: Record<string, unknown> };
    // Extract fields expected by client to attach to the userOp
    const result = json?.result;
    if (!result) return reply.status(502).send({ error: "invalid_paymaster_response" });
    return reply.send({
      paymasterAndData: result.paymasterAndData,
      preVerificationGas: result.preVerificationGas,
      verificationGasLimit: result.verificationGasLimit,
      callGasLimit: result.callGasLimit,
      maxFeePerGas: result.maxFeePerGas,
      maxPriorityFeePerGas: result.maxPriorityFeePerGas,
    });
  } catch (err) {
    fastify.log.error({ err }, "sponsor error");
    return reply.status(500).send({ error: "sponsor_error" });
  }
});

// Health check
fastify.get("/health", async (request, reply) => {
  return reply.send({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    port: PORT,
    version: process.env.npm_package_version || "0.0.0",
  });
});

// Root endpoint (kept minimal to avoid drift)
fastify.get("/", async (request, reply) => {
  return reply.send({
    name: "Green Goods API",
    version: process.env.npm_package_version || "0.0.0",
  });
});

// Global error handler
fastify.setErrorHandler(async (error, request, reply) => {
  fastify.log.error({ err: error }, "Global error");
  return reply.status(500).send({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? error.message : "Something went wrong",
  });
});

// 404 handler
fastify.setNotFoundHandler(async (request, reply) => {
  return reply.status(404).send({ error: "Not found" });
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: "0.0.0.0" });
    fastify.log.info(`🚀 Green Goods API running on port ${PORT}`);
    fastify.log.info(`📊 Health check: http://localhost:${PORT}/health`);
    fastify.log.info(`🔐 Auth endpoints mounted under /auth/*`);
    fastify.log.info(`📧 Subscribe endpoint: http://localhost:${PORT}/subscribe`);
    fastify.log.info(`👤 Session endpoint: http://localhost:${PORT}/me`);
    fastify.log.info(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
