#!/usr/bin/env bun

import * as fs from "node:fs";

import Fastify from "fastify";
import cors from "@fastify/cors";
import { getAddress, isAddress, verifyMessage } from "viem";

import {
  ARTIFACT_OUTPUT_DIR,
  HOST,
  PORT,
  SCRIPT_DEFINITIONS,
  allowedOrigins,
  type OpsJob,
  type JobLogger,
} from "./types";
import { JobQueue } from "./job-queue";
import {
  challenges,
  createChallenge,
  createSession,
  pruneExpiredAuthState,
  requireAuth,
} from "./auth";
import { parseDeployRequest, parseRunScriptRequest, parseUpgradeRequest, toSerializableJob } from "./forge";
import { executeJob } from "./executors";

export { challenges, sessions, createSession, type AuthChallenge } from "./auth";
export type { OpsJob, JobLogger, JobLogEntry } from "./types";
export { buildApp };

async function buildApp(
  executorOverride?: (job: OpsJob, logger: JobLogger) => Promise<Record<string, unknown>>
): Promise<{ app: ReturnType<typeof Fastify>; queue: InstanceType<typeof JobQueue> }> {
  fs.mkdirSync(ARTIFACT_OUTPUT_DIR, { recursive: true });

  const queue = new JobQueue(executorOverride ?? executeJob);
  const app = Fastify({ logger: false });

  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed"), false);
    },
  });

  app.get("/health", async () => ({
    ok: true,
    host: HOST,
    port: PORT,
    artifactOutputDir: ARTIFACT_OUTPUT_DIR,
    serverTime: new Date().toISOString(),
  }));

  app.post("/auth/challenge", async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown> | undefined;
      const inputAddress = body?.address;
      if (typeof inputAddress !== "string" || !isAddress(inputAddress)) {
        reply.code(400).send({ error: "address must be a valid 0x address" });
        return;
      }

      const normalizedAddress = getAddress(inputAddress);
      const challenge = createChallenge(normalizedAddress);
      challenges.set(normalizedAddress, challenge);

      reply.send({
        address: normalizedAddress,
        message: challenge.message,
        expiresAt: new Date(challenge.expiresAt).toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reply.code(500).send({ error: message });
    }
  });

  app.post("/auth/verify", async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown> | undefined;
      const inputAddress = body?.address;
      const signature = body?.signature;

      if (typeof inputAddress !== "string" || !isAddress(inputAddress)) {
        reply.code(400).send({ error: "address must be a valid 0x address" });
        return;
      }

      if (typeof signature !== "string" || signature.length === 0) {
        reply.code(400).send({ error: "signature is required" });
        return;
      }

      const normalizedAddress = getAddress(inputAddress);
      const challenge = challenges.get(normalizedAddress);
      if (!challenge || challenge.expiresAt < Date.now()) {
        challenges.delete(normalizedAddress);
        reply.code(401).send({ error: "Challenge expired. Request a new challenge." });
        return;
      }

      const valid = await verifyMessage({
        address: normalizedAddress,
        message: challenge.message,
        signature: signature as `0x${string}`,
      });

      if (!valid) {
        reply.code(401).send({ error: "Invalid signature" });
        return;
      }

      challenges.delete(normalizedAddress);
      const session = createSession(normalizedAddress);

      reply.send({
        token: session.token,
        address: normalizedAddress,
        expiresAt: new Date(session.expiresAt).toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reply.code(500).send({ error: message });
    }
  });

  app.get("/scripts", { preHandler: requireAuth }, async () => ({
    scripts: Object.values(SCRIPT_DEFINITIONS).map((script) => ({
      id: script.id,
      description: script.description,
    })),
  }));

  app.post("/deploy/plan", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const payload = parseDeployRequest(request.body);
      const job = queue.create("deploy-plan", payload as unknown as Record<string, unknown>, request.sessionAddress || "unknown");
      reply.send({ job: toSerializableJob(job, false) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reply.code(400).send({ error: message });
    }
  });

  app.post("/deploy/finalize", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const payload = parseDeployRequest(request.body);
      const job = queue.create(
        "finalize-deploy",
        payload as unknown as Record<string, unknown>,
        request.sessionAddress || "unknown"
      );
      reply.send({ job: toSerializableJob(job, false) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reply.code(400).send({ error: message });
    }
  });

  app.post("/upgrade/plan", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const payload = parseUpgradeRequest(request.body);
      const job = queue.create("upgrade-plan", payload as unknown as Record<string, unknown>, request.sessionAddress || "unknown");
      reply.send({ job: toSerializableJob(job, false) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reply.code(400).send({ error: message });
    }
  });

  app.post("/upgrade/finalize", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const payload = parseUpgradeRequest(request.body);
      const job = queue.create(
        "finalize-upgrade",
        payload as unknown as Record<string, unknown>,
        request.sessionAddress || "unknown"
      );
      reply.send({ job: toSerializableJob(job, false) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reply.code(400).send({ error: message });
    }
  });

  app.post("/scripts/run", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const payload = parseRunScriptRequest(request.body);
      const job = queue.create("run-script", payload as unknown as Record<string, unknown>, request.sessionAddress || "unknown");
      reply.send({ job: toSerializableJob(job, false) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reply.code(400).send({ error: message });
    }
  });

  app.get("/jobs", { preHandler: requireAuth }, async () => ({
    jobs: queue.list().map((job) => toSerializableJob(job, false)),
  }));

  app.get("/jobs/:jobId", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { jobId?: string };
    if (!params.jobId) {
      reply.code(400).send({ error: "jobId is required" });
      return;
    }

    const job = queue.get(params.jobId);
    if (!job) {
      reply.code(404).send({ error: "Job not found" });
      return;
    }

    reply.send({ job: toSerializableJob(job, true) });
  });

  app.get("/jobs/:jobId/logs", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { jobId?: string };
    if (!params.jobId) {
      reply.code(400).send({ error: "jobId is required" });
      return;
    }

    const job = queue.get(params.jobId);
    if (!job) {
      reply.code(404).send({ error: "Job not found" });
      return;
    }

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("X-Accel-Buffering", "no");
    reply.hijack();

    const sendEvent = (event: string, payload: unknown): void => {
      try {
        reply.raw.write(`event: ${event}\n`);
        reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch {
        // Ignore write errors after disconnect
      }
    };

    job.logs.forEach((entry) => sendEvent("log", entry));
    sendEvent("status", toSerializableJob(job, false));

    const unsubscribeLog = queue.onLog(params.jobId, (entry) => sendEvent("log", entry));
    const unsubscribeStatus = queue.onStatus(params.jobId, (nextJob) => {
      sendEvent("status", toSerializableJob(nextJob, false));
      if (nextJob.status === "succeeded" || nextJob.status === "failed") {
        sendEvent("done", toSerializableJob(nextJob, false));
      }
    });

    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(": ping\n\n");
      } catch {
        clearInterval(heartbeat);
      }
    }, 15000);

    request.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribeLog();
      unsubscribeStatus();
    });
  });

  return { app, queue };
}

async function main(): Promise<void> {
  const { app } = await buildApp();

  setInterval(pruneExpiredAuthState, 60_000).unref();

  await app.listen({ host: HOST, port: PORT });

  console.log(`Green Goods Ops Runner listening on http://${HOST}:${PORT}`);
  console.log(`Artifact output dir: ${ARTIFACT_OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error("Failed to start ops runner", error);
  process.exit(1);
});
