/**
 * Structured Logger Service (Pino)
 *
 * Production-ready structured logging with context support.
 */

import pino from "pino";

// Configure based on environment
const isDevelopment = process.env.NODE_ENV !== "production";

/**
 * Base logger instance
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? "debug" : "info"),
  transport: isDevelopment
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      }
    : undefined,
  // Production: structured JSON output
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: {
    service: "green-goods-agent",
    env: process.env.NODE_ENV || "development",
  },
});

/**
 * Create a child logger with additional context
 */
export function createLogger(context: string, meta?: Record<string, unknown>) {
  return logger.child({ context, ...meta });
}

// Pre-configured loggers for each module
export const loggers = {
  api: createLogger("api"),
  blockchain: createLogger("blockchain"),
  crypto: createLogger("crypto"),
  db: createLogger("db"),
  handlers: createLogger("handlers"),
  platform: createLogger("platform"),
  ai: createLogger("ai"),
  audit: createLogger("audit"),
};

// Type-safe audit event names
export type AuditEventType =
  | "operator:approve"
  | "operator:reject"
  | "gardener:submit"
  | "gardener:join"
  | "user:create"
  | "wallet:create";

/**
 * Audit logger for operator actions
 * Creates structured audit trail with timestamp and context
 */
export function auditLog(
  event: AuditEventType,
  actor: { platform: string; platformId: string; address: string },
  data: Record<string, unknown>
) {
  loggers.audit.info(
    {
      event,
      actor: {
        platform: actor.platform,
        platformId: actor.platformId,
        address: actor.address,
      },
      ...data,
      timestamp: new Date().toISOString(),
    },
    `Audit: ${event}`
  );
}

export default logger;
