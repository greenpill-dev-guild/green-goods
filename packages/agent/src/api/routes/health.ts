/**
 * Health Routes
 *
 * Health check and readiness endpoints for monitoring.
 */

import type { FastifyInstance } from "fastify";

export interface HealthDeps {
  isAIReady: () => boolean;
  isStorageReady: () => boolean;
}

/**
 * Register health check routes
 */
export async function healthRoutes(
  app: FastifyInstance,
  deps: HealthDeps
): Promise<void> {
  /**
   * Basic health check - always returns 200 if server is running
   */
  app.get("/health", async () => {
    return {
      status: "ok",
      timestamp: Date.now(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  });

  /**
   * Liveness probe - for Kubernetes/container orchestration
   */
  app.get("/health/live", async () => {
    return { status: "alive" };
  });

  /**
   * Readiness probe - checks if all services are ready
   */
  app.get("/health/ready", async (request, reply) => {
    const services = {
      ai: deps.isAIReady(),
      storage: deps.isStorageReady(),
    };

    const allReady = Object.values(services).every(Boolean);

    if (!allReady) {
      return reply.status(503).send({
        status: "not_ready",
        services,
      });
    }

    return {
      status: "ready",
      services,
    };
  });

  /**
   * Detailed status for debugging
   */
  app.get("/health/status", async () => {
    return {
      status: "ok",
      timestamp: Date.now(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
      version: process.env.npm_package_version || "unknown",
      services: {
        ai: {
          status: deps.isAIReady() ? "ready" : "loading",
        },
        storage: {
          status: deps.isStorageReady() ? "connected" : "disconnected",
        },
      },
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        memory: process.memoryUsage(),
      },
    };
  });
}

