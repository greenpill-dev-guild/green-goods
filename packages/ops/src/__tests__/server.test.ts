/**
 * Server integration tests — Fastify route tests using inject()
 *
 * Tests auth flows, protected routes, job CRUD, and request validation
 * through the actual HTTP layer without starting a real server.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildApp,
  challenges,
  sessions,
  createSession,
  type AuthChallenge,
  type OpsJob,
  type JobLogger,
} from "../index.js";
import type { FastifyInstance } from "fastify";

const VALID_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

/**
 * Mock executor that immediately succeeds without spawning real processes.
 */
const mockExecutor = async (job: OpsJob, logger: JobLogger): Promise<Record<string, unknown>> => {
  logger.log("system", `Mock executing job: ${job.type}`);
  return { mocked: true, type: job.type };
};

describe("Server routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const result = await buildApp(mockExecutor);
    app = result.app;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    challenges.clear();
    sessions.clear();
  });

  /**
   * Helper: create a valid session and return the bearer token.
   */
  function createTestSession(address: string = VALID_ADDRESS): string {
    const session = createSession(address);
    return session.token;
  }

  describe("GET /health", () => {
    it("returns ok: true", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/health",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.ok).toBe(true);
      expect(body.serverTime).toBeDefined();
    });

    it("does not require authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/health",
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe("POST /auth/challenge", () => {
    it("returns a challenge for a valid address", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/auth/challenge",
        payload: { address: VALID_ADDRESS },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.address).toBe(VALID_ADDRESS);
      expect(body.message).toContain("Green Goods Ops Runner Authentication");
      expect(body.message).toContain(VALID_ADDRESS);
      expect(body.expiresAt).toBeDefined();
    });

    it("normalizes lowercase addresses", async () => {
      const lowercase = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045";

      const response = await app.inject({
        method: "POST",
        url: "/auth/challenge",
        payload: { address: lowercase },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      // Should be checksummed
      expect(body.address).toBe(VALID_ADDRESS);
    });

    it("stores the challenge in the challenges map", async () => {
      await app.inject({
        method: "POST",
        url: "/auth/challenge",
        payload: { address: VALID_ADDRESS },
      });

      expect(challenges.has(VALID_ADDRESS)).toBe(true);
      const challenge = challenges.get(VALID_ADDRESS)!;
      expect(challenge.message).toContain(VALID_ADDRESS);
    });

    it("returns 400 for invalid address", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/auth/challenge",
        payload: { address: "not-an-address" },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toContain("address must be a valid 0x address");
    });

    it("returns 400 for missing address", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/auth/challenge",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("POST /auth/verify", () => {
    it("returns 400 for invalid address", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/auth/verify",
        payload: { address: "bad", signature: "0xsig" },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toContain("address must be a valid 0x address");
    });

    it("returns 400 for missing signature", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/auth/verify",
        payload: { address: VALID_ADDRESS },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toContain("signature is required");
    });

    it("returns 400 for empty signature", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/auth/verify",
        payload: { address: VALID_ADDRESS, signature: "" },
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns 401 for expired challenge", async () => {
      // Set an expired challenge
      challenges.set(VALID_ADDRESS, {
        message: "expired challenge",
        expiresAt: Date.now() - 1000,
      });

      const response = await app.inject({
        method: "POST",
        url: "/auth/verify",
        payload: { address: VALID_ADDRESS, signature: "0xdeadbeef" },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().error).toContain("Challenge expired");
    });

    it("returns 401 when no challenge exists", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/auth/verify",
        payload: { address: VALID_ADDRESS, signature: "0xdeadbeef" },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().error).toContain("Challenge expired");
    });
  });

  describe("Authentication middleware (requireAuth)", () => {
    it("returns 401 when no token provided", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/jobs",
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().error).toContain("Missing bearer token");
    });

    it("returns 401 for expired session token", async () => {
      sessions.set("expired-token", {
        address: VALID_ADDRESS,
        expiresAt: Date.now() - 1000,
      });

      const response = await app.inject({
        method: "GET",
        url: "/jobs",
        headers: { authorization: "Bearer expired-token" },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().error).toContain("Session expired");
    });

    it("accepts valid bearer token in Authorization header", async () => {
      const token = createTestSession();

      const response = await app.inject({
        method: "GET",
        url: "/jobs",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it("accepts token from query parameter", async () => {
      const token = createTestSession();

      const response = await app.inject({
        method: "GET",
        url: `/jobs?token=${token}`,
      });

      expect(response.statusCode).toBe(200);
    });

    it("cleans up expired session from the sessions map", async () => {
      sessions.set("expired-token", {
        address: VALID_ADDRESS,
        expiresAt: Date.now() - 1000,
      });

      expect(sessions.has("expired-token")).toBe(true);

      await app.inject({
        method: "GET",
        url: "/jobs",
        headers: { authorization: "Bearer expired-token" },
      });

      expect(sessions.has("expired-token")).toBe(false);
    });
  });

  describe("GET /scripts", () => {
    it("returns list of available scripts", async () => {
      const token = createTestSession();

      const response = await app.inject({
        method: "GET",
        url: "/scripts",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.scripts).toBeDefined();
      expect(Array.isArray(body.scripts)).toBe(true);
      expect(body.scripts.length).toBeGreaterThan(0);

      // Each script should have id and description
      for (const script of body.scripts) {
        expect(script.id).toBeDefined();
        expect(script.description).toBeDefined();
      }
    });

    it("requires authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/scripts",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("POST /deploy/plan", () => {
    it("requires authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/deploy/plan",
        payload: { network: "sepolia" },
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns 400 for missing network", async () => {
      const token = createTestSession();

      const response = await app.inject({
        method: "POST",
        url: "/deploy/plan",
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns 400 for invalid network", async () => {
      const token = createTestSession();

      const response = await app.inject({
        method: "POST",
        url: "/deploy/plan",
        headers: { authorization: `Bearer ${token}` },
        payload: { network: "polygon" },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toContain("Unsupported network");
    });

    it("creates a job for valid deploy plan request", async () => {
      const token = createTestSession();

      const response = await app.inject({
        method: "POST",
        url: "/deploy/plan",
        headers: { authorization: `Bearer ${token}` },
        payload: { network: "sepolia" },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.job).toBeDefined();
      expect(body.job.type).toBe("deploy-plan");
      expect(["queued", "running", "succeeded"]).toContain(body.job.status);
      expect(body.job.id).toBeDefined();
    });
  });

  describe("POST /deploy/finalize", () => {
    it("requires authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/deploy/finalize",
        payload: { network: "sepolia" },
      });

      expect(response.statusCode).toBe(401);
    });

    it("creates a finalize-deploy job", async () => {
      const token = createTestSession();

      const response = await app.inject({
        method: "POST",
        url: "/deploy/finalize",
        headers: { authorization: `Bearer ${token}` },
        payload: { network: "sepolia" },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.job.type).toBe("finalize-deploy");
    });
  });

  describe("POST /upgrade/plan", () => {
    it("requires authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/upgrade/plan",
        payload: { network: "sepolia", contract: "garden-token" },
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns 400 for invalid contract", async () => {
      const token = createTestSession();

      const response = await app.inject({
        method: "POST",
        url: "/upgrade/plan",
        headers: { authorization: `Bearer ${token}` },
        payload: { network: "sepolia", contract: "unknown-contract" },
      });

      expect(response.statusCode).toBe(400);
    });

    it("creates an upgrade-plan job", async () => {
      const token = createTestSession();

      const response = await app.inject({
        method: "POST",
        url: "/upgrade/plan",
        headers: { authorization: `Bearer ${token}` },
        payload: { network: "sepolia", contract: "garden-token" },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.job.type).toBe("upgrade-plan");
    });
  });

  describe("POST /upgrade/finalize", () => {
    it("creates a finalize-upgrade job", async () => {
      const token = createTestSession();

      const response = await app.inject({
        method: "POST",
        url: "/upgrade/finalize",
        headers: { authorization: `Bearer ${token}` },
        payload: { network: "sepolia", contract: "all" },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.job.type).toBe("finalize-upgrade");
    });
  });

  describe("POST /scripts/run", () => {
    it("requires authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/scripts/run",
        payload: { scriptId: "upload-action-images" },
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns 400 for unknown script", async () => {
      const token = createTestSession();

      const response = await app.inject({
        method: "POST",
        url: "/scripts/run",
        headers: { authorization: `Bearer ${token}` },
        payload: { scriptId: "nonexistent" },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toContain("Unsupported script id");
    });

    it("creates a run-script job", async () => {
      const token = createTestSession();

      const response = await app.inject({
        method: "POST",
        url: "/scripts/run",
        headers: { authorization: `Bearer ${token}` },
        payload: { scriptId: "upload-action-images" },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.job.type).toBe("run-script");
    });
  });

  describe("GET /jobs", () => {
    it("returns empty job list initially", async () => {
      const token = createTestSession();

      const response = await app.inject({
        method: "GET",
        url: "/jobs",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.jobs).toBeDefined();
      expect(Array.isArray(body.jobs)).toBe(true);
    });

    it("returns jobs after creating them", async () => {
      const token = createTestSession();

      // Create a job
      await app.inject({
        method: "POST",
        url: "/deploy/plan",
        headers: { authorization: `Bearer ${token}` },
        payload: { network: "sepolia" },
      });

      const response = await app.inject({
        method: "GET",
        url: "/jobs",
        headers: { authorization: `Bearer ${token}` },
      });

      const body = response.json();
      expect(body.jobs.length).toBeGreaterThanOrEqual(1);

      // Jobs listed without logs
      const jobEntry = body.jobs.find((j: Record<string, unknown>) => j.type === "deploy-plan");
      expect(jobEntry).toBeDefined();
      expect(jobEntry).not.toHaveProperty("logs");
    });
  });

  describe("GET /jobs/:jobId", () => {
    it("returns 404 for unknown job", async () => {
      const token = createTestSession();

      const response = await app.inject({
        method: "GET",
        url: "/jobs/nonexistent-id",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error).toContain("Job not found");
    });

    it("returns job with logs", async () => {
      const token = createTestSession();

      // Create a job
      const createResponse = await app.inject({
        method: "POST",
        url: "/deploy/plan",
        headers: { authorization: `Bearer ${token}` },
        payload: { network: "sepolia" },
      });

      const jobId = createResponse.json().job.id;

      const response = await app.inject({
        method: "GET",
        url: `/jobs/${jobId}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.job.id).toBe(jobId);
      // Single job endpoint includes logs
      expect(body.job).toHaveProperty("logs");
    });
  });

  describe("GET /jobs/:jobId/logs (SSE)", () => {
    it("returns 404 for unknown job", async () => {
      const token = createTestSession();

      const response = await app.inject({
        method: "GET",
        url: "/jobs/nonexistent-id/logs",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it("requires authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/jobs/some-id/logs",
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
